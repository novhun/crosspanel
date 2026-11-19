from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class SystemStatus(BaseModel):
    cpu_percent: float
    cpu_count: int
    cpu_freq_current: Optional[float] = 0.0
    ram_total_gb: float
    ram_used_gb: float
    ram_percent: float
    disk_total_gb: float
    disk_used_gb: float
    disk_percent: float
    net_bytes_sent_mb: float
    net_bytes_recv_mb: float
    uptime_seconds: float
    hostname: str
    os_name: str
    os_version: str
    platform_system: str
    target_os: str

class ServiceItemSchema(BaseModel):
    id: Optional[int] = None
    name: str
    display_name: str
    description: Optional[str] = None
    default_port: Optional[int] = None
    is_active: bool = False
    status: str = "stopped"
    os_type: str = "all"
    category: str = "web"
    run_mode: str = "native" # 'native' or 'docker'
    docker_image: Optional[str] = None
    docker_container_name: Optional[str] = None
    available_modes: List[str] = ["native", "docker"]

    class Config:
        from_attributes = True

class ServiceModeUpdate(BaseModel):
    mode: str # 'native' or 'docker'

class ServiceActionRequest(BaseModel):
    action: str # start, stop, restart
    mode: Optional[str] = None # optional mode override

class FirewallRuleCreate(BaseModel):
    name: str
    port: str
    protocol: str = "TCP" # TCP, UDP, ANY
    action: str = "ALLOW" # ALLOW, DENY
    direction: str = "IN" # IN, OUT
    enabled: bool = True

class FirewallRuleResponse(FirewallRuleCreate):
    id: int
    os_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class TargetOSUpdate(BaseModel):
    target_os: str # auto, windows, linux, mac

class ProcessInfo(BaseModel):
    pid: int
    name: str
    username: Optional[str] = "N/A"
    cpu_percent: float = 0.0
    memory_percent: float = 0.0
    memory_mb: float = 0.0
    status: str = "running"
    num_threads: Optional[int] = 1
    create_time: Optional[str] = None

class DiskPartitionInfo(BaseModel):
    device: str
    mountpoint: str
    fstype: str
    total_gb: float
    used_gb: float
    free_gb: float
    percent: float

class NetInterfaceInfo(BaseModel):
    interface: str
    family: str
    address: str
    netmask: Optional[str] = None

class HardwareDiagnostics(BaseModel):
    cpu_model: str
    architecture: str
    physical_cores: int
    logical_cores: int
    cpu_freq_current: float
    cpu_freq_max: float
    ram_total_gb: float
    ram_used_gb: float
    swap_total_gb: float
    swap_used_gb: float
    swap_percent: float
    boot_time: str
    uptime_seconds: float
    hostname: str
    os_name: str
    os_version: str
    partitions: List[DiskPartitionInfo] = []
    network_interfaces: List[NetInterfaceInfo] = []
