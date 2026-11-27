#!/usr/bin/env bash
set -e

# Always change to script directory (backend)
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================="
echo "       CrossPanel Backend Service (FastAPI)        "
echo "==================================================="

# Helper: select the best Python 3 binary (preferring one with venv + ensurepip)
find_python() {
    local fallback=""
    for cmd in python3.13 python3.12 python3.11 python3.10 python3 python; do
        if command -v "$cmd" >/dev/null 2>&1; then
            [ -z "$fallback" ] && fallback="$cmd"
            if "$cmd" -c "import venv, ensurepip" >/dev/null 2>&1; then
                echo "$cmd"
                return 0
            fi
        fi
    done
    [ -n "$fallback" ] && echo "$fallback"
}

# Check for valid Python and pip in venv
if [ ! -f "venv/bin/python" ] || [ ! -f "venv/bin/pip" ]; then
    echo "[INFO] Valid virtual environment not found in ./venv. Checking for Python..."
    rm -rf venv

    PY_CMD="$(find_python)"
    if [ -z "$PY_CMD" ]; then
        echo "[ERROR] Python 3 is not installed or not in PATH."
        echo "Please install Python 3.10+ and try again."
        exit 1
    fi

    echo "[INFO] Creating virtual environment using $PY_CMD..."
    VENV_ARGS=""
    if [ "$(uname -s)" = "Linux" ] && [ -x /usr/bin/python3 ]; then
        SYS_VER="$(/usr/bin/python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
        PY_VER="$("$PY_CMD" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
        if [ -n "$SYS_VER" ] && [ "$SYS_VER" = "$PY_VER" ]; then
            VENV_ARGS="--system-site-packages"
        fi
    fi
    "$PY_CMD" -m venv $VENV_ARGS venv

    echo "[INFO] Upgrading pip..."
    ./venv/bin/python -m pip install --upgrade pip

    echo "[INFO] Installing requirements from requirements.txt..."
    ./venv/bin/python -m pip install -r requirements.txt
fi

# Ensure uvicorn and required dependencies are installed in venv
if [ ! -f "venv/bin/uvicorn" ] || ! ./venv/bin/python -c "import fastapi, uvicorn, paramiko, pyftpdlib" >/dev/null 2>&1; then
    echo "[INFO] Installing / syncing dependencies from requirements.txt..."
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
