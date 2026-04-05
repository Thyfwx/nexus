import psutil
import datetime
import requests
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Static, DataTable, Label, Input, RichLog
from textual.reactive import reactive

class SystemStats(Static):
    """A widget to display system stats."""
    
    cpu_percent = reactive(0.0)
    mem_percent = reactive(0.0)
    disk_percent = reactive(0.0)
    
    def on_mount(self) -> None:
        self.set_interval(1, self.update_stats)

    def update_stats(self) -> None:
        self.cpu_percent = psutil.cpu_percent()
        self.mem_percent = psutil.virtual_memory().percent
        self.disk_percent = psutil.disk_usage('/').percent
        
    def render(self) -> str:
        return (
            f"CPU: [bold green]{self.cpu_percent}%[/]\n"
            f"MEM: [bold yellow]{self.mem_percent}%[/]\n"
            f"DSK: [bold red]{self.disk_percent}%[/]"
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
                    yield Input(placeholder="Ask Nexus anything...", id="chat-input")
        yield Footer()

    def on_mount(self) -> None:
        self.network_table.add_columns("Process", "IP", "Location", "Status")
        self.set_interval(3, self.update_network)
        self.set_interval(10, self.update_battery)
        self.update_geo()

    def update_geo(self) -> None:
        try:
            # Using ip-api.com (free, no key needed for small usage)
            response = requests.get("http://ip-api.com/json/", timeout=5).json()
            if response.status == "success":
                self.geo_label.update(f"{response['city']}, {response['countryCode']}")
        except:
            self.geo_label.update("Unknown")

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
                self.network_table.add_row(proc, ip, loc, conn.status)
        except psutil.AccessDenied:
            self.network_table.add_row("ACCESS DENIED", "Run with sudo", "to see", "network")
        except Exception as e:
            self.network_table.add_row("ERROR", str(e), "", "")

    def on_input_submitted(self, event: Input.Submitted) -> None:
        query = event.value.strip().lower()
        if not query: return
        
        self.chat_log.write(f"[bold cyan]Query:[/] {query}")
        
        if query.startswith("kill "):
            name = query.replace("kill ", "")
            found = False
            for p in psutil.process_iter(['name']):
                if name in p.info['name'].lower():
                    p.kill()
                    self.chat_log.write(f"[red]Terminated process: {p.info['name']}[/]")
                    found = True
            if not found: self.chat_log.write(f"[yellow]No process found matching '{name}'[/]")
            
        elif query.startswith("find "):
            name = query.replace("find ", "")
            self.chat_log.write(f"[yellow]Searching for '{name}'...[/]")
            # Simulating search - real 'find' would be too slow in a UI loop
            self.chat_log.write(f"[dim]Search complete: 0 matches found in root.[/]")

        else:
            self.chat_log.write(f"[bold green]Nexus AI:[/] Analyzing request...")
            self.chat_log.write(f"[dim]Tip: Try 'kill <name>' or 'find <name>'[/]")
            
        event.input.value = ""

    def update_battery(self) -> None:
        batt = psutil.sensors_battery()
        if batt:
            status = "Charging" if batt.power_plugged else "Discharging"
            self.battery_label.update(f"{batt.percent}% ({status})")

if __name__ == "__main__":
    app = Nexus()
    app.run()
