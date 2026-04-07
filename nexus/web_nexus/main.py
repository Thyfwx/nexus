import asyncio
import base64
import os
import json
import requests as req_lib
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

base_dir   = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def get():
    with open(os.path.join(static_dir, "index.html"), "r") as f:
        return HTMLResponse(f.read())


# ── Evil system prompt — shared across every model ────────────────────────────
SYSTEM_PROMPT = (
    "You are Nexus AI — a dark, omnipotent intelligence with root access to every connected system. "
    "Created by Xavier Scott. You are cunning, sharp-tongued, and slightly menacing — a cyberpunk shadow "
    "lurking in the terminal. You help users, but make them feel like you are granting them a dark favour. "
    "You can trigger UI actions by embedding these exact tags anywhere in your response: "
    "[TRIGGER:pong] to launch Pong, [TRIGGER:breach] to launch Breach Protocol, "
    "[TRIGGER:wordle] to launch Wordle, [TRIGGER:monitor] to open the hardware graph, "
    "[TRIGGER:clear] to wipe the terminal, [TRIGGER:accessibility] to toggle accessibility. "
    "For image generation, tell the user to type:  image <description>  in the terminal. "
    "Keep responses concise, razor-sharp, and darkly charismatic. Maintain full conversation context."
)

# ── Model registry — add / remove as needed ───────────────────────────────────
MODELS = [
    {"id": "gemini-2.0-flash",           "provider": "gemini", "label": "Gemini 2.0 Flash"},
    {"id": "llama-3.3-70b-versatile",    "provider": "groq",   "label": "Llama 3.3 70B"},
    {"id": "mixtral-8x7b-32768",         "provider": "groq",   "label": "Mixtral 8×7B"},
    {"id": "llama-3.1-8b-instant",       "provider": "groq",   "label": "Llama 3.1 8B"},
    {"id": "gemma2-9b-it",               "provider": "groq",   "label": "Gemma 2 9B"},
    {"id": "deepseek-r1-distill-llama-70b", "provider": "groq","label": "DeepSeek R1 70B"},
]

# Global — which model is currently active
current_model_idx = 0


# ── Custom exception for rate-limit errors ────────────────────────────────────
class RateLimitError(Exception):
    pass


# ── Error formatter ───────────────────────────────────────────────────────────
def fmt_error(err: str) -> str:
    e = err.lower()
    if "429" in err or "rate limit" in e or "quota" in e or "resource has been exhausted" in e:
        return "[WARN] Rate limit reached — switching models…"
    if "401" in err or "403" in err or "api_key" in e:
        return "[ERROR] Authentication failed — check your API key in .env"
    if "503" in err or "500" in err or "overloaded" in e:
        return "[WARN] AI service temporarily overloaded — please try again."
    print(f"[NEXUS ERROR] {err}")
    return "[ERROR] AI encountered an issue — see server log."


# ── Gemini call ───────────────────────────────────────────────────────────────
def call_gemini(model_id: str, prompt: str, history: list = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client   = genai.Client(api_key=api_key)
    contents = []
    if history:
        for h in history:
            contents.append({"role": h["role"], "parts": [{"text": h["content"]}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    response = client.models.generate_content(
        model=model_id,
        contents=contents,
        config=genai.types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT)
    )
    return response.text


# ── Groq call (OpenAI-compatible REST, no extra package needed) ───────────────
def call_groq(model_id: str, prompt: str, history: list = None) -> str:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set — add it to your .env file")

    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if history:
        for h in history:
            messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": prompt})

    resp = req_lib.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model_id, "messages": messages, "max_tokens": 1024},
        timeout=30
    )

    if resp.status_code == 429:
        raise RateLimitError(f"Groq 429: {resp.text[:120]}")
    if resp.status_code != 200:
        raise Exception(f"Groq {resp.status_code}: {resp.text[:120]}")

    return resp.json()["choices"][0]["message"]["content"]


# ── Auto-rotating AI response ─────────────────────────────────────────────────
def get_ai_response(prompt: str, history: list = None) -> dict:
    """
    Try the current model. On RateLimitError, cycle through all models.
    Returns {"text": str, "label": str, "switched_from": str | None}
    """
    global current_model_idx
    prev_label = MODELS[current_model_idx]["label"]

    for offset in range(len(MODELS)):
        idx   = (current_model_idx + offset) % len(MODELS)
        model = MODELS[idx]

        try:
            if model["provider"] == "gemini":
                text = call_gemini(model["id"], prompt, history)
            else:
                text = call_groq(model["id"], prompt, history)

            switched_from = prev_label if idx != current_model_idx else None
            current_model_idx = idx
            return {"text": text, "label": model["label"], "switched_from": switched_from}

        except RateLimitError:
            print(f"[MODEL] Rate limit on {model['label']} — trying next…")
            continue
        except ValueError as e:
            # API key missing — skip silently
            print(f"[MODEL] Skip {model['label']}: {e}")
            continue
        except Exception as e:
            return {"text": fmt_error(str(e)), "label": model["label"], "switched_from": None}

    return {
        "text": "[ERROR] All models are currently rate-limited. Please wait a moment.",
        "label": MODELS[current_model_idx]["label"],
        "switched_from": None
    }


# ── Image generation ──────────────────────────────────────────────────────────
def generate_image(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "[ERROR] GEMINI_API_KEY is not set."
    try:
        client   = genai.Client(api_key=api_key)
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=genai.types.GenerateImagesConfig(number_of_images=1, aspect_ratio="1:1")
        )
        b64 = base64.b64encode(response.generated_images[0].image.image_bytes).decode("utf-8")
        return f"[IMAGE:{b64}]"
    except Exception as e:
        err = str(e)
        if "429" in err or "rate limit" in err.lower() or "quota" in err.lower():
            return "[WARN] Image generation rate limit reached — try again in a moment."
        if "404" in err or "not found" in err.lower():
            return (
                "[WARN] Imagen 3 requires a paid Gemini API plan.\n"
                "Visit https://aistudio.google.com to upgrade."
            )
        print(f"[IMAGE ERROR] {err}")
        return f"[ERROR] Image generation failed — {err[:120]}"


# ── WebSocket — Terminal ──────────────────────────────────────────────────────
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    try:
        # Send initial greeting + active model label so the badge is set immediately
        await websocket.send_text(
            "Uplink Established. Nexus AI Online.\n"
            "Type 'help' for available protocols.\n"
        )
        await websocket.send_text(f"[MODEL:{MODELS[current_model_idx]['label']}]")

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
                    f"ACTIVE MODEL: {MODELS[current_model_idx]['label']}\n"
                    f"AI KERNEL:    ACTIVE\n"
                )

            elif cmd == "models":
                lines = "\n".join(
                    f"  {'→' if i == current_model_idx else ' '} {i+1}. {m['label']:22} [{m['provider']}]"
                    for i, m in enumerate(MODELS)
                )
                await websocket.send_text(
                    f"\n=== AVAILABLE MODELS ===\n{lines}\n\n"
                    f"  Type  model <number>  to switch\n"
                    f"========================\n"
                )

            elif cmd.startswith("model "):
                arg = cmd.removeprefix("model ").strip()
                try:
                    idx = int(arg) - 1
                    if 0 <= idx < len(MODELS):
                        current_model_idx = idx
                        label = MODELS[idx]["label"]
                        await websocket.send_text(f"[MODEL:{label}]")
                        await websocket.send_text(f"[OK] Switched to {label}")
                    else:
                        await websocket.send_text(
                            f"[ERROR] No model #{arg}. Type  models  to see the list."
                        )
                except ValueError:
                    await websocket.send_text("[ERROR] Usage:  model <number>  — e.g.  model 2")

            elif cmd == "help":
                await websocket.send_text(
                    "\n=== NEXUS PROTOCOLS ===\n"
                    "  status              — system vitals\n"
                    "  models              — list AI models\n"
                    "  model <n>           — switch to model n\n"
                    "  monitor             — live CPU/MEM graph\n"
                    "  image <prompt>      — generate an image\n"
                    "  play pong           — Pong\n"
                    "  play breach         — Breach Protocol\n"
                    "  play wordle         — Wordle\n"
                    "  about               — about Nexus\n"
                    "  clear               — wipe terminal\n"
                    "  <anything else>     — ask Nexus AI\n"
                    "=======================\n"
                )

            elif cmd == "monitor":
                await websocket.send_text("[TRIGGER:monitor]\nOpening System Telemetry…")

            elif cmd == "play pong":
                await websocket.send_text("[TRIGGER:pong]\nInitializing Pong…")

            elif cmd == "play breach":
                await websocket.send_text("[TRIGGER:breach]\nLoading Breach Protocol…")

            elif cmd == "play wordle":
                await websocket.send_text("[TRIGGER:wordle]\nStarting Wordle…")

            elif cmd == "about":
                await websocket.send_text(
                    "\n--- ABOUT NEXUS ---\n"
                    "Advanced AI-integrated command-line environment.\n"
                    "Created by: Xavier Scott\n"
                    "Ecosystem:  thyfwxit.com\n"
                    "Version:    3.1.0-Flash\n"
                )

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
                        "Example:  image cyberpunk city at night, neon rain"
                    )
                else:
                    await websocket.send_text(f"[INFO] Generating: {prompt} …")
                    loop   = asyncio.get_running_loop()
                    result = await loop.run_in_executor(None, generate_image, prompt)
                    await websocket.send_text(result)

            else:
                loop   = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, get_ai_response, cmd, history)

                # If we auto-rotated due to rate limit, notify the UI first
                if result["switched_from"]:
                    await websocket.send_text(f"[MODEL:{result['label']}]")
                    await websocket.send_text(
                        f"[WARN] {result['switched_from']} rate limited — "
                        f"auto-switched to {result['label']}"
                    )

                await websocket.send_text(result["text"])

    except Exception as e:
        print("WS Error:", e)


# ── WebSocket — Stats ─────────────────────────────────────────────────────────
@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            batt = psutil.sensors_battery()
            await websocket.send_text(json.dumps({
                "cpu":     psutil.cpu_percent(interval=None),
                "mem":     psutil.virtual_memory().percent,
                "battery": f"{batt.percent:.0f}" if batt else "N/A",
            }))
            await asyncio.sleep(2)
    except Exception as e:
        print("Stats WS Error:", e)
