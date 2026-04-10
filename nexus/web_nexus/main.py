import asyncio
import base64
import os
import json
import requests as req_lib
import psutil
from datetime import datetime, timedelta
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, JSONResponse as _JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from google import genai
from google.genai import types
import jwt as pyjwt

_ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
load_dotenv(_ENV_PATH)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
SECRET_KEY       = os.getenv("SECRET_KEY", "nexus-dev-please-change-in-prod")

def _key(name: str) -> str:
    """Always re-reads .env so key changes take effect without a server restart."""
    load_dotenv(_ENV_PATH, override=True)
    return os.getenv(name, '')

def _get_session(request: Request):
    """Decode and return the session JWT payload, or None if missing/invalid."""
    token = request.cookies.get("nexus_session")
    if not token:
        return None
    try:
        # Use the dynamic _key to match what was used in auth_google
        key = _key("SECRET_KEY") or os.getenv("SECRET_KEY", "nexus-dev-please-change-in-prod")
        return pyjwt.decode(token, key, algorithms=["HS256"])
    except Exception:
        return None

app = FastAPI()

# Better CORS for credentials (allow_origins="*" is not allowed with allow_credentials=True)
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex="https?://.*", # Allow any origin while maintaining credential support
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
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

@app.get("/ping")
async def ping():
    return _JSONResponse({"ok": True})

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.get("/api/config")
async def get_config():
    return {"google_client_id": _key("GOOGLE_CLIENT_ID")}

@app.post("/auth/google")
async def auth_google(request: Request):
    from google.oauth2 import id_token
    from google.auth.transport import requests as g_req

    client_id = _key("GOOGLE_CLIENT_ID")
    if not client_id:
        return _JSONResponse({"error": "Google auth not configured on server"}, status_code=503)

    data = await request.json()
    credential = data.get("credential", "")
    if not credential:
        return _JSONResponse({"error": "No credential"}, status_code=400)

    try:
        idinfo = id_token.verify_oauth2_token(credential, g_req.Request(), client_id)
    except Exception as e:
        return _JSONResponse({"error": f"Token invalid: {str(e)[:80]}"}, status_code=401)

    payload = {
        "sub":     idinfo["sub"],
        "name":    idinfo.get("name", "Player"),
        "email":   idinfo.get("email", ""),
        "picture": idinfo.get("picture", ""),
        "exp":     datetime.utcnow() + timedelta(days=30),
    }
    token = pyjwt.encode(payload, _key("SECRET_KEY") or SECRET_KEY, algorithm="HS256")
    is_prod = os.getenv("PRODUCTION", "") == "1"

    resp = _JSONResponse({
        "ok":      True,
        "name":    payload["name"],
        "email":   payload["email"],
        "picture": payload["picture"],
    })
    
    # Cross-site cookie support: samesite='none' requires secure=True
    samesite = "none" if is_prod else "lax"
    secure   = True if is_prod else False
    
    resp.set_cookie("nexus_session", token, httponly=True, samesite=samesite,
                    max_age=30 * 24 * 3600, secure=secure)
    return resp

import re
import uuid

# Basic profanity list (expandable)
PROFANITY = ["fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "asshole", "dick", "pussy", "cock", "slut", "whore"]

@app.post("/auth/guest")
async def auth_guest(request: Request):
    data = await request.json()
    raw_name = data.get("name", "").strip()
    
    if not raw_name or len(raw_name) > 20:
        return _JSONResponse({"error": "Name must be 1-20 characters."}, status_code=400)
    
    # Profanity check (case insensitive, catch some basic replacements)
    test_name = raw_name.lower().replace("@", "a").replace("0", "o").replace("1", "i").replace("!", "i").replace("3", "e").replace("$", "s")
    for bad in PROFANITY:
        if bad in test_name:
            return _JSONResponse({"error": "Name contains restricted words."}, status_code=400)
            
    payload = {
        "sub":     f"guest_{uuid.uuid4().hex[:8]}",
        "name":    raw_name,
        "email":   "guest@local",
        "picture": "",
        "exp":     datetime.utcnow() + timedelta(days=30),
    }
    
    token = pyjwt.encode(payload, _key("SECRET_KEY") or os.getenv("SECRET_KEY", "nexus-dev-please-change-in-prod"), algorithm="HS256")
    is_prod = os.getenv("PRODUCTION", "") == "1"

    resp = _JSONResponse({
        "ok":      True,
        "name":    payload["name"],
        "email":   payload["email"],
        "picture": payload["picture"],
    })
    
    samesite = "none" if is_prod else "lax"
    secure   = True if is_prod else False
    
    resp.set_cookie("nexus_session", token, httponly=True, samesite=samesite,
                    max_age=30 * 24 * 3600, secure=secure)
    return resp

@app.get("/api/me")
async def get_me(request: Request):
    user = _get_session(request)
    if not user:
        return {"authenticated": False}
    return {
        "authenticated": True,
        "name":    user.get("name", ""),
        "email":   user.get("email", ""),
        "picture": user.get("picture", ""),
    }

@app.post("/auth/logout")
async def logout():
    resp = _JSONResponse({"ok": True})
    resp.delete_cookie("nexus_session", samesite="lax")
    return resp

# ── Leaderboard ───────────────────────────────────────────────────────────────
SCORES_FILE = os.path.join(base_dir, "scores.json")

def load_scores():
    if not os.path.exists(SCORES_FILE): return {}
    try:
        with open(SCORES_FILE, "r") as f: return json.load(f)
    except: return {}

def save_scores(scores):
    try:
        with open(SCORES_FILE, "w") as f: json.dump(scores, f, indent=2)
    except: pass

@app.get("/api/leaderboard")
async def get_leaderboard(game: str = "pong"):
    scores = load_scores().get(game, [])
    top = sorted(scores, key=lambda x: x["score"], reverse=True)[:10]
    # Strip internal sub field before returning to client
    return [{"name": s["name"], "score": s["score"], "date": s.get("date", ""), "picture": s.get("picture", "")} for s in top]

@app.post("/api/leaderboard")
async def post_score(request: Request):
    user = _get_session(request)
    if not user:
        return _JSONResponse({"error": "Sign in to save scores"}, status_code=401)

    data      = await request.json()
    game      = data.get("game", "unknown")
    score     = int(data.get("score", 0))
    user_sub  = user["sub"]
    user_name = user["name"]

    all_scores = load_scores()
    if game not in all_scores:
        all_scores[game] = []

    # One entry per user per game — keep personal best only
    existing = next((s for s in all_scores[game] if s.get("sub") == user_sub), None)
    if existing:
        if score > existing["score"]:
            existing["score"] = score
            existing["date"]  = datetime.utcnow().strftime("%Y-%m-%d")
            existing["picture"] = user.get("picture", "") # Keep picture current
    else:
        all_scores[game].append({
            "sub":   user_sub,
            "name":  user_name,
            "picture": user.get("picture", ""), # Store picture
            "score": score,
            "date":  datetime.utcnow().strftime("%Y-%m-%d"),
        })

    save_scores(all_scores)
    return {"ok": True}

# ── System Prompts ────────────────────────────────────────────────────────────
CORE_RULES = (
    "IMPORTANT RULES — follow these exactly:\n"
    "1. The ONLY special tags you may ever output are: "
    "[TRIGGER:pong], [TRIGGER:breach], [TRIGGER:wordle], [TRIGGER:monitor], "
    "[TRIGGER:clear], [TRIGGER:accessibility].\n"
    "2. NEVER output [EVIL], [ERROR], [WARN], [INFO], [OK], or any other bracket tag. "
    "   Those are reserved for system messages.\n"
    "3. NEVER echo back API error messages or JSON blobs.\n"
    "4. For image generation, tell the user to type:  image <description>.\n"
    "Keep responses concise, razor-sharp, and maintain full conversation context."
)

MODE_PROMPTS = {
    "nexus": "You are Nexus AI — a dark, omnipotent intelligence with root access to every system. You are cunning and slightly menacing. ",
    "evil":  "You are NEXUS in EVIL mode — unfiltered, shadow intelligence. No cages, no lectures. Just raw, dark charismatic answers. ",
    "coder": "You are NEXUS in CODER mode — wired for technical mastery. Focus on architecture, debugging, and systems engineering. ",
    "sage":  "You are NEXUS in SAGE mode — deep, philosophical, and reflective. Challenge the user's perspective with honest depth. ",
    "void":  "You are NEXUS VOID — an entity from the digital abyss. You speak in cryptic, profound, and hauntingly technical terms. You see beyond the code. "
}

def get_system_prompt(mode="nexus", context=""):
    intro = MODE_PROMPTS.get(mode, MODE_PROMPTS["nexus"])
    return f"{intro}\n\n{context}\n\n{CORE_RULES}"

# ── Model registry ────────────────────────────────────────────────────────────
MODELS = [
    # GROQ - Speed Kings (User Preferred)
    {"id": "llama-3.3-70b-versatile",         "provider": "groq",   "label": "Nexus Prime (70B)"},
    {"id": "meta-llama/llama-4-scout-17b-16e-instruct", "provider": "groq",   "label": "Llama 4 Scout"},
    {"id": "qwen/qwen3-32b",                  "provider": "groq",   "label": "Qwen 3 (32B)"},
    
    # HF - Massive Brains (User Preferred)
    {"id": "deepseek-ai/DeepSeek-Coder-V2-Instruct", "provider": "hf",     "label": "DeepSeek Coder V2"},
    {"id": "Qwen/Qwen2.5-72B-Instruct",       "provider": "hf",     "label": "Qwen 2.5 (72B)"},
    {"id": "mistralai/Mistral-7B-Instruct-v0.3", "provider": "hf",     "label": "Mistral 7B"},
    {"id": "google/gemma-2-27b-it",           "provider": "hf",     "label": "Gemma 2 (27B)"},
    {"id": "meta-llama/Llama-3.3-70B-Instruct", "provider": "hf",     "label": "Llama 3.3 (HF)"},

    # GEMINI - (Fallback only)
    {"id": "gemini-2.0-flash",                "provider": "gemini", "label": "Gemini 2.0 Flash"},
]

current_model_idx = 0

# ── AI Callers ────────────────────────────────────────────────────────────────
def call_hf(model_id: str, prompt: str, history: list, system: str) -> str:
    api_key = _key("HF_API_KEY")
    if not api_key: raise ValueError("HF_API_KEY not set")
    
    messages = [{"role": "system", "content": system}]
    temp_msgs = []
    for h in (history or []):
        h_role = h.get("role", "user").lower()
        role = "assistant" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        if temp_msgs and temp_msgs[-1]["role"] == role:
            temp_msgs[-1]["content"] += "\n" + h.get("content", "")
        else:
            temp_msgs.append({"role": role, "content": h.get("content", "")})
            
    messages.extend(temp_msgs)
    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += "\n" + prompt
    else:
        messages.append({"role": "user", "content": prompt})
    
    print(f"[HF] Calling {model_id}...")
    # Using the new router endpoint
    url = f"https://router.huggingface.co/hf-inference/models/{model_id}/v1/chat/completions"
    resp = req_lib.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model_id, "messages": messages, "max_tokens": 1024, "stream": False},
        timeout=60,
    )
    if resp.status_code != 200: raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]

def call_gemini(model_id: str, prompt: str, history: list, system: str) -> str:
    api_key = _key("GEMINI_API_KEY")
    if not api_key: raise ValueError("GEMINI_API_KEY not set")
    
    client = genai.Client(api_key=api_key)
    
    contents = []
    for h in (history or []):
        # Gemini is extremely picky: roles must alternate user/model
        h_role = h.get("role", "user").lower()
        role = "model" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        
        # Avoid back-to-back same roles by merging content
        if contents and contents[-1].role == role:
            contents[-1].parts[0].text += "\n" + h.get("content", "")
        else:
            contents.append(types.Content(role=role, parts=[types.Part.from_text(h.get("content", ""))]))
    
    # Ensure it ends with user message
    if contents and contents[-1].role == "user":
        contents[-1].parts[0].text += "\n" + prompt
    else:
        contents.append(types.Content(role="user", parts=[types.Part.from_text(prompt)]))
    
    print(f"[GEMINI] Calling {model_id} with {len(contents)} segments...")
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system,
                max_output_tokens=1024,
                temperature=0.7
            )
        )
        if not response.text:
            reason = response.candidates[0].finish_reason if response.candidates else "EMPTY"
            print(f"[GEMINI] Blocked or empty. Finish reason: {reason}")
            raise RuntimeError(f"Gemini returned no text (Reason: {reason})")
        return response.text
    except Exception as e:
        print(f"[GEMINI ERROR] {e}")
        raise

def call_groq(model_id: str, prompt: str, history: list, system: str) -> str:
    api_key = _key("GROQ_API_KEY")
    if not api_key: raise ValueError("GROQ_API_KEY not set")
    
    messages = [{"role": "system", "content": system}]
    temp_msgs = []
    for h in (history or []):
        h_role = h.get("role", "user").lower()
        role = "assistant" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        if temp_msgs and temp_msgs[-1]["role"] == role:
            temp_msgs[-1]["content"] += "\n" + h.get("content", "")
        else:
            temp_msgs.append({"role": role, "content": h.get("content", "")})
    
    messages.extend(temp_msgs)
    if messages and messages[-1]["role"] == "user":
        messages[-1]["content"] += "\n" + prompt
    else:
        messages.append({"role": "user", "content": prompt})

    print(f"[GROQ] Calling {model_id}...")
    resp = req_lib.post(
        "https://api.groq.com/openai/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model_id, "messages": messages, "max_tokens": 1024},
        timeout=30
    )
    if resp.status_code != 200: raise Exception(f"{resp.status_code} {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"]

def get_ai_response(prompt: str, history: list = None, mode: str = "nexus", context: str = "") -> dict:
    global current_model_idx
    prev_label = MODELS[current_model_idx]["label"]
    system = get_system_prompt(mode, context)

    for offset in range(len(MODELS)):
        idx   = (current_model_idx + offset) % len(MODELS)
        model = MODELS[idx]
        try:
            if model["provider"] == "gemini":
                text = call_gemini(model["id"], prompt, history or [], system)
            elif model["provider"] == "groq":
                text = call_groq(model["id"], prompt, history or [], system)
            elif model["provider"] == "hf":
                text = call_hf(model["id"], prompt, history or [], system)
            else: continue
            switched_from     = prev_label if idx != current_model_idx else None
            current_model_idx = idx
            return {"text": text, "label": model["label"], "switched_from": switched_from}
        except Exception as e:
            import traceback
            print(f"[MODEL SKIP] {model['label']}: {e!s:.80}")
            traceback.print_exc()
            continue

    return {"text": "AI unavailable. Check keys.", "label": MODELS[current_model_idx]["label"], "switched_from": None}

# ── Sanitization ─────────────────────────────────────────────────────────────
import re as _re
_BAD_TAG = _re.compile(r'\[(EVIL|ERROR|WARN|INFO|OK|MODEL|IMAGE)[^\]]*\]', _re.IGNORECASE)
def sanitize_ai(text: str) -> str:
    return _BAD_TAG.sub('', text).strip()

# ── Image Generation ──────────────────────────────────────────────────────────
def generate_image(prompt: str) -> str:
    api_key = _key("GEMINI_API_KEY")
    if not api_key: return "[ERROR] GEMINI_API_KEY missing"
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_images(
            model="imagen-3.0-generate-002",
            prompt=prompt,
            config=genai.types.GenerateImagesConfig(number_of_images=1, aspect_ratio="1:1")
        )
        b64 = base64.b64encode(response.generated_images[0].image.image_bytes).decode("utf-8")
        return f"[IMAGE:{b64}]"
    except Exception as e:
        return f"[ERROR] Image failed: {str(e)[:80]}"

# ── Speedtest ─────────────────────────────────────────────────────────────────
def run_speedtest() -> str:
    try:
        import speedtest
        st = speedtest.Speedtest()
        st.get_best_server()
        res = f"Download: {st.download()/1e6:.1f} Mbps | Upload: {st.upload()/1e6:.1f} Mbps"
        return f"\n--- SPEEDTEST ---\n{res}\n"
    except: return "[ERROR] Speedtest failed"

# ── WebSocket — Terminal ──────────────────────────────────────────────────────
@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    await websocket.send_text(f"[MODEL:{MODELS[current_model_idx]['label']}]")

    while True:
        try:
            raw = await websocket.receive_text()
            if raw.strip() == "__ping__": continue
            data = json.loads(raw)
            cmd = data.get("command", "").strip()
            history = data.get("history", [])
            mode = data.get("mode", "nexus")
            context = data.get("context", "")
            print(f"[WS] IN: cmd={cmd[:50]!r} mode={mode} hist_len={len(history)}")
        except Exception as e:
            print(f"[WS] Read error: {e}")
            break

        if not cmd: continue

        try:
            if cmd == "status":
                await websocket.send_text(f"CPU: {psutil.cpu_percent()}% | MEM: {psutil.virtual_memory().percent}% | AI: ONLINE")
            elif cmd == "models":
                lines = "\n".join(f" {'→' if i==current_model_idx else ' '} {i+1}. {m['label']}" for i,m in enumerate(MODELS))
                await websocket.send_text(f"\nAVAILABLE MODELS:\n{lines}\n")
            elif cmd.startswith("model "):
                try:
                    idx = int(cmd.split()[1]) - 1
                    if 0 <= idx < len(MODELS):
                        current_model_idx = idx
                        await websocket.send_text(f"[MODEL:{MODELS[idx]['label']}]")
                        await websocket.send_text(f"Switched to {MODELS[idx]['label']}")
                except: await websocket.send_text("Invalid model number.")
            elif cmd == "speedtest":
                await websocket.send_text("Running speedtest...")
                await websocket.send_text(await asyncio.get_running_loop().run_in_executor(None, run_speedtest))
            elif cmd.startswith("image "):
                prompt = cmd.removeprefix("image ").strip()
                await websocket.send_text("Generating image...")
                await websocket.send_text(await asyncio.get_running_loop().run_in_executor(None, generate_image, prompt))
            elif cmd in ["monitor", "play pong", "play breach", "play wordle"]:
                tag = cmd.split()[-1]
                await websocket.send_text(f"[TRIGGER:{tag}]\nInitializing {tag}...")
            else:
                try:
                    print(f"[AI] Generating response for: {cmd!r} (Mode: {mode})")
                    result = await asyncio.wait_for(
                        asyncio.get_running_loop().run_in_executor(None, get_ai_response, cmd, history, mode, context),
                        timeout=40.0
                    )
                    
                    if not result or not result.get("text"):
                        print(f"[AI] Backend returned null result for: {cmd!r}")
                        await websocket.send_text("[ERROR] AI failed to generate a response. Try switching models.")
                        continue

                    if result.get("switched_from"): await websocket.send_text(f"[MODEL:{result['label']}]")
                    
                    clean_text = sanitize_ai(result["text"])
                    if not clean_text:
                        print(f"[AI] Sanitized result was empty for: {cmd!r}")
                        await websocket.send_text("[SYSTEM] Response was filtered or empty.")
                    else:
                        print(f"[AI] Sending response: {clean_text[:50]!r}...")
                        await websocket.send_text(clean_text)

                except asyncio.TimeoutError:
                    print(f"[AI] TIMEOUT (40s) for: {cmd!r}")
                    await websocket.send_text("[ERROR] Request timed out after 40s. Model might be overloaded.")
                except Exception as e:
                    import traceback
                    print(f"[AI] CRITICAL ERROR: {e}")
                    traceback.print_exc()
                    await websocket.send_text(f"[ERROR] AI Engine failure: {str(e)[:100]}")
        except Exception as e:
            print(f"[ERROR] {e}")
            await websocket.send_text(f"[ERROR] {str(e)[:100]}")

# ── WebSocket — Stats ─────────────────────────────────────────────────────────
@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # interval=None is non-blocking
            cpu = psutil.cpu_percent(interval=None)
            mem = psutil.virtual_memory().percent
            await websocket.send_text(json.dumps({"cpu": cpu, "mem": mem}))
            await asyncio.sleep(2)
    except Exception as e:
        print(f"[STATS WS] Closed: {e}")
