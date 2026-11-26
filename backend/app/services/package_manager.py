import asyncio
import glob
import json
import os
import platform
import shutil
import subprocess
import urllib.request
import zipfile
from typing import Any, Dict, List, Optional, Tuple

from app.core.config import settings


def get_os_type() -> str:
    """Return normalized OS key: 'linux', 'darwin', or 'windows'."""
    if settings.TARGET_OS != "auto":
        t = settings.TARGET_OS.lower()
        if t == "mac":
            return "darwin"
        if t in ("linux", "darwin", "windows"):
            return t
    sys_name = platform.system().lower()
    if sys_name == "darwin":
        return "darwin"
    if sys_name.startswith("win"):
        return "windows"
    return "linux"


# Unified catalog covering Services, Database Engines, and Application Library runtimes/tools.
PACKAGE_CATALOG: Dict[str, Dict[str, Any]] = {
    "nginx": {
        "display_name": "Nginx",
        "kind": "service",
        "apt_pkg": "nginx",
        "dnf_pkg": "nginx",
        "pacman_pkg": "nginx",
        "brew_pkg": "nginx",
        "winget_id": "nginxinc.nginx",
        "choco_pkg": "nginx",
        "service_names": ["nginx"],
        "binaries": ["nginx", "nginx.exe"],
        "binary_globs_win": [r"C:\laragon\bin\nginx\*\nginx.exe", r"C:\nginx*\nginx.exe"],
        "default_port": 80,
    },
    "apache": {
        "display_name": "Apache HTTP Server",
        "kind": "service",
        "apt_pkg": "apache2",
        "dnf_pkg": "httpd",
        "pacman_pkg": "apache",
        "brew_pkg": "httpd",
        "winget_id": "ApacheLounge.httpd",
        "choco_pkg": "apache-httpd",
        "service_names": ["apache2", "httpd", "Apache2.4"],
        "binaries": ["apache2", "httpd", "httpd.exe"],
        "binary_globs_win": [r"C:\laragon\bin\apache\*\bin\httpd.exe", r"C:\Apache24\bin\httpd.exe"],
        "default_port": 80,
    },
    "php-fpm": {
        "display_name": "PHP-FPM",
        "kind": "service",
        "apt_pkg": "php-fpm",
        "dnf_pkg": "php-fpm",
        "pacman_pkg": "php-fpm",
        "brew_pkg": "php",
        "winget_id": "PHP.PHP",
        "choco_pkg": "php",
        "service_names": ["php8.4-fpm", "php8.3-fpm", "php8.2-fpm", "php8.1-fpm", "php-fpm", "php"],
        "binaries": ["php-fpm8.4", "php-fpm8.3", "php-fpm8.2", "php-fpm8.1", "php-fpm", "php", "php-cgi.exe"],
        "binary_globs_win": [r"C:\laragon\bin\php\*\php-cgi.exe", r"C:\php\php-cgi.exe", r"C:\tools\php*\php.exe"],
        "default_port": 9000,
    },
    "mariadb": {
        "display_name": "MariaDB",
        "kind": "database",
        "apt_pkg": "mariadb-server",
        "dnf_pkg": "mariadb-server",
        "pacman_pkg": "mariadb",
        "brew_pkg": "mariadb",
        "winget_id": "MariaDB.Server",
        "choco_pkg": "mariadb",
        "service_names": ["mariadb", "mysql", "MySQL80", "MySQL57"],
        "binaries": ["mariadbd", "mysqld", "mariadb", "mariadbd.exe", "mysqld.exe"],
        "binary_globs_win": [
            r"C:\laragon\bin\mariadb\*\bin\mysqld.exe",
            r"C:\laragon\bin\mysql\*\bin\mysqld.exe",
            r"C:\Program Files\MariaDB*\bin\mariadbd.exe",
            r"C:\Program Files\MariaDB*\bin\mysqld.exe",
        ],
        "default_port": 3306,
    },
    "mysql": {
        "display_name": "MySQL",
        "kind": "database",
        "apt_pkg": "mysql-server",
        "dnf_pkg": "mysql-server",
        "pacman_pkg": "mysql",
        "brew_pkg": "mysql",
        "winget_id": "Oracle.MySQL",
        "choco_pkg": "mysql",
        "service_names": ["mysql", "mysqld", "MySQL80", "mariadb"],
        "binaries": ["mysqld", "mariadbd", "mysql", "mysqld.exe"],
        "binary_globs_win": [r"C:\Program Files\MySQL\MySQL Server *\bin\mysqld.exe", r"C:\laragon\bin\mysql\*\bin\mysqld.exe"],
        "default_port": 3306,
    },
    "postgresql": {
        "display_name": "PostgreSQL",
        "kind": "database",
        "apt_pkg": "postgresql",
        "dnf_pkg": "postgresql-server",
        "pacman_pkg": "postgresql",
        "brew_pkg": "postgresql@16",
        "winget_id": "PostgreSQL.PostgreSQL",
        "choco_pkg": "postgresql",
        "service_names": ["postgresql", "postgresql@16", "postgresql-x64-17", "postgresql-x64-16", "postgresql-x64-15"],
        "binaries": ["postgres", "psql", "pg_ctl", "postgres.exe"],
        "binary_globs_win": [r"C:\Program Files\PostgreSQL\*\bin\postgres.exe", r"C:\laragon\bin\postgresql\*\bin\postgres.exe"],
        "default_port": 5432,
    },
    "redis": {
        "display_name": "Redis",
        "kind": "database",
        "apt_pkg": "redis-server",
        "dnf_pkg": "redis",
        "pacman_pkg": "redis",
        "brew_pkg": "redis",
        "winget_id": "Redis.Redis",
        "choco_pkg": "redis-64",
        "service_names": ["redis-server", "redis", "Redis"],
        "binaries": ["redis-server", "redis-cli", "redis-server.exe"],
        "binary_globs_win": [r"C:\Program Files\Redis\redis-server.exe", r"C:\laragon\bin\redis\*\redis-server.exe"],
        "default_port": 6379,
    },
    "mongodb": {
        "display_name": "MongoDB",
        "kind": "database",
        "apt_pkg": "mongodb",
        "apt_alt_pkgs": ["mongodb-org", "mongodb-server-core"],
        "dnf_pkg": "mongodb-org",
        "pacman_pkg": "mongodb-bin",
        "brew_tap": "mongodb/brew",
        "brew_pkg": "mongodb-community",
        "winget_id": "MongoDB.Server",
        "choco_pkg": "mongodb",
        "service_names": ["mongod", "mongodb", "MongoDB"],
        "binaries": ["mongod", "mongod.exe"],
        "binary_globs_win": [r"C:\Program Files\MongoDB\Server\*\bin\mongod.exe"],
        "default_port": 27017,
    },
    "sqlite": {
        "display_name": "SQLite",
        "kind": "database",
        "apt_pkg": "sqlite3",
        "dnf_pkg": "sqlite",
        "pacman_pkg": "sqlite",
        "brew_pkg": "sqlite",
        "winget_id": "SQLite.SQLite",
        "choco_pkg": "sqlite",
        "service_names": [],
        "binaries": ["sqlite3", "sqlite3.exe"],
        "binary_globs_win": [r"C:\sqlite\sqlite3.exe"],
        "default_port": 0,
        "serverless": True,
    },
    "memcached": {
        "display_name": "Memcached",
        "kind": "service",
        "apt_pkg": "memcached",
        "dnf_pkg": "memcached",
        "pacman_pkg": "memcached",
        "brew_pkg": "memcached",
        "choco_pkg": "memcached",
        "service_names": ["memcached"],
        "binaries": ["memcached", "memcached.exe"],
        "default_port": 11211,
    },
    "supervisor": {
        "display_name": "Supervisor",
        "kind": "service",
        "apt_pkg": "supervisor",
        "dnf_pkg": "supervisor",
        "pacman_pkg": "supervisor",
        "brew_pkg": "supervisor",
        "service_names": ["supervisor", "supervisord"],
        "binaries": ["supervisord", "supervisorctl"],
        "default_port": 9001,
    },
    "docker": {
        "display_name": "Docker",
        "kind": "service",
        "apt_pkg": "docker.io",
        "apt_alt_pkgs": ["docker-ce"],
        "dnf_pkg": "docker-ce",
        "pacman_pkg": "docker",
        "brew_pkg": "docker",
        "brew_cask": True,
        "winget_id": "Docker.DockerDesktop",
        "choco_pkg": "docker-desktop",
        "service_names": ["docker", "com.docker.service"],
        "binaries": ["docker", "docker.exe"],
        "binary_globs_win": [r"C:\Program Files\Docker\Docker\resources\bin\docker.exe"],
        "default_port": 2375,
    },
    "nodejs": {
        "display_name": "Node.js",
        "kind": "runtime",
        "apt_pkg": "nodejs npm",
        "apt_check_pkg": "nodejs",
        "dnf_pkg": "nodejs npm",
        "dnf_check_pkg": "nodejs",
        "pacman_pkg": "nodejs npm",
        "brew_pkg": "node",
        "winget_id": "OpenJS.NodeJS.LTS",
        "choco_pkg": "nodejs-lts",
        "service_names": [],
        "binaries": ["node", "node.exe"],
        "binary_globs_win": [r"C:\Program Files\nodejs\node.exe"],
        "default_port": 3000,
        "serverless": True,
    },
    "golang": {
        "display_name": "Golang",
        "kind": "runtime",
        "apt_pkg": "golang-go",
        "dnf_pkg": "golang",
        "pacman_pkg": "go",
        "brew_pkg": "go",
        "winget_id": "GoLang.Go",
        "choco_pkg": "golang",
        "service_names": [],
        "binaries": ["go", "go.exe"],
        "binary_globs_win": [r"C:\Program Files\Go\bin\go.exe"],
        "default_port": 8080,
        "serverless": True,
    },
    "rust": {
        "display_name": "Rust",
        "kind": "runtime",
        "apt_pkg": "rustc cargo",
        "apt_check_pkg": "rustc",
        "dnf_pkg": "rust cargo",
        "dnf_check_pkg": "rust",
        "pacman_pkg": "rust",
        "brew_pkg": "rust",
        "winget_id": "Rustlang.Rustup",
        "choco_pkg": "rust",
        "service_names": [],
        "binaries": ["rustc", "cargo", "rustc.exe"],
        "binary_globs_win": [r"C:\Users\*\.cargo\bin\rustc.exe"],
        "default_port": 8080,
        "serverless": True,
    },
}


class PackageManagerService:
    @staticmethod
    def find_binary(names: List[str], win_globs: Optional[List[str]] = None) -> Optional[str]:
        extra = ":/usr/sbin:/sbin:/usr/local/sbin:/opt/homebrew/bin:/opt/homebrew/sbin"
        search_path = os.environ.get("PATH", "") + extra
        for name in names:
            hit = shutil.which(name, path=search_path)
            if hit:
                return hit
        if win_globs:
            for pattern in win_globs:
                matches = glob.glob(pattern)
                if matches:
                    return matches[0]
        return None

    @staticmethod
    async def run_shell(cmd: str, timeout: float = 180.0, cwd: Optional[str] = None) -> Tuple[int, str, str]:
        try:
            proc = await asyncio.create_subprocess_shell(
                cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return (
                proc.returncode or 0,
                stdout.decode("utf-8", errors="replace").strip(),
                stderr.decode("utf-8", errors="replace").strip(),
            )
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return -1, "", f"Command timed out after {int(timeout)}s"
        except Exception as e:
            return -1, "", str(e)

    @staticmethod
    async def run_exec(cmd_list: List[str], cwd: Optional[str] = None, timeout: float = 180.0) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd_list,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return {
                "success": proc.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="replace").strip(),
                "stderr": stderr.decode("utf-8", errors="replace").strip(),
                "exit_code": proc.returncode or 0,
            }
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return {"success": False, "stdout": "", "stderr": "Command timed out", "exit_code": -1}
        except FileNotFoundError:
            return {"success": False, "stdout": "", "stderr": f"Command not found: {cmd_list[0]}", "exit_code": -1}
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def run_privileged(cls, inner_cmd: str, display_cmd: Optional[str] = None, timeout: float = 240.0) -> Dict[str, Any]:
        os_name = get_os_type()
        if os_name == "darwin":
            rc, out, err = await cls.run_shell(inner_cmd, timeout=timeout)
            needs_term = rc != 0 and any(k in (err or "").lower() for k in ("permission denied", "sudo", "operation not permitted"))
            return {
                "success": rc == 0,
                "requires_terminal": needs_term,
                "command": display_cmd or inner_cmd,
                "output": out or err,
                "message": "Completed successfully." if rc == 0 else (err or out or "Command failed."),
            }

        if os_name == "windows":
            ps_res = await cls.run_exec(
                ["powershell", "-NoProfile", "-NonInteractive", "-Command", inner_cmd],
                timeout=timeout,
            )
            err = ps_res["stderr"] or ps_res["stdout"]
            needs_term = (not ps_res["success"]) and any(
                k in err.lower() for k in ("access is denied", "requires elevation", "administrator", "0x80070005")
            )
            return {
                "success": ps_res["success"],
                "requires_terminal": needs_term,
                "command": display_cmd or inner_cmd,
                "output": ps_res["stdout"] or ps_res["stderr"],
                "message": "Completed successfully." if ps_res["success"] else (err or "Command failed."),
            }

        # Linux elevation strategy: root -> sudo -n -> pkexec -> interactive XTermTerminal prompt
        is_root = hasattr(os, "geteuid") and os.geteuid() == 0
        if is_root:
            rc, out, err = await cls.run_shell(inner_cmd, timeout=timeout)
            return {
                "success": rc == 0,
                "requires_terminal": False,
                "command": display_cmd or inner_cmd,
                "output": out or err,
                "message": "Completed successfully." if rc == 0 else (err or out or "Command failed."),
            }

        sudo_rc, _, _ = await cls.run_shell("sudo -n true 2>/dev/null", timeout=5.0)
        if sudo_rc == 0:
            res = await cls.run_exec(["sudo", "-n", "bash", "-c", inner_cmd], timeout=timeout)
            return {
                "success": res["success"],
                "requires_terminal": False,
                "command": display_cmd or f"sudo {inner_cmd}",
                "output": res["stdout"] or res["stderr"],
                "message": "Completed successfully." if res["success"] else (res["stderr"] or res["stdout"] or "Command failed."),
            }

        if shutil.which("pkexec") and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
            res = await cls.run_exec(["pkexec", "bash", "-c", inner_cmd], timeout=timeout)
            if res["success"]:
                return {
                    "success": True,
                    "requires_terminal": False,
                    "command": display_cmd or inner_cmd,
                    "output": res["stdout"],
                    "message": "Completed successfully via system authorization.",
                }
            return {
                "success": False,
                "requires_terminal": True,
                "command": display_cmd or f"sudo bash -c {subprocess.list2cmdline([inner_cmd])}",
                "output": res["stderr"] or res["stdout"],
                "message": "Administrator authorization is required. Run it directly in the interactive terminal.",
            }

        return {
            "success": False,
            "requires_terminal": True,
            "command": display_cmd or f"sudo bash -c {subprocess.list2cmdline([inner_cmd])}",
            "output": "",
            "message": "Administrator privileges required. Run the command in the interactive terminal.",
        }

    @classmethod
    def _build_commands(cls, spec: Dict[str, Any], os_name: str, active_service: str, pkg_override: Optional[str] = None) -> Tuple[str, str, str]:
        """Return (display_install_cmd, display_uninstall_cmd, manager_name)."""
        if os_name == "linux":
            if shutil.which("apt-get"):
                pkg = pkg_override or spec.get("apt_pkg", "")
                install_cmd = f"sudo apt-get update && sudo apt-get install -y {pkg}" if pkg else ""
                uninstall_cmd = (
                    f"sudo systemctl stop {active_service} 2>/dev/null || true; "
                    f"sudo apt-get remove --purge -y {pkg} && sudo apt-get autoremove -y"
                    if pkg
                    else ""
                )
                return install_cmd, uninstall_cmd, "apt"
            if shutil.which("dnf"):
                pkg = pkg_override or spec.get("dnf_pkg", spec.get("apt_pkg", ""))
                install_cmd = f"sudo dnf install -y {pkg}" if pkg else ""
                uninstall_cmd = f"sudo systemctl stop {active_service} 2>/dev/null || true; sudo dnf remove -y {pkg}" if pkg else ""
                return install_cmd, uninstall_cmd, "dnf"
            if shutil.which("pacman"):
                pkg = pkg_override or spec.get("pacman_pkg", "")
                install_cmd = f"sudo pacman -Sy --noconfirm {pkg}" if pkg else ""
                uninstall_cmd = f"sudo systemctl stop {active_service} 2>/dev/null || true; sudo pacman -Rns --noconfirm {pkg}" if pkg else ""
                return install_cmd, uninstall_cmd, "pacman"
            pkg = pkg_override or spec.get("dnf_pkg", spec.get("apt_pkg", ""))
            return (f"sudo yum install -y {pkg}" if pkg else ""), (f"sudo yum remove -y {pkg}" if pkg else ""), "yum"

        if os_name == "darwin":
            brew_pkg = spec.get("brew_pkg", "")
            is_cask = spec.get("brew_cask", False)
            tap = f"brew tap {spec['brew_tap']} && " if spec.get("brew_tap") else ""
            if is_cask:
                install_cmd = f"{tap}brew install --cask {brew_pkg}" if brew_pkg else ""
                uninstall_cmd = f"brew uninstall --cask {brew_pkg}" if brew_pkg else ""
            else:
                install_cmd = f"{tap}brew install {brew_pkg}" if brew_pkg else ""
                uninstall_cmd = (
                    f"brew services stop {brew_pkg} 2>/dev/null || true; brew uninstall {brew_pkg}"
                    if brew_pkg
                    else ""
                )
            return install_cmd, uninstall_cmd, "homebrew"

        if os_name == "windows":
            if shutil.which("winget") and spec.get("winget_id"):
                wid = spec["winget_id"]
                return (
                    f"winget install --id {wid} -e --accept-package-agreements --accept-source-agreements --silent",
                    f"winget uninstall --id {wid} -e --silent",
                    "winget",
                )
            if shutil.which("choco") and spec.get("choco_pkg"):
                cpkg = spec["choco_pkg"]
                return (
                    f"choco install {cpkg} -y --no-progress",
                    f"choco uninstall {cpkg} -y",
                    "chocolatey",
                )
            if spec.get("winget_id"):
                wid = spec["winget_id"]
                return (
                    f"winget install --id {wid} -e --accept-package-agreements --accept-source-agreements",
                    f"winget uninstall --id {wid} -e",
                    "winget",
                )
            cpkg = spec.get("choco_pkg", spec.get("display_name", "").lower())
            return f"choco install {cpkg} -y", f"choco uninstall {cpkg} -y", "chocolatey"

        return "", "", "unsupported"

    @classmethod
    async def detect_package(cls, name: str) -> Dict[str, Any]:
        key = name.lower()
        spec = PACKAGE_CATALOG.get(key)
        os_name = get_os_type()
        if not spec:
            return {
                "name": name,
                "system_name": key,
                "installed": False,
                "running": False,
                "is_active": False,
                "status": "stopped",
                "version": "",
                "binary_path": None,
                "install_command": "",
                "uninstall_command": "",
                "manager": "unknown",
                "os_supported": False,
            }

        service_names = spec.get("service_names", [])
        active_service = service_names[0] if service_names else key
        binary_path = cls.find_binary(spec.get("binaries", []), spec.get("binary_globs_win"))
        installed = False
        version = ""
        running = False
        matched_pkg = None

        if os_name == "linux":
            check_pkgs: List[str] = []
            if spec.get("apt_check_pkg"):
                check_pkgs.append(spec["apt_check_pkg"])
            elif spec.get("apt_pkg"):
                check_pkgs.append(spec["apt_pkg"].split()[0])
            check_pkgs.extend(spec.get("apt_alt_pkgs", []))

            if shutil.which("dpkg-query"):
                for cp in check_pkgs:
                    rc, out, _ = await cls.run_shell(f"dpkg-query -W -f='${{Status}}\\t${{Version}}' {cp} 2>/dev/null", timeout=5.0)
                    if rc == 0 and "install ok installed" in out:
                        installed = True
                        matched_pkg = cp
                        parts = out.split("\t", 1)
                        version = parts[1].strip() if len(parts) > 1 else ""
                        break
            elif shutil.which("rpm"):
                rpm_candidates = [spec.get("dnf_check_pkg") or (spec.get("dnf_pkg", "").split()[0])] + spec.get("apt_alt_pkgs", [])
                for cp in [c for c in rpm_candidates if c]:
                    rc, out, _ = await cls.run_shell(f"rpm -q --qf '%{{VERSION}}-%{{RELEASE}}' {cp} 2>/dev/null", timeout=5.0)
                    if rc == 0 and out:
                        installed = True
                        matched_pkg = cp
                        version = out.splitlines()[0].strip()
                        break
            elif shutil.which("pacman"):
                pac_pkg = spec.get("pacman_pkg", key).split()[0]
                rc, out, _ = await cls.run_shell(f"pacman -Q {pac_pkg} 2>/dev/null", timeout=5.0)
                if rc == 0 and out:
                    installed = True
                    matched_pkg = pac_pkg
                    parts = out.split()
                    version = parts[1] if len(parts) > 1 else ""

            # Fallback to binary lookup (e.g., nvm node, rustup, manual tarballs, official php8.x-fpm)
            if not installed and binary_path:
                installed = True

            if installed and not version and binary_path:
                _, vout, verr = await cls.run_shell(f'"{binary_path}" --version 2>&1 || "{binary_path}" -v 2>&1', timeout=4.0)
                first_line = (vout or verr).splitlines()[0] if (vout or verr) else ""
                if first_line:
                    version = first_line[:48]

            # Check systemd service active state across candidates
            for cand in service_names:
                rc_act, out_act, _ = await cls.run_shell(f"systemctl is-active {cand} 2>/dev/null", timeout=4.0)
                if rc_act == 0 and out_act.strip() == "active":
                    running = True
                    active_service = cand
                    break
                rc_unit, _, _ = await cls.run_shell(f"systemctl status {cand} 2>/dev/null | head -n 1", timeout=4.0)
                if rc_unit in (0, 3) and active_service == service_names[0]:
                    active_service = cand

            if installed and not running and binary_path and not spec.get("serverless"):
                bin_base = os.path.basename(binary_path)
                rc_pg, _, _ = await cls.run_shell(f"pgrep -x {bin_base} >/dev/null 2>&1", timeout=3.0)
                if rc_pg == 0:
                    running = True

        elif os_name == "darwin":
            brew_pkg = spec.get("brew_pkg")
            if brew_pkg and shutil.which("brew"):
                cask_flag = "--cask " if spec.get("brew_cask") else ""
                rc, out, _ = await cls.run_shell(f"brew list {cask_flag}--versions {brew_pkg} 2>/dev/null", timeout=8.0)
                if rc == 0 and out:
                    installed = True
                    parts = out.split()
                    version = parts[1] if len(parts) > 1 else ""
                if installed and not spec.get("serverless") and not spec.get("brew_cask"):
                    _, sout, _ = await cls.run_shell(f"brew services info {brew_pkg} --json 2>/dev/null", timeout=6.0)
                    if '"running": true' in sout or '"status": "started"' in sout:
                        running = True
            if not installed and binary_path:
                installed = True

        elif os_name == "windows":
            for svc in service_names:
                ps = await cls.run_exec(
                    ["powershell", "-NoProfile", "-NonInteractive", "-Command",
                     f"Get-Service -Name '{svc}' -ErrorAction SilentlyContinue | Select-Object -Property Name, Status | ConvertTo-Json"],
                    timeout=5.0,
                )
                if ps["success"] and ps["stdout"]:
                    try:
                        data = json.loads(ps["stdout"])
                        if isinstance(data, list):
                            data = data[0]
                        st_val = str(data.get("Status", "")).lower()
                        installed = True
                        active_service = svc
                        running = "running" in st_val or st_val == "4"
                        break
                    except Exception:
                        pass
            if not running and spec.get("binaries"):
                proc_names = ",".join(f"'{os.path.splitext(b)[0]}'" for b in spec["binaries"])
                ps_proc = await cls.run_exec(
                    ["powershell", "-NoProfile", "-NonInteractive", "-Command",
                     f"Get-Process -Name {proc_names} -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty ProcessName"],
                    timeout=4.0,
                )
                if ps_proc["success"] and ps_proc["stdout"]:
                    installed = True
                    running = True
            if not installed and binary_path:
                installed = True
            if not installed and shutil.which("winget") and spec.get("winget_id"):
                w_res = await cls.run_exec(["winget", "list", "--id", spec["winget_id"], "-e"], timeout=8.0)
                if w_res["success"] and spec["winget_id"].lower() in w_res["stdout"].lower():
                    installed = True

        # Special built-in check for sqlite3 (Python includes sqlite3 runtime, CLI may also be installed)
        if key == "sqlite" and not installed:
            installed = bool(binary_path)

        install_cmd, uninstall_cmd, manager = cls._build_commands(spec, os_name, active_service, matched_pkg)
        return {
            "name": name,
            "system_name": active_service,
            "installed": installed,
            "running": running,
            "is_active": running,
            "status": "running" if running else "stopped",
            "version": version,
            "binary_path": binary_path,
            "install_command": install_cmd,
            "uninstall_command": uninstall_cmd,
            "manager": manager,
            "os_supported": True,
        }

    @classmethod
    async def install_package(cls, name: str, version: Optional[str] = None) -> Dict[str, Any]:
        key = name.lower()
        spec = PACKAGE_CATALOG.get(key)
        if not spec:
            return {"success": False, "requires_terminal": False, "message": f"No native installer recipe defined for '{name}'."}

        os_name = get_os_type()
        info = await cls.detect_package(key)
        active_service = info["system_name"]
        install_cmd, _, manager = cls._build_commands(spec, os_name, active_service)
        if not install_cmd:
            return {"success": False, "requires_terminal": False, "message": f"Native installer not available for {name} on {os_name}."}

        if os_name == "linux":
            if shutil.which("apt-get"):
                pkg = spec.get("apt_pkg", "")
                inner_cmd = f"DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y {pkg}"
            elif shutil.which("dnf"):
                pkg = spec.get("dnf_pkg", "")
                inner_cmd = f"dnf install -y {pkg}"
            elif shutil.which("pacman"):
                pkg = spec.get("pacman_pkg", "")
                inner_cmd = f"pacman -Sy --noconfirm {pkg}"
            else:
                inner_cmd = install_cmd.replace("sudo ", "")

            if not spec.get("serverless") and spec.get("service_names"):
                svc = spec["service_names"][0]
                inner_cmd += f" && (systemctl enable --now {svc} 2>/dev/null || true)"

            res = await cls.run_privileged(inner_cmd, display_cmd=install_cmd)
        elif os_name == "darwin":
            if not shutil.which("brew"):
                return {
                    "success": False,
                    "requires_terminal": True,
                    "command": '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" && ' + install_cmd,
                    "message": "Homebrew is not installed on macOS. Install Homebrew and run the command in Terminal.",
                }
            brew_pkg = spec.get("brew_pkg", "")
            inner_cmd = install_cmd
            if not spec.get("serverless") and not spec.get("brew_cask") and brew_pkg:
                inner_cmd += f" && (brew services start {brew_pkg} 2>/dev/null || true)"
            res = await cls.run_privileged(inner_cmd, display_cmd=inner_cmd)
        else:
            res = await cls.run_privileged(install_cmd, display_cmd=install_cmd)

        after = await cls.detect_package(key)
        res["installed"] = after["installed"]
        res["version"] = after["version"]
        res["manager"] = manager
        if res["success"] and not after["installed"]:
            res["installed"] = True
        return res

    @classmethod
    async def uninstall_package(cls, name: str) -> Dict[str, Any]:
        key = name.lower()
        spec = PACKAGE_CATALOG.get(key)
        if not spec:
            return {"success": False, "requires_terminal": False, "message": f"No native uninstaller recipe defined for '{name}'."}

        os_name = get_os_type()
        info = await cls.detect_package(key)
        active_service = info["system_name"]

        # Find which apt/dnf package is actually installed if alternatives exist
        pkg_override = None
        if os_name == "linux" and shutil.which("dpkg-query"):
            candidates = []
            if spec.get("apt_pkg"):
                candidates.extend(spec["apt_pkg"].split())
            candidates.extend(spec.get("apt_alt_pkgs", []))
            installed_pkgs = []
            for cp in candidates:
                rc, out, _ = await cls.run_shell(f"dpkg-query -W -f='${{Status}}' {cp} 2>/dev/null", timeout=4.0)
                if rc == 0 and "install ok installed" in out:
                    installed_pkgs.append(cp)
            if installed_pkgs:
                pkg_override = " ".join(installed_pkgs)

        _, uninstall_cmd, manager = cls._build_commands(spec, os_name, active_service, pkg_override)
        if not uninstall_cmd:
            return {"success": False, "requires_terminal": False, "message": f"Native uninstaller not available for {name} on {os_name}."}

        if os_name == "linux":
            if shutil.which("apt-get"):
                pkg = pkg_override or spec.get("apt_pkg", "")
                inner_cmd = (
                    f"systemctl stop {active_service} 2>/dev/null || true; "
                    f"systemctl disable {active_service} 2>/dev/null || true; "
                    f"DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y {pkg} && "
                    f"DEBIAN_FRONTEND=noninteractive apt-get autoremove -y"
                )
            elif shutil.which("dnf"):
                pkg = pkg_override or spec.get("dnf_pkg", "")
                inner_cmd = f"systemctl stop {active_service} 2>/dev/null || true; dnf remove -y {pkg}"
            elif shutil.which("pacman"):
                pkg = pkg_override or spec.get("pacman_pkg", "")
                inner_cmd = f"systemctl stop {active_service} 2>/dev/null || true; pacman -Rns --noconfirm {pkg}"
            else:
                inner_cmd = uninstall_cmd.replace("sudo ", "")
            res = await cls.run_privileged(inner_cmd, display_cmd=uninstall_cmd)
        elif os_name == "windows":
            inner_cmd = (
                f"Stop-Service -Name '{active_service}' -Force -ErrorAction SilentlyContinue; {uninstall_cmd}"
                if not spec.get("serverless")
                else uninstall_cmd
            )
            res = await cls.run_privileged(inner_cmd, display_cmd=uninstall_cmd)
        else:
            res = await cls.run_privileged(uninstall_cmd, display_cmd=uninstall_cmd)

        after = await cls.detect_package(key)
        res["installed"] = after["installed"]
        res["manager"] = manager
        return res

    @classmethod
    async def control_service(cls, name: str, action: str) -> Dict[str, Any]:
        if action not in ("start", "stop", "restart"):
            return {"success": False, "requires_terminal": False, "message": f"Unsupported action: {action}"}
        key = name.lower()
        os_name = get_os_type()
        info = await cls.detect_package(key)
        if not info.get("installed"):
            return {"success": False, "requires_terminal": False, "message": f"Native package {name} is not installed."}

        svc = info["system_name"]
        if os_name == "linux":
            inner_cmd = f"systemctl {action} {svc}"
            return await cls.run_privileged(inner_cmd, display_cmd=f"sudo systemctl {action} {svc}", timeout=30.0)
        if os_name == "darwin":
            spec = PACKAGE_CATALOG.get(key, {})
            brew_pkg = spec.get("brew_pkg", svc)
            inner_cmd = f"brew services {action} {brew_pkg}"
            return await cls.run_privileged(inner_cmd, display_cmd=inner_cmd, timeout=30.0)
        if os_name == "windows":
            ps_verb = {"start": "Start-Service", "stop": "Stop-Service", "restart": "Restart-Service"}[action]
            inner_cmd = f"{ps_verb} -Name '{svc}'"
            return await cls.run_privileged(inner_cmd, display_cmd=f'powershell -Command "{inner_cmd}"', timeout=30.0)
        return {"success": False, "requires_terminal": False, "message": f"Unsupported OS: {os_name}"}

    @classmethod
    async def get_service_logs(cls, name: str, lines: int = 80) -> str:
        info = await cls.detect_package(name.lower())
        svc = info.get("system_name") or name.lower()
        os_name = get_os_type()
        if os_name == "linux":
            if shutil.which("journalctl"):
                rc, out, err = await cls.run_shell(f"journalctl -u {svc} -n {int(lines)} --no-pager 2>&1", timeout=6.0)
                if out:
                    return out
                if err:
                    return err
            return f"[system] No journalctl entries readable for {svc}."
        if os_name == "darwin":
            _, out, _ = await cls.run_shell(f"tail -n {int(lines)} /opt/homebrew/var/log/{svc}/*.log /usr/local/var/log/{svc}/*.log 2>/dev/null", timeout=5.0)
            return out or f"[macOS] No Homebrew logs found for {svc}."
        if os_name == "windows":
            res = await cls.run_exec(
                ["powershell", "-NoProfile", "-Command",
                 f"Get-EventLog -LogName Application -Source '*{svc}*' -Newest {int(lines)} -ErrorAction SilentlyContinue | Format-Table -AutoSize | Out-String"],
                timeout=6.0,
            )
            return res["stdout"] or f"[Windows] No Application EventLog entries for {svc}."
        return "Logs unavailable on this platform."
