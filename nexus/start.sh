#!/bin/bash
# Nexus Web Terminal — start script
# Kills any existing server on port 8000, then launches fresh.
# Run with:  bash start.sh

set -e

cd "$(dirname "$0")/web_nexus"

echo "Stopping any existing Nexus server..."
pkill -f "uvicorn web_nexus.main" 2>/dev/null || true
pkill -f "uvicorn main:app"       2>/dev/null || true
lsof -ti :8000 | xargs kill -9   2>/dev/null || true

sleep 1

echo "Starting Nexus v3.8..."
uvicorn main:app --host 0.0.0.0 --port 8000
