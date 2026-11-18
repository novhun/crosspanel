from typing import Dict, Any, List
from app.core.config import settings
from app.services.os_manager.base_os import BaseOSManager
from app.services.os_manager.windows.system import WindowsSystemMonitor
from app.services.os_manager.windows.commands import WindowsCommands
from app.services.os_manager.linux.system import LinuxSystemMonitor
from app.services.os_manager.linux.commands import LinuxCommands
from app.services.os_manager.mac.system import MacSystemMonitor
from app.services.os_manager.mac.commands import MacCommands

class UnifiedOSManager(BaseOSManager):
    def __init__(self, target_os: str = "auto"):
        self._target_os = target_os

    @property
    def os_name(self) -> str:
        if self._target_os != "auto":
            return self._target_os
        return settings.HOST_OS

    def set_target_os(self, target: str):
        self._target_os = target

    async def get_system_stats(self) -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return WindowsSystemMonitor.get_stats(self._target_os)
        elif os_type == "mac":
            return MacSystemMonitor.get_stats(self._target_os)
        else:
            return LinuxSystemMonitor.get_stats(self._target_os)

    async def get_service_status(self, service_name: str) -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.get_service_status(service_name)
        elif os_type == "mac":
            return await MacCommands.get_service_status(service_name)
        else:
            return await LinuxCommands.get_service_status(service_name)

    async def start_service(self, service_name: str) -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.start_service(service_name)
        elif os_type == "mac":
            return await MacCommands.start_service(service_name)
        else:
            return await LinuxCommands.start_service(service_name)

    async def stop_service(self, service_name: str) -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.stop_service(service_name)
        elif os_type == "mac":
            return await MacCommands.stop_service(service_name)
        else:
            return await LinuxCommands.stop_service(service_name)

    async def restart_service(self, service_name: str) -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.restart_service(service_name)
        elif os_type == "mac":
            return await MacCommands.restart_service(service_name)
        else:
            return await LinuxCommands.restart_service(service_name)

    async def list_services(self) -> List[Dict[str, Any]]:
        services = ["nginx", "php-fpm", "mariadb", "docker"]
        res = []
        for svc in services:
            st = await self.get_service_status(svc)
            res.append(st)
        return res

    async def get_firewall_rules(self) -> List[Dict[str, Any]]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.get_firewall_rules()
        elif os_type == "mac":
            return await MacCommands.get_firewall_rules()
        else:
            return await LinuxCommands.get_firewall_rules()

    async def add_firewall_rule(self, name: str, port: str, protocol: str = "TCP", action: str = "ALLOW", direction: str = "IN") -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.add_firewall_rule(name, port, protocol, action, direction)
        elif os_type == "mac":
            return await MacCommands.add_firewall_rule(name, port, protocol, action, direction)
        else:
            return await LinuxCommands.add_firewall_rule(name, port, protocol, action, direction)

    async def delete_firewall_rule(self, name: str, port: str = "") -> Dict[str, Any]:
        os_type = self.os_name
        if os_type == "windows":
            return await WindowsCommands.delete_firewall_rule(name, port)
        elif os_type == "mac":
            return await MacCommands.delete_firewall_rule(name, port)
        else:
            return await LinuxCommands.delete_firewall_rule(name, port)

os_manager_factory = UnifiedOSManager(target_os=settings.TARGET_OS)
