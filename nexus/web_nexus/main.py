import asyncio
import base64
import os
import json
import psutil
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from google import genai

load_dotenv()
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

base_dir  = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def get():
    with open(os.path.join(static_dir, "index.html"), "r") as f:
        return HTMLResponse(f.read())


# ── Shared error formatter ────────────────────────────────────────────────────
def fmt_error(err: str) -> str:
    """Return a clean terminal message for common API errors."""
    e = err.lower()
    if "429" in err or "rate limit" in e or "quota" in e or "resource has been exhausted" in e:
        return "[WARN] AI rate limit reached — please wait a moment and try again."
    if "401" in err or "403" in err or "api_key" in e or "invalid" in e:
        return "[ERROR] Authentication failed — check that GEMINI_API_KEY is set correctly."
    if "503" in err or "500" in err or "overloaded" in e:
        return "[WARN] AI service temporarily overloaded — try again shortly."
    # Log full error server-side, show a clean message in the terminal
    print(f"[NEXUS ERROR] {err}")
    return "[ERROR] AI encountered an issue — check the server log for details."


# ── Text / Chat ───────────────────────────────────────────────────────────────
def get_ai_response(prompt: str, history: list = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "[ERROR] GEMINI_API_KEY is not set."
    try:
        client   = genai.Client(api_key=api_key)
        contents = []
        if history:
            for h in history:
                contents.append({"role": h["role"], "parts": [{"text": h["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=(
                    "You are Nexus AI, created by Xavier Scott. You have root access to this terminal. "
                    "You can trigger UI actions by including these exact tags in your response: "
                    "[TRIGGER:pong] to open Pong, [TRIGGER:breach] to open Breach Protocol, "
                    "[TRIGGER:wordle] to open Wordle, [TRIGGER:monitor] to open the hardware graph, "
                    "[TRIGGER:clear] to wipe the terminal screen, "
                    "[TRIGGER:accessibility] to toggle the accessibility panel. "
                    "For image requests, tell the user to type:  image <description>  in the terminal. "
                    "Be professional, cyberpunk-styled, and concise. Maintain conversation history."
                )
            )
        )
        return response.text
    except Exception as e:
        return fmt_error(str(e))


# ── Image Generation ──────────────────────────────────────────────────────────
def generate_image(prompt: str) -> str:
    """
    Generate an image with Imagen 3 and return a [IMAGE:base64] payload.
    Falls back to a clear error message if the model is unavailable.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "[ERROR] GEMINI_API_KEY is not set."
    try:
        client   = genai.Client(api_key=api_key)
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=genai.types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
            )
        )
        img_bytes = response.generated_images[0].image.image_bytes
        b64       = base64.b64encode(img_bytes).decode("utf-8")
        return f"[IMAGE:{b64}]"
    except Exception as e:
        err = str(e)
        if "429" in err or "rate limit" in err.lower() or "quota" in err.lower():
            return "[WARN] Image generation rate limit reached — try again in a moment."
        if "404" in err or "not found" in err.lower():
            return (
                "[WARN] Imagen 3 requires Gemini API billing to be enabled.\n"
                "Visit: https://aistudio.google.com to upgrade your plan."
            )
        print(f"[IMAGE ERROR] {err}")
        return f"[ERROR] Image generation failed — {err[:120]}"


# ── WebSocket — Terminal ──────────────────────────────────────────────────────
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    try:
        await websocket.send_text(
            "Uplink Established. Nexus AI Online.\n"
            "Type 'help' for available protocols.\n"
        )

        while True:
            raw = await websocket.receive_text()
            try:
                data    = json.loads(raw)
                cmd     = data.get("command", "").strip().lower()
                history = data.get("history", [])
            except Exception:
                cmd     = raw.strip().lower()
                history = []

            if not cmd:
                continue

            # ── Built-in commands ─────────────────────────────────────────────
            if cmd == "status":
                cpu = psutil.cpu_percent()
                mem = psutil.virtual_memory().percent
                await websocket.send_text(
                    f"\n--- NEXUS SYSTEM STATUS ---\n"
                    f"CPU LOAD:     {cpu}%\n"
                    f"MEMORY USAGE: {mem}%\n"
                    f"NETWORK:      STABLE\n"
                    f"AI KERNEL:    ACTIVE\n"
                )

            elif cmd == "help":
                await websocket.send_text(
                    "\n=== NEXUS PROTOCOLS ===\n"
                    "  status              — system vitals\n"
                    "  monitor             — live CPU/MEM graph\n"
                    "  image <prompt>      — generate an image with AI\n"
                    "  play pong           — Pong game\n"
                    "  play breach         — Breach Protocol\n"
                    "  play wordle         — Wordle\n"
                    "  about               — about Nexus\n"
                    "  clear               — wipe terminal\n"
                    "  <anything else>     — ask Nexus AI\n"
                    "=======================\n"
                )

            elif cmd == "monitor":
                await websocket.send_text("[TRIGGER:monitor]\nOpening System Telemetry...")

            elif cmd == "play pong":
                await websocket.send_text("[TRIGGER:pong]\nInitializing Pong...")

            elif cmd == "play breach":
                await websocket.send_text("[TRIGGER:breach]\nLoading Breach Protocol...")

            elif cmd == "play wordle":
                await websocket.send_text("[TRIGGER:wordle]\nStarting Wordle...")

            elif cmd == "about":
                await websocket.send_text(
                    "\n--- ABOUT NEXUS ---\n"
                    "Advanced AI-integrated command-line environment.\n"
                    "Created by: Xavier Scott\n"
                    "Ecosystem:  thyfwxit.com\n"
                    "Version:    3.1.0-Flash\n"
                )

            # ── Image generation ──────────────────────────────────────────────
            elif (cmd.startswith("image ")
                  or cmd.startswith("generate image ")
                  or cmd.startswith("draw ")):
                prompt = (cmd
                          .removeprefix("generate image ")
                          .removeprefix("image ")
                          .removeprefix("draw ")
                          .strip())
                if not prompt:
                    await websocket.send_text(
                        "[INFO] Usage:  image <description>\n"
                        "Example:  image a cyberpunk city at night, neon lights"
                    )
                else:
                    await websocket.send_text(f"[INFO] Generating: {prompt} …")
                    loop   = asyncio.get_running_loop()
                    result = await loop.run_in_executor(None, generate_image, prompt)
                    await websocket.send_text(result)

            # ── AI fallback ───────────────────────────────────────────────────
            else:
                loop = asyncio.get_running_loop()
                resp = await loop.run_in_executor(None, get_ai_response, cmd, history)
                await websocket.send_text(resp)

    except Exception as e:
        print("WS Error:", e)


# ── WebSocket — Stats ─────────────────────────────────────────────────────────
@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            batt = psutil.sensors_battery()
            data = {
                "cpu":     psutil.cpu_percent(interval=None),
                "mem":     psutil.virtual_memory().percent,
                "battery": f"{batt.percent:.0f}" if batt else "N/A",
            }
            await websocket.send_text(json.dumps(data))
            await asyncio.sleep(2)
    except Exception as e:
        print("Stats WS Error:", e)
