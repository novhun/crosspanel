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

chmod +x "$ROOT_DIR/desktop.py" 2>/dev/null || true

exec "$PYTHON" "$ROOT_DIR/desktop.py" "$@"
