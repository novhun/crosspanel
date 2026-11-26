#!/usr/bin/env bash
# ==============================================================================
# CrossPanel Desktop Launcher (Linux / macOS)
# ==============================================================================
set -e

# Always resolve script root directory
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

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

# Locate Python executable (prefer valid backend venv)
if [ -f "$ROOT_DIR/backend/venv/bin/python" ] && [ -f "$ROOT_DIR/backend/venv/bin/pip" ]; then
    PYTHON="$ROOT_DIR/backend/venv/bin/python"
    if [ ! -f "$ROOT_DIR/backend/venv/bin/uvicorn" ] || ! "$PYTHON" -c "import fastapi, webview" >/dev/null 2>&1; then
        echo "[INFO] Installing missing backend & desktop dependencies from backend/requirements.txt..."
        "$PYTHON" -m pip install -r "$ROOT_DIR/backend/requirements.txt"
    fi
else
    PYTHON="$(find_python)"
    if [ -z "$PYTHON" ]; then
        echo "[ERROR] Python 3 was not found in PATH."
        echo "Please install Python 3.10+ and try again."
        exit 1
    fi
fi

# Bootstrap backend/venv if pywebview is not yet available
if [ "$PYTHON" != "$ROOT_DIR/backend/venv/bin/python" ] && ! "$PYTHON" -c "import webview" >/dev/null 2>&1; then
    if "$PYTHON" -m ensurepip --version >/dev/null 2>&1 || "$PYTHON" -m pip --version >/dev/null 2>&1; then
        echo "[INFO] Setting up backend virtual environment for CrossPanel Desktop using $PYTHON..."
        rm -rf "$ROOT_DIR/backend/venv"
        VENV_ARGS=""
        if [ "$(uname -s)" = "Linux" ] && [ -x /usr/bin/python3 ]; then
            SYS_VER="$(/usr/bin/python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
            PY_VER="$("$PYTHON" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
            if [ -n "$SYS_VER" ] && [ "$SYS_VER" = "$PY_VER" ]; then
                VENV_ARGS="--system-site-packages"
            fi
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

# Ensure a Linux GUI backend (GTK or Qt6 WebEngine) is available for pywebview
if [ "$(uname -s)" = "Linux" ]; then
    if ! "$PYTHON" -c "import gi; gi.require_version('WebKit2', '4.0')" >/dev/null 2>&1 \
       && ! "$PYTHON" -c "import qtpy; from qtpy import QtWebEngineWidgets" >/dev/null 2>&1; then
        if "$PYTHON" -m pip --version >/dev/null 2>&1; then
            echo "[INFO] Installing Qt WebEngine backend (PyQt6, PyQt6-WebEngine, qtpy) for pywebview..."
            "$PYTHON" -m pip install PyQt6 PyQt6-WebEngine qtpy
        else
            echo "[ERROR] pywebview requires GTK (python3-gi + gir1.2-webkit2-4.0) or Qt (PyQt6 PyQt6-WebEngine qtpy)."
            exit 1
        fi
    fi
fi

chmod +x "$ROOT_DIR/desktop.py" 2>/dev/null || true

exec "$PYTHON" "$ROOT_DIR/desktop.py" "$@"
