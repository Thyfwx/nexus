#!/bin/bash
# Double-click this file in Finder to restart the Nexus backend.
# After running it ONCE, the in-app "RESTART BACKEND" button in DevPanel
# will work for all future restarts (no need to use this script again).
set -u
cd "$(dirname "$0")"

echo "═══════════════════════════════════════════════"
echo "  NEXUS BACKEND · RESTART"
echo "═══════════════════════════════════════════════"
echo ""

# 1) Find anything listening on port 8000 and kill it
PIDS=$(lsof -nP -iTCP:8000 -sTCP:LISTEN -t 2>/dev/null || true)
if [ -n "$PIDS" ]; then
    echo "→ Killing existing backend process(es): $PIDS"
    kill $PIDS 2>/dev/null || true
    sleep 1
    # Force-kill any survivors
    for p in $PIDS; do
        if kill -0 $p 2>/dev/null; then
            echo "  forcing pid $p"
            kill -9 $p 2>/dev/null || true
        fi
    done
    sleep 1
else
    echo "→ No backend process on port 8000 (already stopped)."
fi

# 2) Detect Python — Nexus shares a venv with the sibling worktree at ~/Documents/Domain_Project/Nexus/venv
PY=""
CANDIDATES=(
    "$HOME/Documents/Domain_Project/Nexus/venv/bin/python"
    "$HOME/Documents/Domain_Project/Nexus-sandbox/venv/bin/python"
    "$HOME/Documents/Domain_Project/Nexus-sandbox/web_nexus/venv/bin/python"
    ".venv/bin/python"
    "venv/bin/python"
)
for c in "${CANDIDATES[@]}"; do
    if [ -x "$c" ]; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
    if command -v python3 >/dev/null 2>&1; then PY="python3"; else PY="python"; fi
fi
echo "→ Using interpreter: $PY"

# Verify psutil is importable in this interpreter — the venv has it, system python3 likely doesn't
if ! "$PY" -c "import psutil" 2>/dev/null; then
    echo "  ⚠ psutil missing in this interpreter — installing into the same env…"
    "$PY" -m pip install --quiet psutil 2>&1 | tail -3 || {
        echo "  ✗ pip install failed. Restart backend manually, or install psutil where main.py expects it."
        read -p "Press Return to close…"
        exit 1
    }
fi

# 3) Start fresh in the background via uvicorn (main.py is importable, not directly runnable)
echo "→ Starting backend with uvicorn (logs → /tmp/nexus_backend.log)…"
nohup "$PY" -m uvicorn main:app --host 127.0.0.1 --port 8000 > /tmp/nexus_backend.log 2>&1 &
NEW_PID=$!
echo "  pid: $NEW_PID"

# 4) Poll /ping until it answers OK (or 15s timeout)
echo -n "→ Waiting for backend to come online "
for i in $(seq 1 30); do
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/ping 2>/dev/null | grep -q 200; then
        echo " ✓"
        echo ""
        echo "═══════════════════════════════════════════════"
        echo "  BACKEND READY at http://127.0.0.1:8000"
        echo "  Logs: tail -f /tmp/nexus_backend.log"
        echo "═══════════════════════════════════════════════"
        echo ""
        echo "You can close this window. Future restarts: use the"
        echo "RESTART BACKEND button in the Owner DevPanel."
        echo ""
        # Keep window open 4s so user sees the success message
        sleep 4
        exit 0
    fi
    echo -n "."
    sleep 0.5
done
echo " ✗"
echo ""
echo "Backend did not respond within 15s. Check /tmp/nexus_backend.log:"
echo ""
tail -30 /tmp/nexus_backend.log
echo ""
read -p "Press Return to close…"
