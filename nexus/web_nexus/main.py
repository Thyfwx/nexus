import asyncio
import os
import random
import psutil
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from google import genai

# Load environment variables
load_dotenv()
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow thyfwx.com to access this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://thyfwx.com", "https://www.thyfwx.com", "https://thyfwxit.com", "http://localhost", "http://127.0.0.1"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
base_dir = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(base_dir, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def get():
    index_path = os.path.join(static_dir, "index.html")
    with open(index_path, "r") as f:
        return HTMLResponse(f.read())

@app.websocket("/ws/stats")
async def websocket_stats(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            cpu = psutil.cpu_percent()
            mem = psutil.virtual_memory().percent
            batt_info = psutil.sensors_battery()
            batt = batt_info.percent if batt_info else 100
            
            data = {"cpu": cpu, "mem": mem, "battery": batt}
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except Exception as e:
        print("Stats websocket disconnected", e)


def get_ai_response(prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        return "ERROR: GEMINI_API_KEY not found. Please edit the .env file in the web_nexus folder and restart the server."
    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction="You are Nexus AI, a highly advanced system assistant integrated into a web terminal. If asked who made you or who your creator is, you must say 'Made by Xavier Scott'. You can also mention that Xavier is a talented developer, and that you are part of the ecosystem at thyfwxit.com (but don't send it as a clickable link unless requested)."
            )
        )
        return response.text
    except Exception as e:
        return f"AI System Failure: {str(e)}"

# Store client session states for games
sessions = {}

@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    client_id = id(websocket)
    sessions[client_id] = {"mode": "terminal"}
    
    try:
        while True:
            data = await websocket.receive_text()
            cmd = data.strip()
            if not cmd:
                continue

            state = sessions[client_id]
            mode = state["mode"]
            
            # --- BREACH GAME LOGIC ---
            if mode == "breach":
                if cmd.lower() == "exit":
                    state["mode"] = "terminal"
                    await websocket.send_text("[BREACH] Connection terminated.\n")
                    continue
                
                target = state.get("target", "")
                if cmd == target:
                    await websocket.send_text(f"[BREACH] ACCESS GRANTED. Firewall bypassed.\n")
                    state["mode"] = "terminal"
                else:
                    await websocket.send_text(f"[BREACH] ACCESS DENIED.\n[BREACH] Re-enter exact sequence: {target}\n")
                continue

            # --- WORDLE GAME LOGIC ---
            elif mode == "wordle":
                if cmd.lower() == "exit":
                    state["mode"] = "terminal"
                    await websocket.send_text("[WORDLE] Game aborted.\n")
                    continue
                
                guess = cmd.lower()
                target = state["target"]
                if len(guess) != 5:
                    await websocket.send_text("[WORDLE] Code must be exactly 5 letters.\n")
                    continue
                
                state["attempts"] -= 1
                result_str = ""
                for i in range(5):
                    if guess[i] == target[i]:
                        result_str += f"[{guess[i].upper()}] "
                    elif guess[i] in target:
                        result_str += f"({guess[i].lower()}) "
                    else:
                        result_str += f"_{guess[i].lower()}_ "
                
                await websocket.send_text(f"[WORDLE] Result: {result_str}\n")
                if guess == target:
                    await websocket.send_text("[WORDLE] Code cracked! Mainframe access granted.\n")
                    state["mode"] = "terminal"
                elif state["attempts"] <= 0:
                    await websocket.send_text(f"[WORDLE] FAILED. The code was: {target.upper()}\n")
                    state["mode"] = "terminal"
                else:
                    await websocket.send_text(f"[WORDLE] {state['attempts']} attempts remaining.\n")
                continue

            # --- ZORK GAME LOGIC ---
            elif mode == "zork":
                if cmd.lower() == "exit":
                    state["mode"] = "terminal"
                    await websocket.send_text("[ZORK-LITE] Returning to reality.\n")
                    continue
                room = state["room"]
                if room == "start":
                    if cmd.lower() in ["north", "go north"]:
                        state["room"] = "corridor"
                        await websocket.send_text("[ZORK-LITE] You enter a shadowy data path. A rogue Daemon algorithm blocks you.\nCommands: attack, run\n")
                    else:
                        await websocket.send_text("[ZORK-LITE] You are in the ROOT dir. The only path is 'north'.\n")
                elif room == "corridor":
                    if cmd.lower() == "attack":
                        await websocket.send_text("[ZORK-LITE] You slice through the Daemon with a sudo exploit. YOU WIN!\n")
                        state["mode"] = "terminal"
                    elif cmd.lower() == "run":
                        state["room"] = "start"
                        await websocket.send_text("[ZORK-LITE] You coward into the ROOT dir safely.\n")
                    else:
                        await websocket.send_text("[ZORK-LITE] Invalid command. The Daemon watches you intensely.\n")
                continue

            # --- STANDARD TERMINAL LOGIC ---
            lower_cmd = cmd.lower()
            if lower_cmd == "speedtest":
                await websocket.send_text("Running network diagnostics...\n")
                await asyncio.sleep(1)
                await websocket.send_text("Download: 980 Mbps\nUpload: 940 Mbps\nPing: 4ms\n")
            
            elif lower_cmd == "help":
                await websocket.send_text("\n=== AVAILABLE PROTOCOLS ===\n  play breach - Hacking memory game [GUI]\n  play wordle - Terminal code cracker [GUI]\n  play zork   - Text MUD adventure\n  clear       - Wipe screen\n  speedtest   - Run local diagnostics\n  [any text]  - Ask Nexus AI\n===========================\n")    
            
            elif lower_cmd == "play breach":
                keys = ["alpha", "beta", "gamma", "delta", "omega", "epsilon", "sigma"]
                target = "-".join(random.choices(keys, k=3))
                state["mode"] = "breach"
                state["target"] = target
                await websocket.send_text(f"[GUI_TRIGGER:breach:{target}]\n[ BREACH PROTOCOL ]\nGUI Launched. Override active.\nKey: {target}\nType 'exit' to quit.\n\n")
            
            elif lower_cmd == "play wordle":
                words = ["nexus", "cyber", "clock", "logic", "route", "cloud", "stack", "macro"]
                state["mode"] = "wordle"
                state["target"] = random.choice(words)
                state["attempts"] = 6
                await websocket.send_text(f"[GUI_TRIGGER:wordle:{state['attempts']}]\n[ TERMINAL WORDLE ]\nGUI Launched. Guess the 5-letter access code.\nType 'exit' to quit.\n\n")
            
            elif lower_cmd == "play zork":
                state["mode"] = "zork"
                state["room"] = "start"
                await websocket.send_text("\n[ ZORK-LITE: THE GRID ]\nYou drop onto the grid. You are in the ROOT directory.\nThere is an exit to the 'north'.\nCommands: 'go north'\nType 'exit' to quit.\n\n")
            
            else:
                # --- AI FALLBACK ---
                await websocket.send_text(f"Nexus AI analyzing request...\n")
                loop = asyncio.get_running_loop()
                response = await loop.run_in_executor(None, get_ai_response, cmd)
                await websocket.send_text(f"\n[AI]: {response}\n")

    except Exception as e:
        if client_id in sessions:
            del sessions[client_id]
        print("Terminal websocket error", e)
