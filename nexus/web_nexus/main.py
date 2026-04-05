import asyncio
import psutil
from fastapi import FastAPI, WebSocket
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def get():
    with open("static/index.html", "r") as f:
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
            
            data = {
                "cpu": cpu,
                "mem": mem,
                "battery": batt
            }
            await websocket.send_json(data)
            await asyncio.sleep(2)
    except Exception as e:
        print("Stats websocket disconnected", e)

@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    await websocket.accept()
    # Basic skeleton for chat / commands
    try:
        while True:
            data = await websocket.receive_text()
            # Here we would integrate Gemini and OS commands
            # For now, echo back a terminal response
            if data.lower() == "speedtest":
                await websocket.send_text("Running speedtest...\n")
                await asyncio.sleep(2)
                await websocket.send_text("Download: 420 Mbps\nUpload: 69 Mbps\n")
            elif data.lower() == "help":
                await websocket.send_text("Nexus Help:\n- speedtest: Run network benchmark\n- help: Show this message\n- [any text]: Chat with AI\n")    
            else:
                await websocket.send_text(f"Nexus AI analyzing: {data}\n")
    except Exception as e:
        print("Terminal websocket disconnected", e)
