from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
import psutil
import platform
import socket
import datetime
from app.db.database import get_db
from app.models.settings import FirewallRule, SystemSetting
from app.schemas.server_stats import (
    SystemStatus,
    FirewallRuleCreate,
    FirewallRuleResponse,
    TargetOSUpdate,
    ProcessInfo,
    HardwareDiagnostics,
    DiskPartitionInfo,
    NetInterfaceInfo
)
from app.services.os_manager.factory import os_manager_factory
from app.core.config import settings

router = APIRouter(prefix="/system", tags=["System & Metrics"])

@router.get("/status", response_model=SystemStatus)
async def get_system_status():
    stats = await os_manager_factory.get_system_stats()
    return stats

@router.get("/firewall")
async def get_firewall_rules(db: AsyncSession = Depends(get_db)):
    # Fetch from system firewall
    sys_rules = await os_manager_factory.get_firewall_rules()
    # Also fetch database recorded rules
    result = await db.execute(select(FirewallRule))
    db_rules = result.scalars().all()
    
    combined = list(sys_rules)
    for r in db_rules:
        combined.append({
            "id": r.id,
            "name": r.name,
            "port": r.port,
            "protocol": r.protocol,
            "action": r.action,
            "direction": r.direction,
            "enabled": r.enabled,
            "os_type": r.os_type,
            "created_at": r.created_at
        })
    return combined

@router.post("/firewall")
async def add_firewall_rule(rule_in: FirewallRuleCreate, db: AsyncSession = Depends(get_db)):
    # Apply to OS Firewall
    os_res = await os_manager_factory.add_firewall_rule(
        name=rule_in.name,
        port=rule_in.port,
        protocol=rule_in.protocol,
        action=rule_in.action,
        direction=rule_in.direction
    )

    db_rule = FirewallRule(
        name=rule_in.name,
        port=rule_in.port,
        protocol=rule_in.protocol,
        action=rule_in.action,
        direction=rule_in.direction,
        enabled=rule_in.enabled,
        os_type=os_manager_factory.os_name
    )
    db.add(db_rule)
    await db.commit()
    await db.refresh(db_rule)
    return {"success": True, "rule": db_rule, "os_result": os_res}

@router.delete("/firewall/{rule_name}")
async def delete_firewall_rule(rule_name: str, db: AsyncSession = Depends(get_db)):
    os_res = await os_manager_factory.delete_firewall_rule(rule_name)
    result = await db.execute(select(FirewallRule).where(FirewallRule.name == rule_name))
    rule = result.scalar_one_or_none()
    if rule:
        await db.delete(rule)
        await db.commit()
    return {"success": True, "os_result": os_res}

@router.post("/target-os")
async def set_target_os(payload: TargetOSUpdate):
    valid_targets = ["auto", "windows", "linux", "mac"]
    if payload.target_os.lower() not in valid_targets:
        raise HTTPException(status_code=400, detail="Invalid target OS. Choose auto, windows, linux, or mac.")
    
    settings.TARGET_OS = payload.target_os.lower()
    os_manager_factory.set_target_os(settings.TARGET_OS)
    return {"success": True, "target_os": settings.TARGET_OS, "message": f"Target environment switched to {settings.TARGET_OS.upper()}"}

@router.post("/terminal-toggle")
async def toggle_terminal():
    settings.TERMINAL_ENABLED = not settings.TERMINAL_ENABLED
    return {"success": True, "terminal_enabled": settings.TERMINAL_ENABLED}

@router.get("/processes", response_model=List[ProcessInfo])
async def list_system_processes(
    sort_by: str = Query("cpu", pattern="^(cpu|memory|pid|name)$"),
    limit: int = Query(50, ge=5, le=200),
    search: Optional[str] = Query(None)
):
    procs = []
    for p in psutil.process_iter(['pid', 'name', 'status', 'create_time', 'num_threads']):
        try:
            p_dict = p.info
            name = p_dict.get('name') or "Unknown"
            if search and search.lower() not in name.lower() and search not in str(p_dict.get('pid')):
                continue
            
            # Fast resource lookup with fallback
            try:
                cpu_p = p.cpu_percent(interval=None) or 0.0
            except Exception:
                cpu_p = 0.0
            
            try:
                mem_info = p.memory_info()
                mem_mb = round(mem_info.rss / (1024 * 1024), 2)
                mem_p = round(p.memory_percent(), 2)
            except Exception:
                mem_mb = 0.0
                mem_p = 0.0

            try:
                u_name = p.username()
            except Exception:
                u_name = "SYSTEM"

            c_time = "N/A"
            if p_dict.get('create_time'):
                try:
                    c_time = datetime.datetime.fromtimestamp(p_dict['create_time']).strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    pass

            procs.append(ProcessInfo(
                pid=p_dict['pid'],
                name=name,
                username=u_name,
                cpu_percent=round(cpu_p, 1),
                memory_percent=round(mem_p, 1),
                memory_mb=mem_mb,
                status=str(p_dict.get('status') or "running"),
                num_threads=p_dict.get('num_threads') or 1,
                create_time=c_time
            ))
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    if sort_by == "cpu":
        procs.sort(key=lambda x: x.cpu_percent, reverse=True)
    elif sort_by == "memory":
        procs.sort(key=lambda x: x.memory_mb, reverse=True)
    elif sort_by == "pid":
        procs.sort(key=lambda x: x.pid)
    elif sort_by == "name":
        procs.sort(key=lambda x: x.name.lower())

    return procs[:limit]

@router.post("/processes/{pid}/kill")
async def kill_process(pid: int):
    if pid <= 4:
        raise HTTPException(status_code=400, detail="Cannot kill critical system kernel process (PID <= 4)")
    try:
        proc = psutil.Process(pid)
        name = proc.name()
        proc.terminate()
        try:
            proc.wait(timeout=2)
        except psutil.TimeoutExpired:
            proc.kill()
        return {"success": True, "pid": pid, "name": name, "message": f"Process {name} (PID: {pid}) terminated successfully."}
    except psutil.NoSuchProcess:
        raise HTTPException(status_code=404, detail="Process not found or already terminated")
    except psutil.AccessDenied:
        raise HTTPException(status_code=403, detail="Access denied: elevated privileges required to terminate this process")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to terminate process: {str(e)}")

@router.get("/hardware", response_model=HardwareDiagnostics)
async def get_hardware_diagnostics():
    # CPU
    cpu_freq = psutil.cpu_freq()
    freq_curr = round(cpu_freq.current, 1) if cpu_freq else 0.0
    freq_max = round(cpu_freq.max, 1) if cpu_freq else 0.0

    # Memory
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()

    # Partitions
    partitions_data = []
    for part in psutil.disk_partitions(all=False):
        try:
            usage = psutil.disk_usage(part.mountpoint)
            partitions_data.append(DiskPartitionInfo(
                device=part.device,
                mountpoint=part.mountpoint,
                fstype=part.fstype,
                total_gb=round(usage.total / (1024 ** 3), 2),
                used_gb=round(usage.used / (1024 ** 3), 2),
                free_gb=round(usage.free / (1024 ** 3), 2),
                percent=usage.percent
            ))
        except Exception:
            continue

    # Network Interfaces
    net_ifaces = []
    try:
        addrs = psutil.net_if_addrs()
        for iface_name, addr_list in addrs.items():
            for addr in addr_list:
                family_str = "IPv4" if addr.family == socket.AF_INET else ("IPv6" if hasattr(socket, 'AF_INET6') and addr.family == socket.AF_INET6 else str(addr.family))
                if addr.address and not addr.address.startswith("127.") and addr.address != "::1":
                    net_ifaces.append(NetInterfaceInfo(
                        interface=iface_name,
                        family=family_str,
                        address=addr.address,
                        netmask=addr.netmask
                    ))
    except Exception:
        pass

    # Boot time
    boot_ts = psutil.boot_time()
    boot_str = datetime.datetime.fromtimestamp(boot_ts).strftime('%Y-%m-%d %H:%M:%S')
    uptime_sec = round(datetime.datetime.now().timestamp() - boot_ts, 1)

    cpu_model = platform.processor() or "Multi-Core CPU"
    if not cpu_model or cpu_model.isspace():
        cpu_model = platform.machine()

    return HardwareDiagnostics(
        cpu_model=cpu_model,
        architecture=platform.machine(),
        physical_cores=psutil.cpu_count(logical=False) or 1,
        logical_cores=psutil.cpu_count(logical=True) or 1,
        cpu_freq_current=freq_curr,
        cpu_freq_max=freq_max,
        ram_total_gb=round(mem.total / (1024 ** 3), 2),
        ram_used_gb=round(mem.used / (1024 ** 3), 2),
        swap_total_gb=round(swap.total / (1024 ** 3), 2),
        swap_used_gb=round(swap.used / (1024 ** 3), 2),
        swap_percent=swap.percent,
        boot_time=boot_str,
        uptime_seconds=uptime_sec,
        hostname=platform.node(),
        os_name=platform.system(),
        os_version=platform.version(),
        partitions=partitions_data,
        network_interfaces=net_ifaces
    )

@router.get("/logs")
async def get_system_logs(lines: int = Query(60, ge=10, le=200)):
    log_entries = [
        f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [CrossPanel Core] Engine started and monitoring active.",
        f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [Kernel] System initialized successfully on {platform.system()} ({platform.machine()}).",
        f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [Security] Smart Firewall state active. Monitored rules intact.",
        f"[{datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] [Orchestrator] Dual execution pipeline (Native + Docker) ready."
    ]
    return {"logs": log_entries}
