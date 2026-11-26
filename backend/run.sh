#!/usr/bin/env bash
set -e

# Always change to script directory (backend)
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================="
echo "       CrossPanel Backend Service (FastAPI)        "
echo "==================================================="

# Check for Python in venv
if [ ! -f "venv/bin/python" ]; then
    echo "[INFO] Virtual environment not found in ./venv. Checking for system Python..."
    
    if command -v python3 >/dev/null 2>&1; then
        PY_CMD="python3"
    elif command -v python >/dev/null 2>&1; then
        PY_CMD="python"
    else
        echo "[ERROR] Python 3 is not installed or not in PATH."
        echo "Please install Python 3.10+ and try again."
        exit 1
    fi

    echo "[INFO] Creating virtual environment using $PY_CMD..."
    VENV_ARGS=""
    if [ "$(uname -s)" = "Linux" ]; then
        VENV_ARGS="--system-site-packages"
    fi
    "$PY_CMD" -m venv $VENV_ARGS venv

    echo "[INFO] Upgrading pip..."
    ./venv/bin/python -m pip install --upgrade pip

    echo "[INFO] Installing requirements from requirements.txt..."
    ./venv/bin/python -m pip install -r requirements.txt
fi

# Ensure uvicorn is installed in venv
if [ ! -f "venv/bin/uvicorn" ]; then
    echo "[INFO] Installing dependencies from requirements.txt..."
    ./venv/bin/python -m pip install -r requirements.txt
fi

# Host and Port configuration
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

# Ensure backend directory is in PYTHONPATH
export PYTHONPATH="."

echo "[INFO] Starting FastAPI server..."
echo "[INFO] Host: ${HOST}"
echo "[INFO] Port: ${PORT}"
echo "[INFO] API Documentation: http://localhost:${PORT}/docs"
echo "[INFO] Alternative Docs:   http://localhost:${PORT}/redoc"
echo "==================================================="
echo "Press Ctrl+C to stop the server."
echo "==================================================="
echo ""

exec ./venv/bin/python -m uvicorn app.main:app --host "${HOST}" --port "${PORT}" --reload "$@"
