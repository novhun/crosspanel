import asyncio
import shutil
import platform
from typing import Dict, Any, List, Optional

class LinuxCommands:
    SERVICE_MAP = {
        "nginx": "nginx",
        "php-fpm": "php8.2-fpm",
        "mariadb": "mariadb",
        "docker": "docker",
        "redis": "redis-server",
        "postgresql": "postgresql"
    }

    @classmethod
    async def run_bash(cls, cmd: str) -> Dict[str, Any]:
        try:
            # If on native Linux:
            if platform.system() == "Linux":
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
            # If running on Windows with WSL available:
            elif shutil.which("wsl"):
                proc = await asyncio.create_subprocess_exec(
                    "wsl", "bash", "-c", cmd,
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
                # Simulated Linux response when on non-Linux host without WSL
                return {
                    "success": True,
                    "stdout": f"[Linux Sim] Command executed: {cmd}",
                    "stderr": "",
                    "exit_code": 0
                }
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def get_service_status(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.detect_package(service_name)

    @classmethod
    async def start_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.control_service(service_name, "start")

    @classmethod
    async def stop_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.control_service(service_name, "stop")

    @classmethod
    async def restart_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.control_service(service_name, "restart")

    @classmethod
    async def install_service(cls, service_name: str, version: Optional[str] = None) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.install_package(service_name, version=version)

    @classmethod
    async def uninstall_service(cls, service_name: str) -> Dict[str, Any]:
        from app.services.package_manager import PackageManagerService
        return await PackageManagerService.uninstall_package(service_name)

    @classmethod
    async def get_firewall_rules(cls) -> List[Dict[str, Any]]:
        cmd = "ufw status numbered"
        res = await cls.run_bash(cmd)
        rules = []
        if res["success"]:
            for line in res["stdout"].split("\n"):
                if "ALLOW" in line or "DENY" in line:
                    parts = line.split()
                    rules.append({
                        "name": f"Rule {parts[0] if parts else 'UFW'}",
                        "action": "ALLOW" if "ALLOW" in line else "DENY",
                        "direction": "IN",
                        "protocol": "TCP/UDP",
                        "port": parts[1] if len(parts) > 1 else "Custom",
                        "enabled": True
                    })
        return rules

    @classmethod
    async def add_firewall_rule(cls, name: str, port: str, protocol: str = "TCP", action: str = "ALLOW", direction: str = "IN") -> Dict[str, Any]:
        act = "allow" if action.upper() == "ALLOW" else "deny"
        cmd = f"ufw {act} {port}/{protocol.lower()}"
        res = await cls.run_bash(cmd)
        return {
            "success": res["success"],
            "message": f"UFW rule applied: {cmd}" if res["success"] else res["stderr"]
        }

    @classmethod
    async def delete_firewall_rule(cls, name: str, port: str = "") -> Dict[str, Any]:
        cmd = f"ufw delete allow {port}" if port else f"ufw delete allow {name}"
        res = await cls.run_bash(cmd)
        return {
            "success": res["success"],
            "message": f"UFW rule removed: {name}" if res["success"] else res["stderr"]
        }
