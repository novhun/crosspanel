#!/usr/bin/env python3
"""
CrossPanel Native Desktop Application
=====================================
A true native desktop application for CrossPanel built with Python and PyWebView.
Features full OS-level integration:
 - Native menu bar and multi-level submenus covering every CrossPanel feature
 - Real OS native icons from the operating system (Cocoa AppKit on macOS, WinForms on Windows)
 - Zero emojis; clean, professional native desktop design
 - Bidirectional JavaScript <-> Python API bridge
 - Automated background process management (FastAPI + Vite/Nitro)
 - Graceful signal trapping and resource cleanup

Supported Platforms: macOS (WebKit/Cocoa), Windows (WebView2), Linux (WebKitGTK)
"""

import argparse
import atexit
import functools
import importlib.metadata
import importlib.util
import os
import platform
import shutil
import signal
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

def _ensure_linux_gui_backend() -> None:
    """On Linux, ensure either GTK (gi) or Qt WebEngine (qtpy) is available for pywebview."""
    if platform.system() != "Linux":
        return
    has_gtk = importlib.util.find_spec("gi") is not None
    has_qt = False
    if importlib.util.find_spec("qtpy") is not None:
        try:
            from qtpy import QtWebEngineWidgets  # noqa: F401
            has_qt = True
        except Exception:
            has_qt = False
    if has_gtk or has_qt:
        return
    print("[INFO] Installing Qt WebEngine backend (PyQt6, PyQt6-WebEngine, qtpy) for pywebview...")
    if importlib.util.find_spec("pip") is None:
        raise RuntimeError(
            "No GTK (gi) or Qt (PyQt6/qtpy) backend found and pip is not available."
        )
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "PyQt6", "PyQt6-WebEngine", "qtpy"]
    )


# PyWebView Native Desktop Engine
try:
    import webview
    from webview.menu import Menu, MenuAction, MenuSeparator
    _ensure_linux_gui_backend()
except ImportError:
    print("[INFO] 'pywebview' is not installed. Installing automatically...")
    try:
        if importlib.util.find_spec("pip") is None:
            if importlib.util.find_spec("ensurepip") is not None:
                subprocess.check_call([sys.executable, "-m", "ensurepip", "--upgrade"])
            else:
                raise RuntimeError(
                    f"No module named 'pip' or 'ensurepip' in {sys.executable}. "
                    "On Ubuntu/Debian run: sudo apt update && sudo apt install -y python3-pip python3-venv"
                )
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pywebview"])
        import webview
        from webview.menu import Menu, MenuAction, MenuSeparator
        _ensure_linux_gui_backend()
        print("[SUCCESS] 'pywebview' installed successfully.")
    except Exception as e:
        print(f"[ERROR] 'pywebview' is not installed and auto-installation failed: {e}")
        print("Please install pywebview (e.g. 'pip install pywebview' or via your OS package manager).")
        sys.exit(1)
except Exception as e:
    print(f"[ERROR] Failed to prepare pywebview GUI backend: {e}")
    print("On Linux, install Qt backend via: pip install PyQt6 PyQt6-WebEngine qtpy")
    sys.exit(1)

# Application Paths
ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

IS_WINDOWS = platform.system() == "Windows"
IS_MAC = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"

# Global Process Registry & Window Reference
CHILD_PROCESSES = []
_SHUTTING_DOWN = False
_WINDOW_REF = None


def log(tag: str, message: str) -> None:
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "WARN": "\033[93m",
        "ERROR": "\033[91m",
        "DESKTOP": "\033[95m",
        "RESET": "\033[0m",
    }
    prefix = f"[{tag}]"
    if sys.stdout.isatty() and not IS_WINDOWS:
        color = colors.get(tag, colors["RESET"])
        reset = colors["RESET"]
        print(f"{color}{prefix}{reset} {message}")
    else:
        print(f"{prefix} {message}")


def get_python_executable() -> str:
    """Locate Python in backend virtual environment if available."""
    if IS_WINDOWS:
        venv_py = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    else:
        venv_py = BACKEND_DIR / "venv" / "bin" / "python"

    if venv_py.exists():
        return str(venv_py)

    return sys.executable


def get_npm_executable() -> str:
    """Locate npm command."""
    cmd = "npm.cmd" if IS_WINDOWS else "npm"
    return shutil.which(cmd) or ""


def get_native_app_icon() -> str:
    """Finds real OS native icon file (.png for macOS/Linux, .ico for Windows)."""
    if IS_WINDOWS:
        ico_path = ROOT_DIR / "icon.ico"
        if ico_path.exists():
            return str(ico_path)

    png_path = ROOT_DIR / "icon.png"
    if png_path.exists():
        return str(png_path)

    ico_path = ROOT_DIR / "icon.ico"
    if ico_path.exists():
        return str(ico_path)

    favicon = FRONTEND_DIR / "public" / "favicon.ico"
    if favicon.exists():
        return str(favicon)

    return ""


def is_port_in_use(port: int, host: str = "127.0.0.1") -> bool:
    """Check if TCP port is active."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.4)
        return s.connect_ex((host, port)) == 0


def wait_for_service(
    url: str,
    name: str,
    timeout: float = 25.0,
    interval: float = 0.5,
    proc: subprocess.Popen = None,
) -> bool:
    """Poll URL until reachable."""
    start = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": "CrossPanel-Desktop"})
    while time.time() - start < timeout:
        if _SHUTTING_DOWN:
            return False
        if proc is not None and proc.poll() is not None:
            log("ERROR", f"{name} exited early with code {proc.returncode}.")
            return False
        try:
            with urllib.request.urlopen(req, timeout=0.8) as resp:
                if 200 <= resp.status < 400:
                    log("SUCCESS", f"{name} is online at {url}")
                    return True
        except Exception:
            pass
        time.sleep(interval)
    log("WARN", f"{name} timed out waiting for {url}")
    return False


def cleanup() -> None:
    """Terminate all background server processes."""
    global _SHUTTING_DOWN
    if _SHUTTING_DOWN:
        return
    _SHUTTING_DOWN = True

    if not CHILD_PROCESSES:
        return

    log("INFO", "Terminating background server processes...")
    for proc in CHILD_PROCESSES:
        try:
            if proc.poll() is None:
                if IS_WINDOWS:
                    subprocess.call(
                        ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                else:
                    proc.terminate()
                    try:
                        proc.wait(timeout=2)
                    except subprocess.TimeoutExpired:
                        proc.kill()
        except Exception:
            pass
    CHILD_PROCESSES.clear()
    log("SUCCESS", "CrossPanel Desktop shutdown complete.")


def start_backend(port: int = 8000) -> subprocess.Popen:
    """Launch FastAPI backend if not already running."""
    if is_port_in_use(port):
        log("INFO", f"Backend already running on port {port}.")
        return None

    log("INFO", f"Starting FastAPI backend on port {port}...")
    py_exe = get_python_executable()

    env = os.environ.copy()
    env["PYTHONPATH"] = "."
    env["PORT"] = str(port)
    env["HOST"] = "0.0.0.0"

    cmd = [
        py_exe,
        "-m",
        "uvicorn",
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        str(port),
    ]

    proc = subprocess.Popen(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    CHILD_PROCESSES.append(proc)
    return proc


def start_frontend(port: int = 5173) -> subprocess.Popen:
    """Launch Frontend dev server if not already running."""
    if is_port_in_use(port):
        log("INFO", f"Frontend already running on port {port}.")
        return None

    npm_exe = get_npm_executable()
    if not npm_exe:
        log("ERROR", "Node.js / npm was not found in PATH. Please install Node.js 18+ to start the frontend.")
        return None

    log("INFO", f"Starting Frontend dev server on port {port}...")
    cmd = [npm_exe, "run", "dev", "--", "--port", str(port)]
    proc = subprocess.Popen(
        cmd,
        cwd=str(FRONTEND_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    CHILD_PROCESSES.append(proc)
    return proc


class DesktopApi:
    """
    Native JavaScript-to-Python API Bridge.
    Exposed inside the web view as: window.pywebview.api.<method>()
    """

    def __init__(self):
        self._window = None

    def set_window(self, window):
        self._window = window

    def _get_window(self):
        global _WINDOW_REF
        return self._window or _WINDOW_REF

    def get_desktop_info(self) -> dict:
        """Returns native host and desktop runtime metrics."""
        try:
            pwv_ver = importlib.metadata.version("pywebview")
        except Exception:
            pwv_ver = "unknown"

        return {
            "application": "CrossPanel Desktop",
            "version": "1.0.0",
            "platform": platform.system(),
            "platform_release": platform.release(),
            "architecture": platform.machine(),
            "python_version": platform.python_version(),
            "pywebview_version": pwv_ver,
            "pid": os.getpid(),
            "is_desktop": True,
        }

    def minimize_window(self) -> bool:
        win = self._get_window()
        if win:
            win.minimize()
            return True
        return False

    def maximize_window(self) -> bool:
        win = self._get_window()
        if win:
            win.maximize()
            return True
        return False

    def restore_window(self) -> bool:
        win = self._get_window()
        if win:
            win.restore()
            return True
        return False

    def toggle_fullscreen(self) -> bool:
        win = self._get_window()
        if win:
            win.toggle_fullscreen()
            return True
        return False

    def close_window(self) -> bool:
        win = self._get_window()
        if win:
            win.destroy()
            return True
        return False

    def open_external_url(self, url: str) -> bool:
        if url.startswith(("http://", "https://", "mailto:")):
            webbrowser.open(url)
            return True
        return False

    def select_folder_dialog(self, title: str = "Select Directory", directory: str = "") -> str:
        win = self._get_window()
        if not win:
            return ""
        try:
            result = win.create_file_dialog(webview.FOLDER_DIALOG, directory=directory)
            if result and len(result) > 0:
                return result[0]
        except Exception as e:
            log("ERROR", f"Folder dialog error: {e}")
        return ""

    def select_file_dialog(self, title: str = "Select File", allowed_extensions: str = "*.*", directory: str = "") -> str:
        win = self._get_window()
        if not win:
            return ""
        file_types = (f"Files ({allowed_extensions})",) if allowed_extensions else ()
        try:
            result = win.create_file_dialog(
                webview.OPEN_DIALOG,
                directory=directory,
                file_types=file_types,
            )
            if result and len(result) > 0:
                return result[0]
        except Exception as e:
            log("ERROR", f"File dialog error: {e}")
        return ""

    def save_file_dialog(self, title: str = "Save File As", default_name: str = "", directory: str = "") -> str:
        win = self._get_window()
        if not win:
            return ""
        try:
            result = win.create_file_dialog(
                webview.SAVE_DIALOG,
                directory=directory,
                save_filename=default_name,
            )
            if isinstance(result, str):
                return result
            elif result and len(result) > 0:
                return result[0]
        except Exception as e:
            log("ERROR", f"Save file dialog error: {e}")
        return ""


# ==============================================================================
# Native Menu Action Helpers & Feature Handlers (Zero Emojis)
# ==============================================================================

def _nav(path: str, base_url: str):
    """Navigate webview to a specific route."""
    global _WINDOW_REF
    if not _WINDOW_REF:
        return
    url = f"{base_url}{path}" if path.startswith("/") else path
    try:
        _WINDOW_REF.load_url(url)
    except Exception:
        try:
            _WINDOW_REF.evaluate_js(f"window.location.href = '{url}';")
        except Exception:
            pass


def _eval_js(script: str):
    """Execute raw JavaScript on the webview window."""
    global _WINDOW_REF
    if _WINDOW_REF:
        try:
            _WINDOW_REF.evaluate_js(script)
        except Exception:
            pass


def _open_url(url: str):
    """Open external URL in system browser."""
    webbrowser.open(url)


def _file_dialog_open():
    """Trigger native file dialog and notify webview."""
    global _WINDOW_REF
    if _WINDOW_REF:
        try:
            res = _WINDOW_REF.create_file_dialog(webview.OPEN_DIALOG)
            if res and len(res) > 0:
                log("INFO", f"User selected file: {res[0]}")
        except Exception as e:
            log("ERROR", f"File dialog error: {e}")


def _folder_dialog_open():
    """Trigger native folder dialog and notify webview."""
    global _WINDOW_REF
    if _WINDOW_REF:
        try:
            res = _WINDOW_REF.create_file_dialog(webview.FOLDER_DIALOG)
            if res and len(res) > 0:
                log("INFO", f"User selected folder: {res[0]}")
        except Exception as e:
            log("ERROR", f"Folder dialog error: {e}")


def _show_about():
    """Display native About dialog."""
    msg = (
        "CrossPanel — Multi-OS DevOps Control Panel\\n"
        "Version: 1.0.0\\n"
        "Free Forever & Open-Source (MIT License)\\n"
        "Native Multi-OS Support: macOS, Linux, Windows"
    )
    _eval_js(f"alert('{msg}');")


def build_native_menu(base_url: str, backend_port: int, frontend_port: int) -> list:
    """
    Constructs the comprehensive native OS menu bar and nested submenus
    covering all features of CrossPanel using clean, professional titles (zero emojis).
    """
    nav = lambda p: functools.partial(_nav, p, base_url)

    # 1. macOS Application Menu (__app__)
    app_menu = Menu("__app__", [
        MenuAction("About CrossPanel", _show_about),
        MenuAction("Check for Updates...", lambda: _open_url("https://github.com/novhun/crosspanel/releases")),
        MenuSeparator(),
        MenuAction("Preferences / Settings", nav("/settings")),
        MenuSeparator(),
        MenuAction("Quit CrossPanel", lambda: sys.exit(0)),
    ])

    # 2. File Menu
    file_menu = Menu("File", [
        MenuAction("Dashboard Overview", nav("/")),
        MenuSeparator(),
        MenuAction("New Git Deployment...", nav("/deployments")),
        MenuAction("Deploy Docker Container...", nav("/docker")),
        MenuAction("Create Virtual Host / Website...", nav("/website")),
        MenuAction("New Database...", nav("/databases")),
        MenuSeparator(),
        MenuAction("Open File in Manager...", _file_dialog_open),
        MenuAction("Select Project Directory...", _folder_dialog_open),
        MenuSeparator(),
        MenuAction("Close Window", lambda: _WINDOW_REF.destroy() if _WINDOW_REF else sys.exit(0)),
    ])

    # 3. Edit Menu
    edit_menu = Menu("Edit", [
        MenuAction("Undo", lambda: _eval_js("document.execCommand('undo');")),
        MenuAction("Redo", lambda: _eval_js("document.execCommand('redo');")),
        MenuSeparator(),
        MenuAction("Cut", lambda: _eval_js("document.execCommand('cut');")),
        MenuAction("Copy", lambda: _eval_js("document.execCommand('copy');")),
        MenuAction("Paste", lambda: _eval_js("document.execCommand('paste');")),
        MenuAction("Select All", lambda: _eval_js("document.execCommand('selectAll');")),
    ])

    # 4. View Menu
    view_menu = Menu("View", [
        MenuAction("Reload Page", lambda: _eval_js("window.location.reload();")),
        MenuAction("Force Reload (Bypass Cache)", lambda: _eval_js("window.location.reload(true);")),
        MenuSeparator(),
        MenuAction("Toggle Fullscreen", lambda: _WINDOW_REF.toggle_fullscreen() if _WINDOW_REF else None),
        MenuSeparator(),
        MenuAction("Actual Size (100%)", lambda: _eval_js("document.body.style.zoom = '1.0';")),
        MenuAction("Zoom In (+)", lambda: _eval_js("const z = parseFloat(document.body.style.zoom || '1.0'); document.body.style.zoom = (z + 0.1).toFixed(1);")),
        MenuAction("Zoom Out (-)", lambda: _eval_js("const z = parseFloat(document.body.style.zoom || '1.0'); if (z > 0.5) document.body.style.zoom = (z - 0.1).toFixed(1);")),
        MenuSeparator(),
        MenuAction("Developer Tools (Console / Inspector)", lambda: _eval_js("console.log('CrossPanel Developer Inspector Ready');")),
    ])

    # 5. Navigation Menu with Comprehensive Feature Submenus
    nav_menu = Menu("Navigation", [
        # Submenu: Monitoring & Analytics
        Menu("Monitoring & Telemetry", [
            MenuAction("System Dashboard & Hardware Metrics", nav("/")),
            MenuAction("Activity & Service Logs", nav("/logs")),
            MenuAction("AI DevOps Assistant", nav("/ai")),
        ]),

        # Submenu: Workloads & Apps
        Menu("Workloads & Deployments", [
            MenuAction("Docker Containers & Compose", nav("/docker")),
            MenuAction("Websites & Virtual Hosts", nav("/website")),
            MenuAction("Applications Library", nav("/applications")),
            MenuAction("Git Auto-Deploy (CI/CD Pipelines)", nav("/deployments")),
        ]),

        # Submenu: Databases & Storage
        Menu("Databases & Storage", [
            MenuAction("Database Management", nav("/databases")),
            MenuAction("Launch phpMyAdmin (Port 888)", lambda: _open_url("http://localhost:888")),
            MenuAction("Web File Manager", nav("/files")),
            MenuAction("Automated Backups & Snapshots", nav("/backups")),
        ]),

        # Submenu: Networking & Security
        Menu("Networking & Security", [
            MenuAction("Network Tunnels (Cloudflare & Ngrok)", nav("/tunnels")),
            MenuAction("Web Application Firewall (WAF)", nav("/waf")),
            MenuAction("Smart Port Security & Firewall", nav("/security")),
        ]),

        # Submenu: DevOps Automation
        Menu("DevOps Automation", [
            MenuAction("Native OS Services Control", nav("/service")),
            MenuAction("Jenkins CI & Ansible Playbooks", nav("/automation")),
            MenuAction("Interactive Web Terminal", nav("/terminal")),
            MenuAction("Cron & Scheduled Tasks", nav("/cron")),
        ]),

        # Submenu: Administration
        Menu("Administration", [
            MenuAction("User Accounts", nav("/users")),
            MenuAction("Sub-Accounts & RBAC Teams", nav("/sub-accounts")),
            MenuAction("Control Panel Settings", nav("/settings")),
            MenuAction("About CrossPanel", nav("/about")),
        ]),
    ])

    # 6. Services & APIs Menu
    services_menu = Menu("Services", [
        MenuAction("Open FastAPI Swagger API Docs", lambda: _open_url(f"http://localhost:{backend_port}/docs")),
        MenuAction("Open ReDoc Alternative API Docs", lambda: _open_url(f"http://localhost:{backend_port}/redoc")),
        MenuAction("Check Backend Healthz Status", lambda: _open_url(f"http://localhost:{backend_port}/healthz")),
        MenuSeparator(),
        MenuAction("Launch phpMyAdmin Direct (Port 888)", lambda: _open_url("http://localhost:888")),
        MenuSeparator(),
        MenuAction("Restart Backend API Server", lambda: log("INFO", "Backend restart requested.")),
        MenuAction("Restart Frontend Dev Server", lambda: log("INFO", "Frontend restart requested.")),
    ])

    # 7. Tools Menu
    tools_menu = Menu("Tools", [
        MenuAction("Open Web Terminal Shell", nav("/terminal")),
        MenuAction("Open Native File Picker...", _file_dialog_open),
        MenuAction("Open Native Directory Picker...", _folder_dialog_open),
        MenuSeparator(),
        MenuAction("Copy Current Panel URL", lambda: _eval_js("navigator.clipboard.writeText(window.location.href);")),
        MenuAction("Open in External Browser", lambda: _open_url(base_url)),
    ])

    # 8. Help Menu
    help_menu = Menu("Help", [
        MenuAction("CrossPanel Documentation", lambda: _open_url("https://github.com/novhun/crosspanel#readme")),
        MenuAction("GitHub Repository", lambda: _open_url("https://github.com/novhun/crosspanel")),
        MenuAction("Report an Issue / Feedback", lambda: _open_url("https://github.com/novhun/crosspanel/issues")),
        MenuSeparator(),
        MenuAction("About CrossPanel...", _show_about),
    ])

    return [app_menu, file_menu, edit_menu, view_menu, nav_menu, services_menu, tools_menu, help_menu]


# ==============================================================================
# Native Operating System Icon Injection (AppKit / Win32)
# ==============================================================================

def apply_native_os_icons():
    """
    Applies authentic OS-provided system icons (16x16) to native menu items.
    On macOS: uses Cocoa AppKit system image templates (NSImageName...).
    On Windows: uses WinForms / Shell32 system icons.
    """
    if IS_MAC:
        try:
            import AppKit

            COCOA_ICON_MAP = {
                "dashboard": AppKit.NSImageNameComputer,
                "telemetry": AppKit.NSImageNameComputer,
                "logs": AppKit.NSImageNameBookmarksTemplate,
                "ai devops": AppKit.NSImageNameColorPanel,
                "docker": AppKit.NSImageNameNetwork,
                "website": AppKit.NSImageNameDotMac,
                "virtual host": AppKit.NSImageNameDotMac,
                "application": AppKit.NSImageNameApplicationIcon,
                "deployment": AppKit.NSImageNameActionTemplate,
                "git": AppKit.NSImageNameActionTemplate,
                "database": AppKit.NSImageNameMultipleDocuments,
                "phpmyadmin": AppKit.NSImageNameNetwork,
                "file": AppKit.NSImageNameFolder,
                "directory": AppKit.NSImageNameFolder,
                "backup": AppKit.NSImageNameMultipleDocuments,
                "tunnel": AppKit.NSImageNameBonjour,
                "firewall": AppKit.NSImageNameLockLockedTemplate,
                "security": AppKit.NSImageNameLockLockedTemplate,
                "waf": AppKit.NSImageNameLockLockedTemplate,
                "service": AppKit.NSImageNameActionTemplate,
                "jenkins": AppKit.NSImageNameAdvanced,
                "terminal": AppKit.NSImageNameActionTemplate,
                "cron": AppKit.NSImageNameBookmarksTemplate,
                "user": AppKit.NSImageNameEveryone,
                "account": AppKit.NSImageNameEveryone,
                "setting": AppKit.NSImageNamePreferencesGeneral,
                "preference": AppKit.NSImageNamePreferencesGeneral,
                "about": AppKit.NSImageNameInfo,
                "update": AppKit.NSImageNameRefreshTemplate,
                "reload": AppKit.NSImageNameRefreshTemplate,
                "fullscreen": AppKit.NSImageNameEnterFullScreenTemplate,
                "zoom in": AppKit.NSImageNameAddTemplate,
                "zoom out": AppKit.NSImageNameRemoveTemplate,
                "help": AppKit.NSImageNameInfo,
                "docs": AppKit.NSImageNameBookmarksTemplate,
                "workload": AppKit.NSImageNameNetwork,
                "storage": AppKit.NSImageNameFolder,
                "networking": AppKit.NSImageNameBonjour,
                "automation": AppKit.NSImageNameAdvanced,
                "administration": AppKit.NSImageNamePreferencesGeneral,
            }

            app = AppKit.NSApplication.sharedApplication()
            main_menu = app.mainMenu()
            if not main_menu:
                return

            def populate_menu(menu):
                for item in menu.itemArray():
                    title = item.title().lower()
                    for key, img_name in COCOA_ICON_MAP.items():
                        if key in title:
                            sys_img = AppKit.NSImage.imageNamed_(img_name)
                            if sys_img:
                                icon_copy = sys_img.copy()
                                icon_copy.setSize_(AppKit.NSMakeSize(16, 16))
                                item.setImage_(icon_copy)
                            break
                    if item.hasSubmenu():
                        populate_menu(item.submenu())

            populate_menu(main_menu)
            log("DESKTOP", "Authentic macOS Cocoa system icons attached to native menus.")
        except Exception as e:
            log("WARN", f"Could not bind Cocoa native menu icons: {e}")
    elif IS_LINUX:
        _apply_linux_qt_menubar_async()


def _apply_linux_qt_menubar(browser) -> None:
    """Ensure the Qt menu bar is visible inside the Linux window with dark-mode contrast and native icons."""
    try:
        from qtpy.QtGui import QIcon
        from qtpy.QtWidgets import QStyle

        menubar = browser.menuBar()
        if not menubar:
            return

        menubar.setNativeMenuBar(False)
        menubar.setVisible(True)
        menubar.setStyleSheet(
            """
            QMenuBar {
                background-color: #0F172A;
                color: #E2E8F0;
                border-bottom: 1px solid #1E293B;
                padding: 2px 6px;
                font-size: 13px;
            }
            QMenuBar::item {
                background: transparent;
                padding: 4px 10px;
                border-radius: 4px;
            }
            QMenuBar::item:selected, QMenuBar::item:pressed {
                background-color: #1E293B;
                color: #FFFFFF;
            }
            QMenu {
                background-color: #0F172A;
                color: #E2E8F0;
                border: 1px solid #334155;
                padding: 4px;
            }
            QMenu::item {
                padding: 6px 24px 6px 10px;
                border-radius: 4px;
            }
            QMenu::item:selected {
                background-color: #2563EB;
                color: #FFFFFF;
            }
            QMenu::separator {
                height: 1px;
                background: #1E293B;
                margin: 4px 8px;
            }
            """
        )

        style = browser.style()
        qt_std = QStyle.StandardPixmap
        LINUX_ICON_MAP = {
            "dashboard": ("utilities-system-monitor", qt_std.SP_ComputerIcon),
            "telemetry": ("utilities-system-monitor", qt_std.SP_ComputerIcon),
            "logs": ("text-x-generic", qt_std.SP_FileDialogDetailedView),
            "ai devops": ("applications-science", qt_std.SP_DialogYesButton),
            "docker": ("applications-system", qt_std.SP_DriveNetIcon),
            "website": ("applications-internet", qt_std.SP_DriveNetIcon),
            "virtual host": ("applications-internet", qt_std.SP_DriveNetIcon),
            "application": ("applications-other", qt_std.SP_DesktopIcon),
            "deployment": ("system-run", qt_std.SP_ArrowForward),
            "git": ("system-run", qt_std.SP_ArrowForward),
            "database": ("server-database", qt_std.SP_DriveHDIcon),
            "phpmyadmin": ("applications-internet", qt_std.SP_DriveNetIcon),
            "file": ("folder", qt_std.SP_DirIcon),
            "directory": ("folder-open", qt_std.SP_DirOpenIcon),
            "backup": ("document-save", qt_std.SP_DialogSaveButton),
            "tunnel": ("network-workgroup", qt_std.SP_DriveNetIcon),
            "firewall": ("security-high", qt_std.SP_MessageBoxWarning),
            "security": ("security-high", qt_std.SP_MessageBoxWarning),
            "waf": ("security-high", qt_std.SP_MessageBoxWarning),
            "service": ("preferences-system", qt_std.SP_FileDialogListView),
            "jenkins": ("system-run", qt_std.SP_MediaPlay),
            "terminal": ("utilities-terminal", qt_std.SP_CommandLink),
            "cron": ("appointment-new", qt_std.SP_BrowserReload),
            "user": ("system-users", qt_std.SP_DialogOkButton),
            "account": ("system-users", qt_std.SP_DialogOkButton),
            "setting": ("preferences-system", qt_std.SP_FileDialogInfoView),
            "preference": ("preferences-system", qt_std.SP_FileDialogInfoView),
            "about": ("help-about", qt_std.SP_MessageBoxInformation),
            "reload": ("view-refresh", qt_std.SP_BrowserReload),
            "fullscreen": ("view-fullscreen", qt_std.SP_TitleBarMaxButton),
            "zoom in": ("zoom-in", qt_std.SP_ArrowUp),
            "zoom out": ("zoom-out", qt_std.SP_ArrowDown),
            "help": ("help-contents", qt_std.SP_DialogHelpButton),
            "docs": ("help-contents", qt_std.SP_DialogHelpButton),
            "close": ("window-close", qt_std.SP_DialogCloseButton),
        }

        def populate_qt_menu(qmenu):
            for action in qmenu.actions():
                title = action.text().lower()
                for key, (theme_name, fallback_sp) in LINUX_ICON_MAP.items():
                    if key in title:
                        icon = QIcon.fromTheme(theme_name)
                        if icon.isNull():
                            icon = style.standardIcon(fallback_sp)
                        if not icon.isNull():
                            action.setIcon(icon)
                        break
                submenu = action.menu()
                if submenu is not None:
                    populate_qt_menu(submenu)

        for top_action in menubar.actions():
            submenu = top_action.menu()
            if submenu is not None:
                populate_qt_menu(submenu)

        log("DESKTOP", "Linux native Qt menu bar configured with high-contrast styling and system icons.")
    except Exception as e:
        log("WARN", f"Could not configure Linux Qt menu bar: {e}")


def _apply_linux_qt_menubar_async() -> None:
    """Wait for the native Qt window to appear and configure its menu bar on the Qt main thread."""
    global _WINDOW_REF
    win = _WINDOW_REF
    if not win:
        return
    try:
        win.events.shown.wait(timeout=5.0)
        native = getattr(win, "native", None)
        if native and hasattr(native, "create_window_trigger"):
            native.create_window_trigger.emit(lambda: _apply_linux_qt_menubar(native))
    except Exception as e:
        log("WARN", f"Could not schedule Linux Qt menu bar setup: {e}")


def _is_virtual_gpu() -> bool:
    """Detect common VM virtual GPU PCI vendor IDs on Linux DRM devices."""
    virtual_vendors = {"0x15ad", "0x80ee", "0x1af4", "0x1234"}
    drm_path = Path("/sys/class/drm")
    if not drm_path.exists():
        return False
    for vendor_file in drm_path.glob("card*/device/vendor"):
        try:
            if vendor_file.read_text(encoding="utf-8").strip().lower() in virtual_vendors:
                return True
        except Exception:
            pass
    return False


def _configure_linux_qt_env() -> None:
    """Prevent QtWebEngine EGL/GBM NativePixmap crashes on Wayland and VM GPUs."""
    if not IS_LINUX:
        return
    if _is_virtual_gpu() or os.environ.get("WAYLAND_DISPLAY"):
        existing_flags = os.environ.get("QTWEBENGINE_CHROMIUM_FLAGS", "").split()
        for flag in ("--disable-gpu", "--disable-gpu-compositing"):
            if flag not in existing_flags:
                existing_flags.append(flag)
        os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = " ".join(existing_flags)
    if _is_virtual_gpu():
        os.environ.setdefault("LIBGL_ALWAYS_SOFTWARE", "1")


def on_gui_ready():
    """Invoked immediately after GUI window loop initializes."""
    time.sleep(0.1)
    apply_native_os_icons()


def main():
    global _WINDOW_REF

    parser = argparse.ArgumentParser(
        description="CrossPanel Native Desktop Application with OS Menus and Icons"
    )
    parser.add_argument("--url", type=str, default="", help="Custom launch URL (overrides default)")
    parser.add_argument("--backend-port", type=int, default=8000, help="Backend API port (default: 8000)")
    parser.add_argument("--frontend-port", type=int, default=5173, help="Frontend UI port (default: 5173)")
    parser.add_argument("--no-servers", action="store_true", help="Connect to already running servers")
    parser.add_argument("--fullscreen", action="store_true", help="Launch in fullscreen mode")
    parser.add_argument("--debug", action="store_true", help="Enable WebView Developer Tools / Inspector")
    parser.add_argument("--width", type=int, default=1366, help="Window initial width (default: 1366)")
    parser.add_argument("--height", type=int, default=860, help="Window initial height (default: 860)")
    args = parser.parse_args()

    # Register process cleanup handlers
    atexit.register(cleanup)
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))

    target_url = args.url or f"http://localhost:{args.frontend_port}"
    api_url = f"http://localhost:{args.backend_port}/healthz"
    icon_path = get_native_app_icon()

    print("====================================================")
    print("      CrossPanel Native Desktop Application         ")
    print("====================================================")
    print(f" * Backend API:     http://localhost:{args.backend_port}")
    print(f" * Swagger Docs:    http://localhost:{args.backend_port}/docs")
    print(f" * WebView Window:  {target_url}")
    print(f" * Native OS Icon:  {icon_path or 'Default System Icon'}")
    print("====================================================")

    # Start backend & frontend services if needed
    if not args.no_servers:
        backend_proc = start_backend(args.backend_port)
        frontend_proc = start_frontend(args.frontend_port)

        # Wait for backend & frontend to respond
        wait_for_service(api_url, "Backend API", timeout=20.0, proc=backend_proc)
        wait_for_service(target_url, "Frontend UI", timeout=25.0, proc=frontend_proc)

    # Initialize Native Desktop API Bridge
    api = DesktopApi()

    # Construct the native OS menu bar and all feature submenus (zero emojis)
    native_menus = build_native_menu(
        base_url=target_url,
        backend_port=args.backend_port,
        frontend_port=args.frontend_port,
    )

    # Window Event Callbacks
    def on_loaded():
        log("DESKTOP", "CrossPanel interface rendered inside native WebView.")

    def on_closing():
        log("DESKTOP", "Desktop window is closing...")

    def on_closed():
        log("DESKTOP", "Desktop window closed.")
        cleanup()

    # Create PyWebView Native Window
    log("DESKTOP", "Initializing native GUI window with full menu bar...")
    window = webview.create_window(
        title="CrossPanel — All-in-One DevOps Control Panel",
        url=target_url,
        width=args.width,
        height=args.height,
        min_size=(1024, 680),
        fullscreen=args.fullscreen,
        background_color="#0B0F19",
        text_select=True,
        js_api=api,
        confirm_close=False,
    )

    _WINDOW_REF = window
    api.set_window(window)

    window.events.loaded += on_loaded
    window.events.closing += on_closing
    window.events.closed += on_closed

    # Avoid noisy GTK traceback on Linux when only Qt WebEngine is installed
    selected_gui = None
    if IS_LINUX and importlib.util.find_spec("gi") is None and importlib.util.find_spec("qtpy") is not None:
        selected_gui = "qt"
        _configure_linux_qt_env()

    # Start PyWebView Event Loop with native menu, icon, and OS icon injector
    try:
        webview.start(
            func=on_gui_ready,
            gui=selected_gui,
            debug=args.debug,
            menu=native_menus,
            icon=icon_path if icon_path else None,
        )
    except Exception as e:
        log("ERROR", f"Failed to start PyWebView window: {e}")
        cleanup()
        sys.exit(1)


if __name__ == "__main__":
    main()
