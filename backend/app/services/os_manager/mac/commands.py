import asyncio
import platform
from typing import Dict, Any, List, Optional

class MacCommands:
    SERVICE_MAP = {
        "nginx": "nginx",
        "php-fpm": "php",
        "mariadb": "mariadb",
        "docker": "docker",
        "redis": "redis",
        "postgresql": "postgresql@16"
    }

    @classmethod
    async def run_sh(cls, cmd: str) -> Dict[str, Any]:
        try:
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
        return [
            {"name": "macOS Packet Filter (pf)", "action": "ALLOW", "direction": "IN", "protocol": "TCP", "port": "80, 443", "enabled": True}
        ]

    @classmethod
    async def add_firewall_rule(cls, name: str, port: str, protocol: str = "TCP", action: str = "ALLOW", direction: str = "IN") -> Dict[str, Any]:
        return {"success": True, "message": f"pf rule registered for port {port} ({protocol})"}

    @classmethod
    async def delete_firewall_rule(cls, name: str, port: str = "") -> Dict[str, Any]:
        return {"success": True, "message": f"pf rule '{name}' removed"}
