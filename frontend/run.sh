#!/usr/bin/env bash
set -e

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================="
echo "          CrossPanel Frontend (Vite UI)            "
echo "==================================================="

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is not found in PATH."
    echo "Please install Node.js 18+ and try again."
    exit 1
fi

if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing frontend dependencies (npm install)..."
    npm install
fi

echo "[INFO] Starting Vite development server..."
echo "[INFO] Frontend URL: http://localhost:5173"
echo "==================================================="
echo ""

exec npm run dev -- "$@"
