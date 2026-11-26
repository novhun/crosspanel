#!/usr/bin/env bash
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

echo "===================================================="
echo "Starting CrossPanel All-in-One DevOps Control Panel"
echo "===================================================="

if command -v setsid >/dev/null 2>&1; then
    setsid "$ROOT_DIR/backend/run.sh" &
    BACKEND_PID=$!
    setsid "$ROOT_DIR/frontend/run.sh" &
    FRONTEND_PID=$!
else
    "$ROOT_DIR/backend/run.sh" &
    BACKEND_PID=$!
    "$ROOT_DIR/frontend/run.sh" &
    FRONTEND_PID=$!
fi

echo "CrossPanel is starting up!"
echo "Backend API Docs: http://localhost:8000/docs"
echo "Frontend Web UI:  http://localhost:5173"
echo "phpMyAdmin:       http://localhost:888"

kill_tree() {
    local pid="$1"
    local sig="${2:-TERM}"
    [ -z "$pid" ] && return 0

    if command -v pgrep >/dev/null 2>&1; then
        local child
        for child in $(pgrep -P "$pid" 2>/dev/null || true); do
            kill_tree "$child" "$sig"
        done
    fi

    kill "-$sig" -- "-$pid" 2>/dev/null || true
    kill "-$sig" "$pid" 2>/dev/null || true
}

CLEANED_UP=0
cleanup() {
    [ "$CLEANED_UP" -eq 1 ] && return 0
    CLEANED_UP=1

    echo ""
    echo "[INFO] Stopping CrossPanel Backend & Frontend..."
    kill_tree "$BACKEND_PID" TERM
    kill_tree "$FRONTEND_PID" TERM
    sleep 0.5
    kill_tree "$BACKEND_PID" KILL
    kill_tree "$FRONTEND_PID" KILL
    wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    echo "[SUCCESS] CrossPanel stopped."
}

trap 'cleanup; exit 130' INT TERM
trap 'cleanup' EXIT

wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
