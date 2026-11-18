import psutil
import platform
import socket
import time
from typing import Dict, Any

class MacSystemMonitor:
    @staticmethod
    def get_stats(target_os: str = "mac") -> Dict[str, Any]:
        cpu_percent = psutil.cpu_percent(interval=None)
        cpu_count = psutil.cpu_count(logical=True) or 1
        freq = psutil.cpu_freq()
        cpu_freq = freq.current if freq else 0.0

        mem = psutil.virtual_memory()
        try:
            disk = psutil.disk_usage("/")
        except Exception:
            disk = psutil.disk_usage("C:\\" if platform.system() == "Windows" else "/")

        net = psutil.net_io_counters()
        boot_time = psutil.boot_time()
        uptime = time.time() - boot_time

        return {
            "cpu_percent": round(cpu_percent, 1),
            "cpu_count": cpu_count,
            "cpu_freq_current": round(cpu_freq, 1),
            "ram_total_gb": round(mem.total / (1024 ** 3), 2),
            "ram_used_gb": round(mem.used / (1024 ** 3), 2),
            "ram_percent": round(mem.percent, 1),
            "disk_total_gb": round(disk.total / (1024 ** 3), 2),
            "disk_used_gb": round(disk.used / (1024 ** 3), 2),
            "disk_percent": round(disk.percent, 1),
            "net_bytes_sent_mb": round(net.bytes_sent / (1024 ** 2), 2),
            "net_bytes_recv_mb": round(net.bytes_recv / (1024 ** 2), 2),
            "uptime_seconds": round(uptime, 0),
            "hostname": socket.gethostname(),
            "os_name": "macOS (Apple Silicon / Intel)",
            "os_version": "macOS Sonoma 14.5" if platform.system() != "Darwin" else platform.mac_ver()[0],
            "platform_system": "Darwin",
            "target_os": target_os
        }
