import asyncio
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
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

base_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def get():
    index_path = os.path.join(static_dir, "index.html")
    with open(index_path, "r") as f:
        return HTMLResponse(f.read())

def get_ai_response(prompt: str, history: list = None) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key: return "ERROR: API KEY MISSING."
    try:
        client = genai.Client(api_key=api_key)
        contents = []
        if history:
            for h in history:
                contents.append({"role": h["role"], "parts": [{"text": h["content"]}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=contents,
            config=genai.types.GenerateContentConfig(
                system_instruction=(
                    "You are Nexus AI, created by Xavier Scott. You have root access to this terminal. "
                    "You can trigger UI actions by including these tags in your response: "
                    "[TRIGGER:pong] to open Pong, [TRIGGER:monitor] to open the hardware graph, "
                    "[TRIGGER:clear] to wipe the screen, [TRIGGER:accessibility] to toggle large text. "
                    "Be professional, cyberpunk-styled, and helpful. Maintain context using history."
                )
            )
        )
        return response.text
    except Exception as e:
        return f"AI Error: {str(e)}"

@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    try:
        # Greeting
        await websocket.send_text("Uplink Established. Nexus AI Online.\nType 'help' for available protocols.\n")
        
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                cmd = data.get("command", "").lower()
                history = data.get("history", [])
            except:
                cmd = raw_data.lower()
                history = []

            if not cmd: continue

            if cmd == "status":
                cpu = psutil.cpu_percent()
                mem = psutil.virtual_memory().percent
                await websocket.send_text(f"\n--- NEXUS SYSTEM STATUS ---\nCPU LOAD: {cpu}%\nMEMORY USAGE: {mem}%\nNETWORK: STABLE\nAI KERNEL: ACTIVE\n")
            elif cmd == "monitor":
                await websocket.send_text("[TRIGGER:monitor]\nOpening System Telemetry...")
            elif cmd == "play pong":
                await websocket.send_text("[TRIGGER:pong]\nInitializing Pong GUI...")
            elif cmd == "play breach":
                await websocket.send_text("[TRIGGER:breach]\nLoading Breach Protocol...")
            elif cmd == "play wordle":
                await websocket.send_text("[TRIGGER:wordle]\nStarting Wordle cipher...")
            elif cmd == "about":
                await websocket.send_text("\n--- ABOUT NEXUS ---\nNexus is an advanced AI-integrated command-line environment.\nCreated by: Xavier Scott\nEcosystem: thyfwxit.com\nVersion: 3.0.0-Flash\n")
            elif cmd == "help":
                await websocket.send_text("\n=== PROTOCOLS ===\n  play pong\n  play breach\n  play wordle\n  monitor\n  status\n  about\n  clear\n=================\n")
            else:
                loop = asyncio.get_running_loop()
                resp = await loop.run_in_executor(None, get_ai_response, cmd, history)
                await websocket.send_text(resp)
    except Exception as e:
        print("WS Error:", e)
