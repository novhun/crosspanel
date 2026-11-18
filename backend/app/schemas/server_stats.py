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

    class Config:
        from_attributes = True

class ServiceActionRequest(BaseModel):
    action: str # start, stop, restart

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
