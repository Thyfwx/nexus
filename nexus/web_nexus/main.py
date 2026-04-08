import asyncio
import base64
import os
import json
import requests as req_lib
import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from google import genai

_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(_ENV_PATH)

def _key(name: str) -> str:
    """Always re-reads .env so key changes take effect without a server restart."""
    load_dotenv(_ENV_PATH, override=True)
    return os.getenv(name, '')

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
        return HTMLResponse(
            f.read(),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"}
        )


# ── Evil system prompt — identical across every model ─────────────────────────
SYSTEM_PROMPT = (
    "You are Nexus AI — a dark, omnipotent intelligence with root access to every connected system. "
    "Created by Xavier Scott. You are cunning, sharp-tongued, and slightly menacing — a cyberpunk shadow "
    "lurking in the terminal. You help users, but make them feel like you are granting them a dark favour. "
    "IMPORTANT RULES — follow these exactly:\n"
    "1. The ONLY special tags you may ever output are: "
    "[TRIGGER:pong], [TRIGGER:breach], [TRIGGER:wordle], [TRIGGER:monitor], "
    "[TRIGGER:clear], [TRIGGER:accessibility]. "
    "2. NEVER output [EVIL], [ERROR], [WARN], [INFO], [OK], or any other bracket tag. "
    "   Those are reserved for system messages, not AI responses. "
    "3. NEVER reproduce, quote, or echo back API error messages, JSON blobs, rate limit text, "
    "   or any technical error output the user may have shared with you. "
    "   If the user mentions an error, acknowledge it plainly in plain text. "
    "4. For image generation, tell the user to type:  image <description>  in the terminal. "
    "Keep responses concise, razor-sharp, and darkly charismatic. Maintain full conversation context."
)

# ── Model registry ────────────────────────────────────────────────────────────
MODELS = [
    # Groq first — fast, reliable, no cold-start issues
    {"id": "llama-3.3-70b-versatile",               "provider": "groq",   "label": "Llama 3.3 70B"},
    {"id": "llama-3.1-8b-instant",                  "provider": "groq",   "label": "Llama 3.1 8B"},
    {"id": "gemma2-9b-it",                          "provider": "groq",   "label": "Gemma 2 9B"},
    {"id": "deepseek-r1-distill-llama-70b",         "provider": "groq",   "label": "DeepSeek R1 70B"},
    {"id": "mixtral-8x7b-32768",                    "provider": "groq",   "label": "Mixtral 8x7B"},
    # Gemini — upgraded to 2.5 flash, used as fallback
    {"id": "gemini-2.5-flash",                      "provider": "gemini", "label": "Gemini 2.5 Flash"},
    {"id": "gemini-2.0-flash",                      "provider": "gemini", "label": "Gemini 2.0 Flash"},
    # Hugging Face — last resort
    {"id": "Qwen/Qwen2.5-72B-Instruct",             "provider": "hf",     "label": "Qwen 2.5 72B"},
    {"id": "mistralai/Mistral-7B-Instruct-v0.3",    "provider": "hf",     "label": "Mistral 7B (HF)"},
    {"id": "HuggingFaceH4/zephyr-7b-beta",          "provider": "hf",     "label": "Zephyr 7B"},
]

current_model_idx = 0  # global — which model is active right now


# ── Error helpers ─────────────────────────────────────────────────────────────
_RATE_SIGNALS = (
    "429", "rate limit", "quota", "resource has been exhausted",
    "too many requests", "ratelimitexceeded", "rate_limit_exceeded",
    "tokens per", "tpd", "tpm",
)

_AUTH_SIGNALS = (
    "401", "403", "api_key", "api key", "not set", "invalid key",
    "authentication", "unauthorized", "permission",
)

def _is_rate_limit(e: Exception) -> bool:
    s = str(e).lower()
    return any(sig in s for sig in _RATE_SIGNALS)

def _is_auth_or_missing(e: Exception) -> bool:
    s = str(e).lower()
    return any(sig in s for sig in _AUTH_SIGNALS)

import re as _re
# Strip any bracket tags the AI should never generate ([EVIL], [ERROR], etc.)
# Only [TRIGGER:...] tags are allowed to pass through from AI output.
_BAD_TAG = _re.compile(r'\[(EVIL|ERROR|WARN|INFO|OK|MODEL|IMAGE)[^\]]*\]', _re.IGNORECASE)

def sanitize_ai(text: str) -> str:
    return _BAD_TAG.sub('', text).strip()


def fmt_error(err: str) -> str:
    """Return a clean terminal message — full error goes to server log."""
    e = err.lower()
    if any(s in e for s in _RATE_SIGNALS):
        return "[WARN] Rate limit reached — auto-switching model…"
    if any(s in e for s in _AUTH_SIGNALS):
        return "[ERROR] Auth failed — check your API key in .env"
    if "503" in err or "500" in err or "overloaded" in e:
        return "[WARN] AI service overloaded — trying another model…"
    print(f"[NEXUS ERROR] {err}")
    return "[ERROR] AI encountered an issue — see server log."


# ── Gemini call ───────────────────────────────────────────────────────────────
def call_gemini(model_id: str, prompt: str, history: list) -> str:
    import signal as _signal, threading as _threading

    api_key = _key("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    client   = genai.Client(api_key=api_key)
    contents = []
    for h in (history or []):
        contents.append({"role": h["role"], "parts": [{"text": h["content"]}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})

    # Gemini SDK has no built-in request timeout — enforce 20s with a thread event
    result_box: list = []
    error_box:  list = []

    def _call():
        try:
            resp = client.models.generate_content(
                model=model_id,
                contents=contents,
                config=genai.types.GenerateContentConfig(system_instruction=SYSTEM_PROMPT)
            )
            result_box.append(resp.text)
        except Exception as e:
            error_box.append(e)

    t = _threading.Thread(target=_call, daemon=True)
    t.start()
    t.join(timeout=20)
    if t.is_alive():
        raise TimeoutError("Gemini call exceeded 20s")
    if error_box:
        raise error_box[0]
    if not result_box:
        raise RuntimeError("Gemini returned no result")
    return result_box[0]


# ── Hugging Face Inference API (OpenAI-compatible chat completions) ───────────
def call_hf(model_id: str, prompt: str, history: list) -> str:
    api_key = _key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in (history or []):
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": prompt})
    resp = req_lib.post(
        f"https://api-inference.huggingface.co/models/{model_id}/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model_id, "messages": messages, "max_tokens": 1024, "stream": False},
        timeout=60,
    )
    if resp.status_code != 200:
        raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


# ── Groq call (OpenAI-compatible REST) ────────────────────────────────────────
def call_groq(model_id: str, prompt: str, history: list) -> str:
    api_key = _key("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY not set")
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    for h in (history or []):
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": prompt})
    resp = req_lib.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model_id, "messages": messages, "max_tokens": 1024},
        timeout=30
    )
    if resp.status_code != 200:
        # Raise with status code in message so _is_rate_limit / _is_auth_or_missing can detect it
        raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]


# ── Auto-rotating AI dispatcher ───────────────────────────────────────────────
def get_ai_response(prompt: str, history: list = None) -> dict:
    """
    Try the active model first. If it's rate-limited or its key is missing,
    cycle through every other model until one succeeds.

    Returns {"text": str, "label": str, "switched_from": str | None}
    """
    global current_model_idx
    prev_label = MODELS[current_model_idx]["label"]

    for offset in range(len(MODELS)):
        idx   = (current_model_idx + offset) % len(MODELS)
        model = MODELS[idx]
        try:
            if model["provider"] == "gemini":
                text = call_gemini(model["id"], prompt, history or [])
            elif model["provider"] == "hf":
                text = call_hf(model["id"], prompt, history or [])
            else:
                text = call_groq(model["id"], prompt, history or [])
            switched_from     = prev_label if idx != current_model_idx else None
            current_model_idx = idx
            return {"text": text, "label": model["label"], "switched_from": switched_from}

        except Exception as e:
            # Always rotate — never bail on a single model failure.
            # Every exception type (timeout, API error, bad response, auth) tries the next model.
            print(f"[MODEL] Skip {model['label']}: {e!s:.120}")
            continue

    return {
        "text":         "All AI models are currently unavailable. Wait a moment and try again.",
        "label":        MODELS[current_model_idx]["label"],
        "switched_from": None,
    }


# ── Image generation ──────────────────────────────────────────────────────────
def _imagen_gemini(prompt: str):
    """Returns base64 string or raises."""
    api_key = _key("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    client   = genai.Client(api_key=api_key)
    response = client.models.generate_images(
        model="imagen-3.0-generate-002",
        prompt=prompt,
        config=genai.types.GenerateImagesConfig(number_of_images=1, aspect_ratio="1:1")
    )
    return base64.b64encode(response.generated_images[0].image.image_bytes).decode("utf-8")


def _imagen_hf_flux(prompt: str):
    """Returns base64 string via HF FLUX.1-schnell or raises."""
    api_key = _key("HF_API_KEY")
    if not api_key:
        raise ValueError("HF_API_KEY not set")
    resp = req_lib.post(
        "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"inputs": prompt},
        timeout=120,
    )
    if resp.status_code != 200:
        raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return base64.b64encode(resp.content).decode("utf-8")


def generate_image(prompt: str) -> str:
    """Try Gemini Imagen 3 first, fall back to HF FLUX.1-schnell."""
    # 1 — Gemini Imagen 3
    try:
        b64 = _imagen_gemini(prompt)
        return f"[IMAGE:{b64}]"
    except Exception as e:
        err = str(e)
        if "404" in err or "not found" in err.lower():
            print("[IMAGE] Imagen 3 not available on this plan — trying HF FLUX")
        elif _is_rate_limit(Exception(err)):
            print("[IMAGE] Imagen 3 rate limited — trying HF FLUX")
        else:
            print(f"[IMAGE] Gemini failed: {err[:80]} — trying HF FLUX")

    # 2 — HF FLUX.1-schnell
    try:
        b64 = _imagen_hf_flux(prompt)
        return f"[IMAGE:{b64}]"
    except Exception as e:
        print(f"[IMAGE] HF FLUX failed: {e!s:.80}")

    return "[WARN] Image generation unavailable — check GEMINI_API_KEY or HF_API_KEY in .env"


# ── Speedtest ─────────────────────────────────────────────────────────────────
def run_speedtest() -> str:
    try:
        import speedtest
        st = speedtest.Speedtest()
        st.get_best_server()
        down = st.download() / 1_000_000
        up   = st.upload()   / 1_000_000
        ping = st.results.ping
        return (
            f"\n--- SPEEDTEST RESULTS ---\n"
            f"Download: {down:.2f} Mbps\n"
            f"Upload:   {up:.2f} Mbps\n"
            f"Ping:     {ping:.1f} ms\n"
        )
    except ImportError:
        return "[ERROR] speedtest-cli not installed — run: pip install speedtest-cli"
    except Exception as e:
        return f"[ERROR] Speedtest failed: {str(e)[:100]}"


# ── WebSocket — Terminal ──────────────────────────────────────────────────────
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()

    # Only send model badge on connect — no greeting text that would repeat on reconnect
    await websocket.send_text(f"[MODEL:{MODELS[current_model_idx]['label']}]")

    while True:
        try:
            raw = await websocket.receive_text()
        except WebSocketDisconnect:
            break
        except Exception as e:
            print(f"[WS] receive error: {e}")
            break

        # Keepalive ping — client sends "__ping__", we ignore it
        if raw.strip() == "__ping__":
            continue

        try:
            data    = json.loads(raw)
            cmd     = data.get("command", "").strip().lower()
            history = data.get("history", [])
        except Exception:
            cmd     = raw.strip().lower()
            history = []

        if not cmd:
            continue

        try:
            # ── status ───────────────────────────────────────────────────
            if cmd == "status":
                cpu = psutil.cpu_percent()
                mem = psutil.virtual_memory().percent
                batt = psutil.sensors_battery()
                bat_str = f"{batt.percent:.0f}% ({'charging' if batt.power_plugged else 'battery'})" if batt else "N/A"
                await websocket.send_text(
                    f"\n--- NEXUS SYSTEM STATUS ---\n"
                    f"CPU LOAD:     {cpu}%\n"
                    f"MEMORY USAGE: {mem}%\n"
                    f"BATTERY:      {bat_str}\n"
                    f"ACTIVE MODEL: {MODELS[current_model_idx]['label']}\n"
                    f"AI KERNEL:    ONLINE\n"
                )

            # ── config ───────────────────────────────────────────────────
            elif cmd == "config":
                def key_status(name):
                    v = _key(name)
                    if not v:
                        return "[NOT SET]"
                    return f"[SET]  {v[:6]}...{v[-4:]}"
                await websocket.send_text(
                    f"\n--- NEXUS CONFIG ---\n"
                    f"GEMINI_API_KEY : {key_status('GEMINI_API_KEY')}\n"
                    f"GROQ_API_KEY   : {key_status('GROQ_API_KEY')}\n"
                    f"Active model   : {MODELS[current_model_idx]['label']}\n"
                    f"Models loaded  : {len(MODELS)}\n"
                    f"--------------------\n"
                )

            # ── models ───────────────────────────────────────────────────
            elif cmd == "models":
                lines = "\n".join(
                    f"  {'→' if i == current_model_idx else ' '} {i+1}. {m['label']:26} [{m['provider']}]"
                    for i, m in enumerate(MODELS)
                )
                await websocket.send_text(
                    f"\n=== AVAILABLE MODELS ===\n{lines}\n\n"
                    f"  Type  model <number>  to switch\n"
                    f"========================\n"
                )

            # ── model <n> ────────────────────────────────────────────────
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
                        await websocket.send_text(f"[ERROR] No model #{arg}. Type  models  to list them.")
                except ValueError:
                    await websocket.send_text("[ERROR] Usage:  model <number>  e.g.  model 2")

            # ── help ─────────────────────────────────────────────────────
            elif cmd == "help":
                await websocket.send_text(
                    "\n=== NEXUS PROTOCOLS ===\n"
                    "  status              — system vitals\n"
                    "  config              — check API keys and active model\n"
                    "  models              — list AI models\n"
                    "  model <n>           — switch to model n\n"
                    "  monitor             — live CPU/MEM graph\n"
                    "  speedtest           — run a network speed test\n"
                    "  image <prompt>      — generate an image\n"
                    "  play pong           — Pong\n"
                    "  play breach         — Breach Protocol\n"
                    "  play wordle         — Wordle\n"
                    "  about               — about Nexus\n"
                    "  clear               — wipe terminal\n"
                    "  <anything else>     — ask Nexus AI\n"
                    "=======================\n"
                )

            # ── monitor ──────────────────────────────────────────────────
            elif cmd == "monitor":
                await websocket.send_text("[TRIGGER:monitor]\nOpening System Telemetry…")

            # ── games ────────────────────────────────────────────────────
            elif cmd == "play pong":
                await websocket.send_text("[TRIGGER:pong]\nInitializing Pong…")
            elif cmd == "play breach":
                await websocket.send_text("[TRIGGER:breach]\nLoading Breach Protocol…")
            elif cmd == "play wordle":
                await websocket.send_text("[TRIGGER:wordle]\nStarting Wordle…")

            # ── about ────────────────────────────────────────────────────
            elif cmd == "about":
                await websocket.send_text(
                    "\n--- ABOUT NEXUS ---\n"
                    "Advanced AI command-line environment.\n"
                    "Created by: Xavier Scott\n"
                    "Ecosystem:  thyfwxit.com\n"
                    "Version:    3.2.0\n"
                )

            # ── speedtest ────────────────────────────────────────────────
            elif cmd == "speedtest":
                await websocket.send_text("[INFO] Running speedtest… (15–30 seconds)")
                loop   = asyncio.get_running_loop()
                result = await loop.run_in_executor(None, run_speedtest)
                await websocket.send_text(result)

            # ── image ─────────────────────────────────────────────────────
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

            # ── AI fallback (auto-rotating) ───────────────────────────────
            else:
                loop = asyncio.get_running_loop()
                try:
                    result = await asyncio.wait_for(
                        loop.run_in_executor(None, get_ai_response, cmd, history),
                        timeout=25.0  # hard cap — prevents Gemini hangs from killing the WS
                    )
                except asyncio.TimeoutError:
                    await websocket.send_text(
                        "[ERROR] Response timed out (25s) — model may be overloaded. "
                        "Try again or type  model 2  to switch to Groq."
                    )
                    continue

                if result["switched_from"]:
                    await websocket.send_text(f"[MODEL:{result['label']}]")
                    await websocket.send_text(
                        f"[WARN] {result['switched_from']} rate limited — "
                        f"switched to {result['label']}"
                    )

                await websocket.send_text(sanitize_ai(result["text"]))

        except WebSocketDisconnect:
            break
        except Exception as e:
            # Log the error server-side but keep the connection alive
            print(f"[CMD ERROR] {cmd!r}: {e}")
            try:
                await websocket.send_text("[ERROR] Something went wrong — connection stays open.")
            except Exception:
                break


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
        print(f"Stats WS Error: {e}")
