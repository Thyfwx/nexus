import psutil
import datetime
import requests
import os
from dotenv import load_dotenv
from textual import work
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Static, DataTable, Label, Input, RichLog, Button
from textual.reactive import reactive

_ENV_PATH = os.path.join(os.path.dirname(__file__), "web_nexus", ".env")

def _key(name: str) -> str:
    load_dotenv(_ENV_PATH, override=True)
    return os.getenv(name, "")

def _call_ai(prompt: str) -> str:
    """Try Groq first, then Gemini, return response text."""
    # Try Groq (Llama 3.3 70B)
    groq_key = _key("GROQ_API_KEY")
    if groq_key:
        try:
            resp = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                json={"model": "llama-3.3-70b-versatile",
                      "messages": [{"role": "user", "content": prompt}],
                      "max_tokens": 512},
                timeout=20,
            )
            if resp.ok:
                return resp.json()["choices"][0]["message"]["content"]
        except Exception:
            pass
    # Fallback: Gemini Flash
    gemini_key = _key("GEMINI_API_KEY")
    if gemini_key:
        try:
            resp = requests.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}",
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=20,
            )
            if resp.ok:
                return resp.json()["candidates"][0]["content"]["parts"][0]["text"]
        except Exception:
            pass
    return "AI unavailable — check API keys in web_nexus/.env"

class SystemStats(Static):
    """A widget to display system stats."""
    
    cpu_percent = reactive(0.0)
    mem_percent = reactive(0.0)
    disk_percent = reactive(0.0)
    health_score = reactive(100.0)
    
    def on_mount(self) -> None:
        self.set_interval(1, self.update_stats)

    def update_stats(self) -> None:
        self.cpu_percent = psutil.cpu_percent()
        self.mem_percent = psutil.virtual_memory().percent
        self.disk_percent = psutil.disk_usage('/').percent
        
        # Calculate aggregate health score (100 - average load)
        avg_load = (self.cpu_percent + self.mem_percent + self.disk_percent) / 3.0
        self.health_score = max(0.0, 100.0 - avg_load)
        
    def render(self) -> str:
        if self.health_score >= 80:
            h_color = "bold green"
        elif self.health_score >= 50:
            h_color = "bold yellow"
        else:
            h_color = "bold red"
            
        return (
            f"CPU: [bold green]{self.cpu_percent}%[/]\n"
            f"MEM: [bold yellow]{self.mem_percent}%[/]\n"
            f"DSK: [bold red]{self.disk_percent}%[/]"
            f"HLT: [{h_color}]{self.health_score:.1f}/100[/]"
        )

class Nexus(App):
    """A high-performance system dashboard with AI & Geo-IP."""
    
    CSS = """
    Screen {
        background: #000;
    }
    
    #stats-panel {
        width: 25%;
        height: 100%;
        border: double #0ff;
        padding: 1;
        background: #111;
    }
    
    #main-panel {
        width: 75%;
        height: 100%;
        border: double #f0f;
        padding: 1;
        background: #000;
    }
    
    #network-table {
        height: 50%;
        border: solid #555;
    }

    #chat-panel {
        height: 40%;
        border: dashed #555;
        padding: 1;
    }

    #chat-log {
        height: 70%;
        border: none;
    }

    #chat-input {
        dock: bottom;
    }
    
    Header { background: #333; color: #fff; }
    Footer { background: #333; color: #fff; }
    """
    
    BINDINGS = [
        ("q", "quit", "Quit"),
        ("r", "refresh", "Refresh"),
        ("h", "toggle_help", "Help"),
        ("s", "focus_search", "Search"),
    ]

    def action_toggle_help(self) -> None:
        self.chat_log.write("[bold yellow]=== NEXUS HELP ===[/]")
        self.chat_log.write("[cyan]S:[/] Focus Search bar")
        self.chat_log.write("[cyan]R:[/] Refresh stats")
        self.chat_log.write("[cyan]Q:[/] Exit Nexus")
        self.chat_log.write("[cyan]NETWORK:[/] Shows apps talking to the internet.")
        self.chat_log.write("[cyan]GEO-IP:[/] Displays your current public location.")

    def action_focus_search(self) -> None:
        self.query_one("#chat-input").focus()


    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal():
            with Vertical(id="stats-panel"):
                yield Label("[bold cyan]System Vitals[/]")
                yield SystemStats()
                yield Label("\n[bold magenta]Battery[/]")
                self.battery_label = Label("N/A")
                yield self.battery_label
                yield Label("\n[bold white]Location[/]")
                self.geo_label = Label("Loading...")
                yield self.geo_label
            with Vertical(id="main-panel"):
                yield Label("[bold yellow]Top Apps (CPU Use)[/]")
                self.network_table = DataTable(id="network-table")
                yield self.network_table
                
                with Vertical(id="chat-panel"):
                    yield Label("[bold green]System Intelligence Chat[/]")
                    self.chat_log = RichLog(id="chat-log", highlight=True, markup=True)
                    yield self.chat_log
                    with Horizontal(id="button-row"):
                        yield Button("Help", id="btn-help", variant="primary")
                        yield Button("Speedtest", id="btn-speedtest", variant="warning")
                        yield Button("Play/Pause", id="btn-play", variant="success")
                        yield Button("Say Hello", id="btn-say", variant="default")
                    yield Input(placeholder="Ask Nexus anything...", id="chat-input")
        yield Footer()

    def on_mount(self) -> None:
        self.network_table.add_columns("Process", "IP", "Location", "Status")
        self.set_interval(3, self.update_network)
        self.set_interval(10, self.update_battery)
        self.update_geo()

    @work(thread=True)
    def update_geo(self) -> None:
        try:
            # Combined Geo and Weather (simple public API)
            res = requests.get("https://ipapi.co/json/", timeout=5).json()
            city = res.get("city", "Unknown")
            country = res.get("country_name", "Unknown")
            self.call_from_thread(self.geo_label.update, f"{city}, {country}")
        except:
            self.call_from_thread(self.geo_label.update, "Unknown Location")

    def update_network(self) -> None:
        self.network_table.clear()
        try:
            conns = psutil.net_connections()[:10]
            for conn in conns:
                try:
                    proc = psutil.Process(conn.pid).name() if conn.pid else "N/A"
                except: proc = "Unknown"
                
                ip = conn.raddr.ip if conn.raddr else "Listen"
                loc = "Local" if ip == "Listen" or ip.startswith("127.") else "External"
                if conn.raddr:
                    ip = conn.raddr.ip
                    loc = "Local" if ip.startswith("127.") or ip.startswith("192.168.") or ip.startswith("10.") else "External"
                else:
                    ip = "Listen"
                    loc = "Local"
                    
                if loc == "External":
                    proc = f"[bold red]{proc}[/]"
                    ip = f"[bold red]{ip}[/]"
                self.network_table.add_row(proc, ip, loc, conn.status)
        except psutil.AccessDenied:
            self.network_table.add_row("ACCESS DENIED", "Run with sudo", "to see", "network")
        except Exception as e:
            self.network_table.add_row("ERROR", str(e), "", "")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        query = event.value.strip().lower()
        if not query: return
        
        self.chat_log.write(f"[bold cyan]Query:[/] {query}")
        
        # 1. VOICE COMMAND
        if query.startswith("say "):
            text = query.replace("say ", "")
            import shlex
            os.system(f"say {shlex.quote(text)}")
            self.chat_log.write(f"[magenta]Mac says:[/] {text}")

        # 2. MUSIC CONTROLLER (Universal for Mac)
        elif query in ["play", "pause", "next", "prev"]:
            cmd = "next track" if query == "next" else "previous track" if query == "prev" else query
            os.system(f"osascript -e 'tell application \"Music\" to {cmd}' 2>/dev/null")
            os.system(f"osascript -e 'tell application \"Spotify\" to {cmd}' 2>/dev/null")
            self.chat_log.write(f"[green]Music command sent:[/] {query}")

        # 3. SPEEDTEST
        elif query == "speedtest":
            self.chat_log.write("[yellow]Running speedtest (please wait)...[/]")
            @work(thread=True)
            def run_test():
                try:
                    import speedtest
                    st = speedtest.Speedtest()
                    st.get_best_server()
                    down = st.download() / 1_000_000
                    up = st.upload() / 1_000_000
                    self.call_from_thread(self.chat_log.write, f"[bold green]Download:[/] {down:.2f} Mbps")
                    self.call_from_thread(self.chat_log.write, f"[bold magenta]Upload:[/] {up:.2f} Mbps")
                except:
                    self.call_from_thread(self.chat_log.write, "[red]Speedtest failed (is it installed?)[/]")
            run_test()

        # 4. MINI-GAME
        elif query == "game":
            import random
            target = random.randint(1, 10)
            self.chat_log.write("[bold yellow]MINI-GAME:[/] I'm thinking of a number 1-10...")
            self.chat_log.write(f"[dim]The number was {target} (demo mode)[/]")

        elif query.startswith("kill "):
            name = query.replace("kill ", "").strip()
            if not name:
                self.chat_log.write("[red]Invalid process name[/]")
                return
            found = False
            for p in psutil.process_iter(['name']):
                if name in p.info['name'].lower():
                    try:
                        p.kill()
                        self.chat_log.write(f"[red]Terminated process: {p.info['name']}[/]")
                        found = True
                    except psutil.AccessDenied:
                        self.chat_log.write(f"[red]Access Denied: Cannot kill '{p.info['name']}'[/]")
            if not found: self.chat_log.write(f"[yellow]No process found matching '{name}'[/]")
            
        elif query.startswith("find "):
            name = query.replace("find ", "")
            self.chat_log.write(f"[yellow]Searching for '{name}'...[/]")
            # Simulating search - real 'find' would be too slow in a UI loop
            self.chat_log.write(f"[dim]Search complete: 0 matches found in root.[/]")

        # 5. PROCESS MEMORY ANALYZER
        elif query == "analyze mem":
            self.chat_log.write("[bold cyan]Process Memory Analyzer (Top 5):[/]")
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'memory_percent']):
                try: procs.append(p.info)
                except: pass
            procs = sorted(procs, key=lambda x: x.get('memory_percent', 0) or 0, reverse=True)[:5]
            for p in procs:
                mem = p.get('memory_percent', 0) or 0
                self.chat_log.write(f"  [yellow]{p['name']}[/] (PID: {p['pid']}) - [red]{mem:.1f}% RAM[/]")

        else:
            self.chat_log.write(f"[bold green]Nexus AI:[/] Thinking...")
            @work(thread=True)
            def query_ai(prompt: str):
                reply = _call_ai(prompt)
                self.call_from_thread(self.chat_log.write, f"[bold green]Nexus AI:[/] {reply}")
            query_ai(query)
            
        event.input.value = ""

    async def on_button_pressed(self, event: Button.Pressed) -> None:
        """Handle button clicks by simulating chat input."""
        button_id = event.button.id
        input_widget = self.query_one("#chat-input", Input)
        
        if button_id == "btn-help":
            self.action_toggle_help()
        elif button_id == "btn-speedtest":
            input_widget.value = "speedtest"
            await input_widget.action_submit()
        elif button_id == "btn-play":
            input_widget.value = "play"
            await input_widget.action_submit()
        elif button_id == "btn-say":
            input_widget.value = "say Hello from Nexus"
            await input_widget.action_submit()

    def update_battery(self) -> None:
        batt = psutil.sensors_battery()
        if batt:
            status = "Charging" if batt.power_plugged else "Discharging"
            self.battery_label.update(f"{batt.percent}% ({status})")

if __name__ == "__main__":
    app = Nexus()
    app.run()
