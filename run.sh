#!/usr/bin/env bash
set -e

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

run_backend() {
    cd backend && bash run.sh
}

run_frontend() {
    cd frontend && bash run.sh
}

run_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        echo "[ERROR] Docker is not installed or not in PATH."
        exit 1
    fi
    echo "[INFO] Starting CrossPanel via Docker Compose..."
    docker compose up --build
}

run_both() {
    echo "==================================================="
    echo "          Starting CrossPanel Full Stack           "
    echo "==================================================="
    echo " * Backend API:    http://localhost:8000"
    echo " * Swagger Docs:   http://localhost:8000/docs"
    echo " * Frontend UI:    http://localhost:5173"
    echo "==================================================="
    echo "Press Ctrl+C to terminate all services."
    echo ""

    trap 'kill $(jobs -p) 2>/dev/null' EXIT SIGINT SIGTERM

    (cd backend && bash run.sh) &
    (cd frontend && bash run.sh) &

    wait
}

MODE="${1:-}"

case "$MODE" in
    backend|api)
        run_backend
        ;;
    frontend|ui)
        run_frontend
        ;;
    docker)
        run_docker
        ;;
    all)
        run_both
        ;;
    *)
        echo "==================================================="
        echo "               CrossPanel Launcher                 "
        echo "==================================================="
        echo "  [1] Start Full Stack (Backend + Frontend)"
        echo "  [2] Start Backend Only (port 8000)"
        echo "  [3] Start Frontend Only (port 5173)"
        echo "  [4] Run with Docker Compose"
        echo "  [5] Exit"
        echo "==================================================="
        read -rp "Select an option [1-5] (default 1): " choice
        case "${choice:-1}" in
            1) run_both ;;
            2) run_backend ;;
            3) run_frontend ;;
            4) run_docker ;;
            *) exit 0 ;;
        esac
        ;;
esac
