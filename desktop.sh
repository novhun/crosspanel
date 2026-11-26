#!/usr/bin/env bash
# ==============================================================================
# CrossPanel Desktop Launcher (Linux / macOS)
# ==============================================================================
set -e

# Always resolve script root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Locate Python executable (prefer backend venv)
if [ -f "$ROOT_DIR/backend/venv/bin/python" ]; then
    PYTHON="$ROOT_DIR/backend/venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON="python3"
elif command -v python >/dev/null 2>&1; then
    PYTHON="python"
else
    echo "[ERROR] Python 3 was not found in PATH."
    echo "Please install Python 3.10+ and try again."
    exit 1
fi

# Bootstrap backend/venv if pywebview is not yet available
if [ "$PYTHON" != "$ROOT_DIR/backend/venv/bin/python" ] && ! "$PYTHON" -c "import webview" >/dev/null 2>&1; then
    if "$PYTHON" -m ensurepip --version >/dev/null 2>&1 || "$PYTHON" -m pip --version >/dev/null 2>&1; then
        echo "[INFO] Setting up backend virtual environment for CrossPanel Desktop..."
        VENV_ARGS=""
        if [ "$(uname -s)" = "Linux" ]; then
            VENV_ARGS="--system-site-packages"
        fi
        "$PYTHON" -m venv $VENV_ARGS "$ROOT_DIR/backend/venv"
        "$ROOT_DIR/backend/venv/bin/python" -m pip install --upgrade pip
        "$ROOT_DIR/backend/venv/bin/python" -m pip install -r "$ROOT_DIR/backend/requirements.txt"
        PYTHON="$ROOT_DIR/backend/venv/bin/python"
    else
        echo "[ERROR] 'pywebview' is not installed, and neither 'pip' nor 'venv' (ensurepip) is available for $PYTHON."
        if command -v apt-get >/dev/null 2>&1; then
            echo "On Ubuntu/Debian, install the required Python packages and re-run:"
            echo "  sudo apt update && sudo apt install -y python3-pip python3-venv"
        else
            echo "Please install pip and venv for Python 3, then re-run ./desktop.sh"
        fi
        exit 1
    fi
fi

chmod +x "$ROOT_DIR/desktop.py" 2>/dev/null || true

exec "$PYTHON" "$ROOT_DIR/desktop.py" "$@"
