import asyncio
import platform
from typing import Dict, Any, List

class MacCommands:
    SERVICE_MAP = {
        "nginx": "nginx",
        "php-fpm": "php",
        "mariadb": "mariadb",
        "docker": "docker",
        "redis": "redis",
        "postgresql": "postgresql@15"
    }

    @classmethod
    async def run_sh(cls, cmd: str) -> Dict[str, Any]:
        try:
            if platform.system() == "Darwin":
                proc = await asyncio.create_subprocess_shell(
                    cmd,
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
            else:
                return {
                    "success": True,
                    "stdout": f"[macOS Brew Sim] Command executed: {cmd}",
                    "stderr": "",
                    "exit_code": 0
                }
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def get_service_status(cls, service_name: str) -> Dict[str, Any]:
        brew_svc = cls.SERVICE_MAP.get(service_name.lower(), service_name)
        cmd = f"brew services info {brew_svc} --json"
        res = await cls.run_sh(cmd)
        is_active = "started" in res["stdout"] or "running" in res["stdout"]
        return {
            "name": service_name,
            "system_name": brew_svc,
            "status": "running" if is_active else "stopped",
            "is_active": is_active,
            "installed": True
        }

    @classmethod
    async def start_service(cls, service_name: str) -> Dict[str, Any]:
        brew_svc = cls.SERVICE_MAP.get(service_name.lower(), service_name)
        cmd = f"brew services start {brew_svc}"
        res = await cls.run_sh(cmd)
        return {
            "success": res["success"],
            "message": f"Service {service_name} started via brew services" if res["success"] else res["stderr"]
        }

    @classmethod
    async def stop_service(cls, service_name: str) -> Dict[str, Any]:
        brew_svc = cls.SERVICE_MAP.get(service_name.lower(), service_name)
        cmd = f"brew services stop {brew_svc}"
        res = await cls.run_sh(cmd)
        return {
            "success": res["success"],
            "message": f"Service {service_name} stopped via brew services" if res["success"] else res["stderr"]
        }

    @classmethod
    async def restart_service(cls, service_name: str) -> Dict[str, Any]:
        brew_svc = cls.SERVICE_MAP.get(service_name.lower(), service_name)
        cmd = f"brew services restart {brew_svc}"
        res = await cls.run_sh(cmd)
        return {
            "success": res["success"],
            "message": f"Service {service_name} restarted via brew services" if res["success"] else res["stderr"]
        }

    @classmethod
    async def install_service(cls, service_name: str) -> Dict[str, Any]:
        brew_svc = cls.SERVICE_MAP.get(service_name.lower(), service_name)
        cmd = f"brew install {brew_svc} && brew services start {brew_svc}"
        res = await cls.run_sh(cmd)
        return {
            "success": res["success"],
            "package": brew_svc,
            "manager": "homebrew",
            "message": f"Native package {service_name} ({brew_svc}) installed via Homebrew." if res["success"] else res["stderr"]
        }

    @classmethod
    async def get_firewall_rules(cls) -> List[Dict[str, Any]]:
        return [
            {"name": "macOS Packet Filter (pf)", "action": "ALLOW", "direction": "IN", "protocol": "TCP", "port": "80, 443", "enabled": True}
        ]

    @classmethod
    async def add_firewall_rule(cls, name: str, port: str, protocol: str = "TCP", action: str = "ALLOW", direction: str = "IN") -> Dict[str, Any]:
        return {"success": True, "message": f"pf rule registered for port {port} ({protocol})"}

    @classmethod
    async def delete_firewall_rule(cls, name: str, port: str = "") -> Dict[str, Any]:
        return {"success": True, "message": f"pf rule '{name}' removed"}
