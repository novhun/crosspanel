#!/usr/bin/env bash
# ==============================================================================
# CrossPanel Full-Stack Build & Preparation Script (Linux / macOS)
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

# Text Colors
RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
BOLD="\033[1m"
RESET="\033[0m"

log_info() { echo -e "${BLUE}[INFO]${RESET} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${RESET} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${RESET} $1"; }
log_error() { echo -e "${RED}[ERROR]${RESET} $1"; }

show_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "===================================================="
    echo "       CrossPanel Full-Stack Build System           "
    echo "===================================================="
    echo -e "${RESET}"
}

show_help() {
    show_banner
    echo "Usage: ./build.sh [target]"
    echo ""
    echo "Targets:"
    echo "  all          Build frontend and configure backend (Default)"
    echo "  frontend     Install dependencies and build production frontend (.output)"
    echo "  backend      Set up Python virtualenv and install requirements"
    echo "  docker       Build production Docker images with docker compose"
    echo "  desktop      Install optional pywebview dependencies for desktop window"
    echo "  clean        Remove build artifacts (.output, dist, node_modules caches, __pycache__)"
    echo "  help         Display this help message"
    echo ""
}

build_frontend() {
    log_info "Starting Frontend build..."
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js is not installed or not found in PATH. Please install Node.js 18+."
        exit 1
    fi
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm is not installed or not found in PATH."
        exit 1
    fi

    cd "$ROOT_DIR/frontend"
    if [ ! -d "node_modules" ]; then
        log_info "Installing frontend dependencies (npm install --legacy-peer-deps)..."
        npm install --legacy-peer-deps
    fi

    log_info "Compiling production assets with Vite / TanStack Start..."
    npm run build
    log_success "Frontend build completed successfully."
    cd "$ROOT_DIR"
}

build_backend() {
    log_info "Configuring Backend environment..."
    cd "$ROOT_DIR/backend"

    # Find Python 3
    if command -v python3 >/dev/null 2>&1; then
        PY_CMD="python3"
    elif command -v python >/dev/null 2>&1; then
        PY_CMD="python"
    else
        log_error "Python 3 is not installed or not found in PATH. Please install Python 3.10+."
        exit 1
    fi

    if [ ! -d "venv" ]; then
        log_info "Creating Python virtual environment using $PY_CMD..."
        VENV_ARGS=""
        if [ "$(uname -s)" = "Linux" ]; then
            VENV_ARGS="--system-site-packages"
        fi
        "$PY_CMD" -m venv $VENV_ARGS venv
    fi

    log_info "Upgrading pip and installing requirements from requirements.txt..."
    ./venv/bin/python -m pip install --upgrade pip
    ./venv/bin/python -m pip install -r requirements.txt

    log_success "Backend environment configured successfully."
    cd "$ROOT_DIR"
}

build_docker() {
    log_info "Building CrossPanel Docker containers..."
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed or not running."
        exit 1
    fi

    docker compose build
    log_success "Docker images built successfully."
}

build_desktop() {
    log_info "Configuring desktop dependencies (pywebview)..."
    cd "$ROOT_DIR/backend"
    if [ -f "venv/bin/python" ]; then
        ./venv/bin/python -m pip install pywebview
        log_success "Desktop pywebview package installed."
    else
        log_warn "Backend venv not found. Running backend setup first..."
        build_backend
        ./venv/bin/python -m pip install pywebview
        log_success "Desktop pywebview package installed."
    fi
    cd "$ROOT_DIR"
}

clean_artifacts() {
    log_info "Cleaning build artifacts and temporary files..."
    rm -rf "$ROOT_DIR/frontend/.output" "$ROOT_DIR/frontend/dist"
    find "$ROOT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$ROOT_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    log_success "Clean completed."
}

TARGET="${1:-all}"

case "$TARGET" in
    frontend)
        show_banner
        build_frontend
        ;;
    backend)
        show_banner
        build_backend
        ;;
    docker)
        show_banner
        build_docker
        ;;
    desktop)
        show_banner
        build_desktop
        ;;
    clean)
        show_banner
        clean_artifacts
        ;;
    help|--help|-h)
        show_help
        ;;
    all)
        show_banner
        build_backend
        build_frontend
        echo ""
        log_success "Full stack build completed successfully!"
        echo " * Run web panel:     ./run.sh"
        echo " * Run desktop app:   ./desktop.sh"
        echo " * Docker compose:    docker compose up -d"
        echo ""
        ;;
    *)
        log_error "Unknown build target: $TARGET"
        show_help
        exit 1
        ;;
esac
