import asyncio
import subprocess
import shutil
from typing import Dict, Any, List

class WindowsCommands:
    # Service name mapping on Windows
    SERVICE_MAP = {
        "nginx": ["nginx"],
        "php-fpm": ["php-cgi", "php"],
        "mariadb": ["mariadb", "mysql", "MySQL80", "MySQL57"],
        "docker": ["com.docker.service", "docker"],
        "redis": ["redis", "Redis"],
        "postgresql": ["postgresql-x64-16", "postgresql-x64-15", "postgresql"]
    }

    @classmethod
    async def run_powershell(cls, cmd: str) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_exec(
                "powershell", "-NoProfile", "-NonInteractive", "-Command", cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            return {
                "success": proc.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="ignore").strip(),
                "stderr": stderr.decode("utf-8", errors="ignore").strip(),
                "exit_code": proc.returncode
            }
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def get_service_status(cls, service_name: str) -> Dict[str, Any]:
        targets = cls.SERVICE_MAP.get(service_name.lower(), [service_name])
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
        
        # Check if running as docker container fallback
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
        for target in targets:
            cmd = f"Start-Service -Name '{target}' -ErrorAction Stop"
            res = await cls.run_powershell(cmd)
            if res["success"]:
                return {"success": True, "message": f"Service {service_name} ({target}) started successfully."}
        
        return {"success": False, "message": f"Service {service_name} not found or failed to start."}

    @classmethod
    async def stop_service(cls, service_name: str) -> Dict[str, Any]:
        targets = cls.SERVICE_MAP.get(service_name.lower(), [service_name])
        for target in targets:
            cmd = f"Stop-Service -Name '{target}' -Force -ErrorAction Stop"
            res = await cls.run_powershell(cmd)
            if res["success"]:
                return {"success": True, "message": f"Service {service_name} stopped successfully."}
        
        return {"success": False, "message": f"Service {service_name} not found or failed to stop."}

    @classmethod
    async def restart_service(cls, service_name: str) -> Dict[str, Any]:
        targets = cls.SERVICE_MAP.get(service_name.lower(), [service_name])
        for target in targets:
            cmd = f"Restart-Service -Name '{target}' -Force -ErrorAction Stop"
            res = await cls.run_powershell(cmd)
            if res["success"]:
                return {"success": True, "message": f"Service {service_name} restarted successfully."}
        
        return {"success": False, "message": f"Service {service_name} not found or failed to restart."}

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
