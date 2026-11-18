from abc import ABC, abstractmethod
from typing import Dict, Any, List

class BaseOSManager(ABC):
    @property
    @abstractmethod
    def os_name(self) -> str:
        """Returns the OS identifier (linux, windows, mac)."""
        pass

    @abstractmethod
    async def get_system_stats(self) -> Dict[str, Any]:
        """Collect CPU, RAM, Disk, Network and uptime statistics."""
        pass

    @abstractmethod
    async def get_service_status(self, service_name: str) -> Dict[str, Any]:
        """Check the status of a specific service."""
        pass

    @abstractmethod
    async def start_service(self, service_name: str) -> Dict[str, Any]:
        """Start a service using OS-native tools."""
        pass

    @abstractmethod
    async def stop_service(self, service_name: str) -> Dict[str, Any]:
        """Stop a service using OS-native tools."""
        pass

    @abstractmethod
    async def restart_service(self, service_name: str) -> Dict[str, Any]:
        """Restart a service using OS-native tools."""
        pass

    @abstractmethod
    async def list_services(self) -> List[Dict[str, Any]]:
        """List commonly monitored services and their statuses."""
        pass

    @abstractmethod
    async def get_firewall_rules(self) -> List[Dict[str, Any]]:
        """Retrieve active firewall rules."""
        pass

    @abstractmethod
    async def add_firewall_rule(self, name: str, port: str, protocol: str = "TCP", action: str = "ALLOW", direction: str = "IN") -> Dict[str, Any]:
        """Add a new firewall rule using the OS firewall."""
        pass

    @abstractmethod
    async def delete_firewall_rule(self, name: str, port: str = "") -> Dict[str, Any]:
        """Delete an existing firewall rule."""
        pass
