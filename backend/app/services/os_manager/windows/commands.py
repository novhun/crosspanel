import asyncio
import subprocess
import shutil
import os
import glob
from typing import Dict, Any, List, Optional

class WindowsCommands:
    # Service name mapping on Windows (Windows Services)
    SERVICE_MAP = {
        "nginx": ["nginx"],
        "php-fpm": ["php-cgi", "php"],
        "mariadb": ["mariadb", "mysql", "MySQL80", "MySQL57"],
        "mysql": ["mysql", "MySQL80", "MySQL57", "mariadb"],
        "docker": ["com.docker.service", "docker"],
        "redis": ["redis", "Redis"],
        "postgresql": ["postgresql-x64-18", "postgresql-x64-17", "postgresql-x64-16", "postgresql-x64-15", "postgresql-x64-14", "postgresql"]
    }

    # Running process executable names (without .exe)
    PROCESS_MAP = {
        "nginx": ["nginx"],
        "php-fpm": ["php-cgi", "php"],
        "mariadb": ["mysqld", "mariadbd"],
        "mysql": ["mysqld", "mariadbd"],
        "redis": ["redis-server"],
        "postgresql": ["postgres"],
        "docker": ["com.docker.backend", "dockerd"]
    }

    # Common local binary search patterns (e.g. Laragon, Program Files)
    BINARY_CANDIDATES = {
        "nginx": [r"C:\laragon\bin\nginx\*\nginx.exe", r"C:\nginx*\nginx.exe"],
        "redis": [r"C:\laragon\bin\redis\*\redis-server.exe", r"C:\Program Files\Redis\redis-server.exe"],
        "mariadb": [r"C:\laragon\bin\mysql\*\bin\mysqld.exe", r"C:\laragon\bin\mariadb\*\bin\mysqld.exe", r"C:\Program Files\MariaDB*\bin\mysqld.exe", r"C:\Program Files\MySQL\*\bin\mysqld.exe"],
        "mysql": [r"C:\laragon\bin\mysql\*\bin\mysqld.exe", r"C:\Program Files\MySQL\*\bin\mysqld.exe"],
        "php-fpm": [r"C:\laragon\bin\php\*\php-cgi.exe", r"C:\php\php-cgi.exe"],
        "postgresql": [r"C:\laragon\bin\postgresql\*\bin\postgres.exe", r"C:\Program Files\PostgreSQL\*\bin\postgres.exe"]
    }

    @classmethod
    def find_binary(cls, service_name: str) -> Optional[str]:
        which_hit = shutil.which(service_name)
        if which_hit:
            return which_hit
        patterns = cls.BINARY_CANDIDATES.get(service_name.lower(), [])
        for pattern in patterns:
            matches = glob.glob(pattern)
            if matches:
                return matches[0]
        return None

    @classmethod
    async def run_powershell(cls, cmd: str) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "powershell", "-NoProfile", "-NonInteractive", "-Command", cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=3.5)
            return {
                "success": proc.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="ignore").strip(),
                "stderr": stderr.decode("utf-8", errors="ignore").strip(),
                "exit_code": proc.returncode
            }
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return {"success": False, "stdout": "", "stderr": "PowerShell command timed out", "exit_code": -1}
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def get_service_status(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.detect_package(service_name)

    @classmethod
    async def start_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        res = await PackageManagerService.control_service(service_name, "start")
        if res.get("success"):
            return res
        # Fallback: direct binary launch if Windows service isn't registered
        bin_path = cls.find_binary(service_name)
        if bin_path and os.path.isfile(bin_path):
            dir_path = os.path.dirname(bin_path)
            args = "-ArgumentList '-b 127.0.0.1:9000'" if service_name.lower() in ["php-fpm", "php"] else ""
            launch_cmd = f"Start-Process -FilePath '{bin_path}' -WorkingDirectory '{dir_path}' {args} -WindowStyle Hidden"
            await cls.run_powershell(launch_cmd)
            await asyncio.sleep(0.5)
            return {"success": True, "requires_terminal": False, "message": f"Native process {service_name} started via {bin_path}."}
        return res

    @classmethod
    async def stop_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        res = await PackageManagerService.control_service(service_name, "stop")
        proc_names = cls.PROCESS_MAP.get(service_name.lower(), [service_name])
        for p in proc_names:
            await cls.run_powershell(f"Stop-Process -Name '{p}' -Force -ErrorAction SilentlyContinue")
        return res

    @classmethod
    async def restart_service(cls, service_name: str) -> Dict[str, Any]:
        await cls.stop_service(service_name)
        await asyncio.sleep(0.6)
        return await cls.start_service(service_name)

    @classmethod
    async def install_service(cls, service_name: str, version: Optional[str] = None) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.install_package(service_name, version=version)

    @classmethod
    async def uninstall_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        await cls.stop_service(service_name)
        return await PackageManagerService.uninstall_package(service_name)

    @classmethod
    async def get_firewall_rules(cls) -> List[Dict[str, Any]]:
        # Retrieve inbound rules via PowerShell
        cmd = "Get-NetFirewallRule -Direction Inbound -Enabled True | Select-Object -First 25 -Property DisplayName, Action, Direction | ConvertTo-Json"
        res = await cls.run_powershell(cmd)
        rules = []
        if res["success"] and res["stdout"]:
            import json
            try:
                raw = json.loads(res["stdout"])
                if isinstance(raw, dict):
                    raw = [raw]
                for item in raw:
                    rules.append({
                        "name": item.get("DisplayName", "Rule"),
                        "action": "ALLOW" if item.get("Action") in [2, "Allow", "allow"] else "DENY",
                        "direction": "IN",
                        "protocol": "TCP/UDP",
                        "port": "All/Custom",
                        "enabled": True
                    })
            except Exception:
                pass
        return rules

    @classmethod
    async def add_firewall_rule(cls, name: str, port: str, protocol: str = "TCP", action: str = "ALLOW", direction: str = "IN") -> Dict[str, Any]:
        dir_arg = "Inbound" if direction.upper() == "IN" else "Outbound"
        act_arg = "Allow" if action.upper() == "ALLOW" else "Block"
        cmd = f"New-NetFirewallRule -DisplayName '{name}' -Direction {dir_arg} -Action {act_arg} -Protocol {protocol} -LocalPort {port}"
        res = await cls.run_powershell(cmd)
        return {
            "success": res["success"],
            "message": "Firewall rule created in Windows Defender Firewall" if res["success"] else res["stderr"]
        }

    @classmethod
    async def delete_firewall_rule(cls, name: str, port: str = "") -> Dict[str, Any]:
        cmd = f"Remove-NetFirewallRule -DisplayName '{name}' -ErrorAction SilentlyContinue"
        res = await cls.run_powershell(cmd)
        return {
            "success": res["success"],
            "message": f"Firewall rule '{name}' removed." if res["success"] else res["stderr"]
        }
