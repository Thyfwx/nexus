import asyncio
import base64
import os
import json
import uuid
import psutil
import shutil
import re
import traceback
import requests as req_lib
import jwt
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, WebSocket, Request
from fastapi.responses import RedirectResponse, JSONResponse as _JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from google import genai
from google.genai import types
from google.oauth2 import id_token
from google.auth.transport import requests as g_req

# Pathing
base_dir   = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "static")

# Environment
_ENV_PATH = os.path.join(base_dir, '.env')
if os.path.exists(_ENV_PATH):
    load_dotenv(_ENV_PATH)

# Use timezone.utc for compatibility and correctness
UTC = timezone.utc

def _key(name: str) -> str:
    """Read key from environment."""
    return os.environ.get(name, '').strip().strip('"').strip("'").strip()

def _get_session(request: Request):
    """Decode and return the session JWT payload, or None if missing/invalid."""
    token = request.cookies.get("nexus_session")
    if not token:
        return None
    try:
        key = _key("SECRET_KEY") or "nexus-dev-please-change-in-prod"
        return jwt.decode(token, key, algorithms=["HS256"])
    except Exception:
        return None

# Better CORS and Security Headers
app = FastAPI()

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Strict CSP: Only allow Google, Cloudflare, and ourselves
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://static.cloudflareinsights.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: https://*.googleusercontent.com https://*.agilebits.com; "
        "connect-src 'self' https://nexus-terminalnexus.onrender.com wss://nexus-terminalnexus.onrender.com https://api.groq.com https://router.huggingface.co; "
        "frame-src https://accounts.google.com;"
    )
    response.headers["Content-Security-Policy"] = csp
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://thyfwxit.com", "https://nexus-terminalnexus.onrender.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# 1. PRIORITY ROUTES (API & WS)
@app.get("/ping")
async def ping():
    return {"ok": True}

@app.get("/api/config")
async def get_config():
    return {"google_client_id": _key("GOOGLE_CLIENT_ID")}

@app.post("/api/report")
async def report_error(request: Request):
    try:
        data = await request.json()
        report = data.get("report", "No report data")
        user   = _get_session(request)
        user_name = user["name"] if user else "Anonymous"
        
        print(f"\n[DIAGNOSTIC REPORT] From: {user_name}")
        print(f"Destination: xavier@thyfwxit.com")
        print(f"--- START ---\n{report}\n--- END ---\n")
        
        # We log to server console for Xavier to read. 
        # No external webhooks used for security.
            
        return {"ok": True, "message": "Diagnostic transmitted to Nexus Command."}
    except Exception as e:
        print(f"[ERROR] Reporting failed: {e}")
        return _JSONResponse({"error": "Transmission failure"}, status_code=500)

@app.post("/login/google/authorized")
async def auth_google(request: Request):
    raw_id = _key("GOOGLE_CLIENT_ID")
    # Pacific Shield: Extract ONLY the valid Client ID part using regex
    match = re.search(r"[0-9-]+[a-z0-9]+\.apps\.googleusercontent\.com", raw_id)
    client_id = match.group(0) if match else raw_id.split(',')[0].split(' ')[0].strip()
    
    is_prod = os.getenv("PRODUCTION", "") == "1"
    
    print(f"[AUTH] Login Attempt. Clean ID: {client_id[:15]}... Full: {client_id}")
    
    if not client_id:
        print("[ERROR] GOOGLE_CLIENT_ID is missing from environment!")
        return _JSONResponse({"error": "Google auth not configured on server"}, status_code=503)

    # Handle both JSON (popup) and Form-Encoded (redirect)
    content_type = request.headers.get("content-type", "")
    credential = ""
    is_redirect = "application/x-www-form-urlencoded" in content_type

    if is_redirect:
        form_data = await request.form()
        credential = form_data.get("credential", "")
    else:
        data = await request.json()
        credential = data.get("credential", "")

    if not credential:
        return _JSONResponse({"error": "No credential"}, status_code=400)

    try:
        # Diagnostic: Print IDs (masked) to compare
        expected_id = client_id
        print(f"[AUTH] Verifying token. Expected Audience: {expected_id[:15]}...")
        
        idinfo = id_token.verify_oauth2_token(credential, g_req.Request(), expected_id)
        
        # Verify the audience matches exactly
        if idinfo['aud'] != expected_id:
            print(f"[ERROR] Audience mismatch! Token aud: {idinfo['aud']} vs Expected: {expected_id}")
            return _JSONResponse({"error": "Identity mismatch: Audience error"}, status_code=401)
            
    except Exception as e:
        print(f"[ERROR] Token validation failed: {str(e)}")
        return _JSONResponse({"error": f"Token invalid: {str(e)[:100]}"}, status_code=401)

    payload = {
        "sub":     idinfo["sub"],
        "name":    idinfo.get("name", "Player"),
        "email":   idinfo.get("email", ""),
        "picture": idinfo.get("picture", ""),
        "exp":     datetime.now(UTC) + timedelta(days=30),
    }
    token = jwt.encode(payload, _key("SECRET_KEY") or os.getenv("SECRET_KEY", "nexus-dev-please-change-in-prod"), algorithm="HS256")
    is_prod = os.getenv("PRODUCTION", "") == "1"

    # Log login event
    log_login(payload["name"], payload["email"], request)

    if is_redirect:
        # Traditional Redirect: Return to home with cookie set
        resp = RedirectResponse(url="/", status_code=303)
    else:
        # Popup Flow: Return JSON
        resp = _JSONResponse({
            "ok":      True,
            "name":    payload["name"],
            "email":   payload["email"],
            "picture": payload["picture"],
        })

    # Robust cookie settings for Render/HTTPS
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    samesite = "lax" 
    secure   = True if is_https else False

    resp.set_cookie("nexus_session", token, httponly=True, samesite=samesite,
                    max_age=30 * 24 * 3600, secure=secure)
    return resp

# Basic profanity list (expandable)
PROFANITY = [
    "fuck", "shit", "bitch", "cunt", "nigger", "nigga", "faggot", "asshole", 
    "dick", "pussy", "cock", "slut", "whore", "retard", "rape", "porn", 
    "bastard", "hitler", "nazi"
]

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
        "exp":     datetime.now(UTC) + timedelta(days=30),
    }
    
    token = jwt.encode(payload, _key("SECRET_KEY") or os.getenv("SECRET_KEY", "nexus-dev-please-change-in-prod"), algorithm="HS256")
    is_prod = os.getenv("PRODUCTION", "") == "1"

    # Log login event
    log_login(payload["name"], payload["email"], request)

    resp = _JSONResponse({
        "ok":      True,
        "name":    payload["name"],
        "email":   payload["email"],
        "picture": payload["picture"],
    })

    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    samesite = "lax"
    secure   = True if is_https else False

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

@app.get("/api/diagnostics")
async def get_diagnostics():
    try:
        cpu = psutil.cpu_percent(interval=None)
        mem = psutil.virtual_memory().percent
        disk = shutil.disk_usage("/")
        
        # Get last 50 logins
        logs = []
        if os.path.exists(LOGIN_LOG_FILE):
            with open(LOGIN_LOG_FILE, "r") as f:
                logs = json.load(f)[-50:]
                
        return {
            "system": {
                "cpu_percent": cpu,
                "mem_percent": mem,
                "disk_total": disk.total,
                "disk_used": disk.used,
                "disk_free": disk.free,
                "status": "HEALTHY"
            },
            "recent_logins": logs,
            "timestamp": datetime.now(UTC).isoformat()
        }
    except Exception as e:
        return {"status": "ERROR", "message": str(e)}

LOGIN_LOG_FILE = os.path.join(base_dir, "logins.json")

def log_login(name: str, email: str, request: Request):
    """Log the user's login event with IP, Device, and Traffic Source."""
    try:
        ip = request.client.host if request.client else "unknown"
        ua = request.headers.get("user-agent", "unknown")
        referer = request.headers.get("referer", "direct")
        origin = request.headers.get("origin", "unknown")
        
        entry = {
            "timestamp": datetime.now(UTC).isoformat(),
            "name": name,
            "email": email,
            "ip": ip,
            "user_agent": ua,
            "source": referer,
            "origin": origin
        }
        
        logs = []
        if os.path.exists(LOGIN_LOG_FILE):
            try:
                with open(LOGIN_LOG_FILE, "r") as f:
                    logs = json.load(f)
            except:
                pass
        
        logs.append(entry)
        
        # Keep only the last 1000 logins
        logs = logs[-1000:]
        
        with open(LOGIN_LOG_FILE, "w") as f:
            json.dump(logs, f, indent=2)
            
        print(f"[AUTH] Logged login: {name} ({email}) from {ip}")
    except Exception as e:
        print(f"[ERROR] Failed to log login: {e}")


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
            existing["date"]  = datetime.now(UTC).strftime("%Y-%m-%d")
            existing["picture"] = user.get("picture", "") # Keep picture current
    else:
        all_scores[game].append({
            "sub":   user_sub,
            "name":  user_name,
            "picture": user.get("picture", ""), # Store picture
            "score": score,
            "date":  datetime.now(UTC).strftime("%Y-%m-%d"),
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
    {"id": "llama-3.1-8b-instant",            "provider": "groq",   "label": "Nexus Lite (8B)"},
    {"id": "mixtral-8x7b-32768",              "provider": "groq",   "label": "Mixtral Speed"},
    
    # HF - Massive Brains (User Preferred)
    {"id": "deepseek-ai/DeepSeek-Coder-V2-Instruct", "provider": "hf",     "label": "DeepSeek Coder V2"},
    {"id": "Qwen/Qwen2.5-72B-Instruct",       "provider": "hf",     "label": "Qwen 2.5 (72B)"},
    {"id": "meta-llama/Llama-3.3-70B-Instruct", "provider": "hf",     "label": "Llama 3.3 (HF)"},

    # GEMINI - (Fallback only)
    {"id": "gemini-2.0-flash",                "provider": "gemini", "label": "Gemini 2.0 Flash"},
]

current_model_idx = 0

# ── AI Callers ────────────────────────────────────────────────────────────────
def call_hf(model_id: str, prompt: str, history: list | None, system: str) -> str:
    api_key = _key("HF_API_KEY")
    if not api_key: raise ValueError("HF_API_KEY not set")
    
    messages = [{"role": "system", "content": system}]
    temp_msgs = []
    for h in (history or []):
        if not h or not isinstance(h, dict): continue
        h_role = str(h.get("role", "user")).lower()
        role = "assistant" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        content = str(h.get("content", ""))
        if temp_msgs and temp_msgs[-1]["role"] == role:
            temp_msgs[-1]["content"] += "\n" + content
        else:
            temp_msgs.append({"role": role, "content": content})
            
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

def call_gemini(model_id: str, prompt: str, history: list | None, system: str) -> str:
    api_key = _key("GEMINI_API_KEY")
    if not api_key: raise ValueError("GEMINI_API_KEY not set")
    
    client = genai.Client(api_key=api_key)
    
    contents = []
    for h in (history or []):
        if not h or not isinstance(h, dict): continue
        h_role = str(h.get("role", "user")).lower()
        role = "model" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        content = str(h.get("content", ""))
        
        if contents and contents[-1].role == role:
            # Append to last message if same role
            existing_parts = contents[-1].parts
            if existing_parts and len(existing_parts) > 0:
                # Use str() to ensure Pylance recognizes the type
                current_text = str(existing_parts[0].text or "")
                existing_parts[0].text = current_text + "\n" + content
        else:
            # Create new content block using keyword arguments to satisfy Pylance
            part = types.Part(text=content)
            contents.append(types.Content(role=role, parts=[part]))
    
    # Ensure it ends with user message
    if contents and contents[-1].role == "user":
        # Safe access to parts
        last_parts = contents[-1].parts
        if last_parts and len(last_parts) > 0:
            current_prompt_text = str(last_parts[0].text or "")
            last_parts[0].text = current_prompt_text + "\n" + prompt
    else:
        contents.append(types.Content(role="user", parts=[types.Part(text=prompt)]))
    
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

def call_groq(model_id: str, prompt: str, history: list | None, system: str) -> str:
    api_key = _key("GROQ_API_KEY")
    if not api_key: raise ValueError("GROQ_API_KEY not set")
    
    messages = [{"role": "system", "content": system}]
    temp_msgs = []
    for h in (history or []):
        if not h or not isinstance(h, dict): continue
        h_role = str(h.get("role", "user")).lower()
        role = "assistant" if h_role in ["assistant", "model", "ai", "nexus"] else "user"
        content = str(h.get("content", ""))
        if temp_msgs and temp_msgs[-1]["role"] == role:
            temp_msgs[-1]["content"] += "\n" + content
        else:
            temp_msgs.append({"role": role, "content": content})
    
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

@app.get("/api/status")
async def get_status():
    """Hidden diagnostic to check if keys are loaded (masked for security)."""
    return {
        "groq_loaded": bool(_key("GROQ_API_KEY")),
        "hf_loaded":   bool(_key("HF_API_KEY")),
        "gemini_loaded": bool(_key("GEMINI_API_KEY")),
        "google_id":   bool(_key("GOOGLE_CLIENT_ID"))
    }

def prompt_ai(prompt: str, history: list | None = None, mode: str = "nexus", context: str = "") -> dict:
    """Main entry point for AI responses. Cycles through models until one works."""
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
            print(f"[MODEL SKIP] {model['label']}: {e}")
            continue

    return {"text": "AI UPLINK FAILURE: All providers (Groq/Gemini/HF) are offline. Check server API keys.", "label": "ERROR", "switched_from": None}

# ── Sanitization ─────────────────────────────────────────────────────────────
_BAD_TAG = re.compile(r'\[(EVIL|ERROR|WARN|INFO|OK|MODEL|IMAGE)[^\]]*\]', re.IGNORECASE)
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
        if not response or not response.generated_images:
            return "[ERROR] Image engine returned no results"
            
        img = response.generated_images[0]
        if not img or not hasattr(img, 'image') or not img.image:
            return "[ERROR] Image data is corrupted or missing"

        raw_bytes = img.image.image_bytes
        if not isinstance(raw_bytes, (bytes, bytearray)):
            return "[ERROR] Invalid image data format"

        b64 = base64.b64encode(raw_bytes).decode("utf-8")
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
    global current_model_idx
    await websocket.accept()
    print("[WS] Client connected")
    await websocket.send_text(f"[MODEL:{MODELS[current_model_idx]['label']}]")
    await websocket.send_text("[SYSTEM] Uplink established. Nexus Core ready.")

    while True:
        try:
            raw = await websocket.receive_text()
            if raw.strip() == "__ping__": 
                await websocket.send_text("__pong__")
                continue
            data = json.loads(raw)
            # Handle both 'command' and 'cmd' for better frontend compatibility
            cmd = (data.get("command") or data.get("cmd") or "").strip()
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
                    # Fix: Use prompt_ai instead of get_ai_response
                    result = await asyncio.wait_for(
                        asyncio.get_running_loop().run_in_executor(None, prompt_ai, cmd, history, mode, context),
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

# Mount static files at the end so they don't override API routes
app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
