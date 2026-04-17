#!/bin/bash
# Nexus Web Terminal — start script
# Run with:  bash start.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/web_nexus"

echo "Stopping any existing Nexus server..."
# Use Python (always available) to kill anything running on port 8000
python3 - <<'PY'
import os, signal, sys
try:
    import psutil
    for p in psutil.process_iter(['pid', 'cmdline']):
        try:
            line = ' '.join(p.info.get('cmdline') or [])
            if 'uvicorn' in line and ('main:app' in line or 'web_nexus' in line):
                os.kill(p.info['pid'], signal.SIGTERM)
                print(f"  Killed PID {p.info['pid']}")
        except Exception:
            pass
except ImportError:
    pass
PY

sleep 1

echo "Starting Nexus v3.9..."
# Try uvicorn binary, then python module fallback
if command -v uvicorn &>/dev/null; then
    exec uvicorn main:app --host 0.0.0.0 --port 8000
elif python3 -m uvicorn --version &>/dev/null 2>&1; then
    exec python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
else
    exec python -m uvicorn main:app --host 0.0.0.0 --port 8000
fi
