#!/usr/bin/env bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "===================================================="
echo "Starting CrossPanel All-in-One DevOps Control Panel"
echo "===================================================="

# Start Backend
"$ROOT_DIR/backend/run.sh" &
BACKEND_PID=$!

# Start Frontend
"$ROOT_DIR/frontend/run.sh" &
FRONTEND_PID=$!

echo "CrossPanel is starting up!"
echo "Backend API Docs: http://localhost:8000/docs"
echo "Frontend Web UI:  http://localhost:5173"
echo "phpMyAdmin:       http://localhost:888"

cleanup() {
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
}

trap cleanup INT TERM EXIT
wait

