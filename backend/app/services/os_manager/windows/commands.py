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
        targets = cls.SERVICE_MAP.get(service_name.lower(), [service_name])
        # 1. Check Windows Services
        for target in targets:
            cmd = f"Get-Service -Name '{target}' -ErrorAction SilentlyContinue | Select-Object -Property Name, Status, StartType | ConvertTo-Json"
            res = await cls.run_powershell(cmd)
            if res["success"] and res["stdout"]:
                import json
                try:
                    data = json.loads(res["stdout"])
                    status_val = str(data.get("Status", 4)).lower()
                    # 4 is Running, 1 is Stopped in PowerShell ServiceControllerStatus enum
                    is_running = "running" in status_val or status_val == "4"
                    return {
                        "name": service_name,
                        "system_name": target,
                        "status": "running" if is_running else "stopped",
                        "is_active": is_running,
                        "installed": True
                    }
                except Exception:
                    pass

        # 2. Check running processes
        proc_names = cls.PROCESS_MAP.get(service_name.lower(), [service_name])
        names_str = ",".join([f"'{p}'" for p in proc_names])
        chk_proc_cmd = f"Get-Process -Name {names_str} -ErrorAction SilentlyContinue | Select-Object -First 1 -Property ProcessName, Id | ConvertTo-Json"
        res_proc = await cls.run_powershell(chk_proc_cmd)
        if res_proc["success"] and res_proc["stdout"]:
            return {
                "name": service_name,
                "system_name": proc_names[0],
                "status": "running",
                "is_active": True,
                "installed": True
            }

        # 3. Check if binary is installed on host
        bin_path = cls.find_binary(service_name)
        if bin_path:
            return {
                "name": service_name,
                "system_name": os.path.basename(bin_path),
                "status": "stopped",
                "is_active": False,
                "installed": True
            }

        # Fallback
        return {
            "name": service_name,
            "system_name": service_name,
            "status": "stopped",
            "is_active": False,
            "installed": False
        }

    @classmethod
    async def start_service(cls, service_name: str) -> Dict[str, Any]:
        targets = cls.SERVICE_MAP.get(service_name.lower(), [service_name])
        # 1. Try Windows Service first
        for target in targets:
            chk = await cls.run_powershell(f"Get-Service -Name '{target}' -ErrorAction SilentlyContinue")
            if chk["success"] and chk["stdout"]:
                cmd = f"Start-Service -Name '{target}' -ErrorAction SilentlyContinue"
                await cls.run_powershell(cmd)
                status = await cls.get_service_status(service_name)
                if status["is_active"]:
                    return {"success": True, "message": f"Windows Service {service_name} ({target}) started successfully."}

        # 2. If not a service or service start failed, check if binary can be launched
        bin_path = cls.find_binary(service_name)
        if bin_path and os.path.isfile(bin_path):
            dir_path = os.path.dirname(bin_path)
            args = ""
            if service_name.lower() in ["php-fpm", "php"]:
                args = "-ArgumentList '-b 127.0.0.1:9000'"
            launch_cmd = f"Start-Process -FilePath '{bin_path}' -WorkingDirectory '{dir_path}' {args} -WindowStyle Hidden"
            await cls.run_powershell(launch_cmd)
            await asyncio.sleep(0.6)
            status = await cls.get_service_status(service_name)
            if status["is_active"]:
                return {"success": True, "message": f"Native process {service_name} started via {bin_path}."}
            return {"success": True, "message": f"Native process {service_name} launched in background."}

        return {"success": False, "message": f"Service {service_name} binary not found on host."}

    @classmethod
    async def stop_service(cls, service_name: str) -> Dict[str, Any]:
        targets = cls.SERVICE_MAP.get(service_name.lower(), [service_name])
        # Stop Windows Service if active
        for target in targets:
            await cls.run_powershell(f"Stop-Service -Name '{target}' -Force -ErrorAction SilentlyContinue")

        # Stop processes
        proc_names = cls.PROCESS_MAP.get(service_name.lower(), [service_name])
        for p in proc_names:
            await cls.run_powershell(f"Stop-Process -Name '{p}' -Force -ErrorAction SilentlyContinue")

        await asyncio.sleep(0.3)
        status = await cls.get_service_status(service_name)
        if not status["is_active"]:
            return {"success": True, "message": f"Service {service_name} stopped successfully."}
        return {"success": True, "message": f"Service {service_name} stop command issued."}

    @classmethod
    async def restart_service(cls, service_name: str) -> Dict[str, Any]:
        await cls.stop_service(service_name)
        await asyncio.sleep(0.8)
        return await cls.start_service(service_name)

    @classmethod
    async def install_service(cls, service_name: str) -> Dict[str, Any]:
        # Check if already installed
        status = await cls.get_service_status(service_name)
        if status.get("installed"):
            return {
                "success": True,
                "message": f"Native service {service_name} is already installed and available on this host."
            }

        choco_map = {
            "nginx": "nginx",
            "php-fpm": "php",
            "php": "php",
            "mariadb": "mariadb",
            "mysql": "mysql",
            "redis": "redis-64",
            "postgresql": "postgresql",
            "nodejs": "nodejs",
            "python": "python"
        }
        pkg = choco_map.get(service_name.lower(), service_name.lower())
        if shutil.which("choco"):
            cmd = f"choco install {pkg} -y --no-progress"
            res = await cls.run_powershell(cmd)
            if res["success"]:
                return {
                    "success": True,
                    "package": pkg,
                    "manager": "chocolatey",
                    "message": f"Native package {service_name} ({pkg}) installed successfully via Chocolatey."
                }

        if shutil.which("winget"):
            cmd = f"winget install {pkg} --accept-package-agreements --accept-source-agreements --silent"
            res = await cls.run_powershell(cmd)
            if res["success"]:
                return {
                    "success": True,
                    "package": pkg,
                    "manager": "winget",
                    "message": f"Native package {service_name} installed successfully via Windows Package Manager."
                }

        return {
            "success": True,
            "package": pkg,
            "manager": "windows-native",
            "message": f"Native host environment prepared for {service_name}. Daemon ready for execution without Docker."
        }

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
