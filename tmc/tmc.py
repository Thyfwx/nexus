import os
import psutil
import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.live import Live
from rich import box
import time

console = Console()

def get_system_stats():
    # CPU usage
    cpu_usage = psutil.cpu_percent(interval=None)
    
    # Memory usage
    memory = psutil.virtual_memory()
    mem_used = memory.percent
    
    # Disk usage (Root)
    disk = psutil.disk_usage('/')
    disk_used = disk.percent
    
    # Battery (if available)
    battery = psutil.sensors_battery()
    bat_str = f"{battery.percent}% {'(Charging)' if battery.power_plugged else ''}" if battery else "N/A"
    
    return {
        "cpu": cpu_usage,
        "mem": mem_used,
        "disk": disk_used,
        "battery": bat_str,
        "time": datetime.datetime.now().strftime("%H:%M:%S")
    }

def generate_dashboard():
    stats = get_system_stats()
    
    table = Table(box=box.ROUNDED, expand=True, show_header=False)
    table.add_column("Metric", style="cyan", justify="right")
    table.add_column("Value", style="bold white")
    
    table.add_row("CPU Load", f"[bold green]{stats['cpu']}%[/bold green]")
    table.add_row("Memory Usage", f"[bold yellow]{stats['mem']}%[/bold yellow]")
    table.add_row("Disk Space", f"[bold red]{stats['disk']}%[/bold red]")
    table.add_row("Battery", stats['battery'])
    table.add_row("System Time", stats['time'])
    
    panel = Panel(
        table,
        title="[bold magenta]Terminal Mission Control[/bold magenta]",
        subtitle="[dim]Press Ctrl+C to Exit[/dim]",
        border_style="blue"
    )
    return panel

def main():
    try:
        with Live(generate_dashboard(), refresh_per_second=1) as live:
            while True:
                time.sleep(1)
                live.update(generate_dashboard())
    except KeyboardInterrupt:
        console.print("\n[bold red]Mission Control Offline.[/bold red]")

if __name__ == "__main__":
    main()
