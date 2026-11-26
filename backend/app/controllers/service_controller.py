from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.database import get_db
from app.models.settings import ManagedService
from app.services.docker_service import DockerService
from app.services.os_manager.factory import os_manager_factory
from app.services.package_manager import get_os_type

router = APIRouter(prefix="/service", tags=["Service Management"])


class ModeSwitchRequest(BaseModel):
    mode: str  # 'native' or 'docker'


class ServiceActionRequest(BaseModel):
    mode: Optional[str] = None


class InstallRequest(BaseModel):
    mode: str = "native"
    version: Optional[str] = "latest"


class UninstallRequest(BaseModel):
    mode: Optional[str] = "native"


DEFAULT_SERVICES = [
    {
        "name": "nginx",
        "display_name": "Nginx Web Server",
        "description": "High-performance HTTP web server & reverse proxy.",
        "default_port": 80,
        "category": "web",
        "docker_image": "nginx:alpine",
        "docker_container_name": "crosspanel_nginx",
        "supports_docker": True,
    },
    {
        "name": "apache",
        "display_name": "Apache",
        "description": "HTTP web server with dynamic module support.",
        "default_port": 8081,
        "category": "web",
        "docker_image": "httpd:alpine",
        "docker_container_name": "crosspanel_apache",
        "supports_docker": True,
    },
    {
        "name": "php-fpm",
        "display_name": "PHP-FPM Runtime",
        "description": "FastCGI Process Manager for PHP web applications.",
        "default_port": 9000,
        "category": "runtime",
        "docker_image": "php:8.2-fpm-alpine",
        "docker_container_name": "crosspanel_phpfpm",
        "supports_docker": True,
    },
    {
        "name": "mariadb",
        "display_name": "MariaDB Database Server",
        "description": "Fast, open-source SQL relational database engine.",
        "default_port": 3306,
        "category": "db",
        "docker_image": "mariadb:10.11",
        "docker_container_name": "crosspanel_mariadb",
        "supports_docker": True,
    },
    {
        "name": "postgresql",
        "display_name": "PostgreSQL",
        "description": "Advanced enterprise object-relational SQL database.",
        "default_port": 5432,
        "category": "db",
        "docker_image": "postgres:16-alpine",
        "docker_container_name": "crosspanel_postgres",
        "supports_docker": True,
    },
    {
        "name": "redis",
        "display_name": "Redis Cache Server",
        "description": "In-memory data structure store for caching and sessions.",
        "default_port": 6379,
        "category": "cache",
        "docker_image": "redis:alpine",
        "docker_container_name": "crosspanel_redis",
        "supports_docker": True,
    },
    {
        "name": "memcached",
        "display_name": "Memcached",
        "description": "High-performance distributed memory object caching system.",
        "default_port": 11211,
        "category": "cache",
        "docker_image": "memcached:alpine",
        "docker_container_name": "crosspanel_memcached",
        "supports_docker": True,
    },
    {
        "name": "supervisor",
        "display_name": "Supervisor",
        "description": "Process control system for background workers and queues.",
        "default_port": 9001,
        "category": "runtime",
        "docker_image": "ochinchina/supervisord:latest",
        "docker_container_name": "crosspanel_supervisor",
        "supports_docker": True,
    },
    {
        "name": "docker",
        "display_name": "Docker Engine",
        "description": "Container virtualization runtime for isolated apps.",
        "default_port": 2375,
        "category": "container",
        "docker_image": "",
        "docker_container_name": "",
        "supports_docker": False,
    },
]


def _canonical_service_name(name: str) -> str:
    n = name.lower().strip().replace(" ", "-")
    if "nginx" in n:
        return "nginx"
    if "apache" in n or "httpd" in n:
        return "apache"
    if "php" in n:
        return "php-fpm"
    if "maria" in n:
        return "mariadb"
    if "mysql" in n:
        return "mysql"
    if "postgres" in n:
        return "postgresql"
    if "redis" in n:
        return "redis"
    if "memcached" in n:
        return "memcached"
    if "supervisor" in n:
        return "supervisor"
    if "docker" in n:
        return "docker"
    return n


async def _ensure_seed_services(db: AsyncSession) -> List[ManagedService]:
    result = await db.execute(select(ManagedService))
    existing = result.scalars().all()
    existing_names = {s.name for s in existing}
    added = False
    for s_def in DEFAULT_SERVICES:
        if s_def["name"] not in existing_names:
            db.add(
                ManagedService(
                    name=s_def["name"],
                    display_name=s_def["display_name"],
                    description=s_def["description"],
                    default_port=s_def["default_port"],
                    category=s_def["category"],
                    run_mode="native",
                    docker_image=s_def["docker_image"],
                    docker_container_name=s_def["docker_container_name"],
                )
            )
            added = True
    if added:
        await db.commit()
        result = await db.execute(select(ManagedService))
        existing = result.scalars().all()
    return existing


_SUPPORTS_DOCKER = {s["name"]: s["supports_docker"] for s in DEFAULT_SERVICES}


@router.get("/list")
async def list_services(db: AsyncSession = Depends(get_db)):
    services = await _ensure_seed_services(db)
    os_type = get_os_type()
    output: List[Dict[str, Any]] = []

    for svc in services:
        supports_docker = _SUPPORTS_DOCKER.get(svc.name, svc.name != "docker")
        native_info = await os_manager_factory.get_service_status(svc.name)
        native_installed = bool(native_info.get("installed", False))
        native_running = bool(native_info.get("is_active", False))
        native_status = "running" if native_running else ("stopped" if native_installed else "not_installed")

        docker_installed = False
        docker_running = False
        docker_available = False
        docker_status = "not_installed"
        if supports_docker:
            d_info = await DockerService.get_service_container_info(svc.name)
            docker_available = bool(d_info.get("docker_available", False))
            docker_installed = bool(d_info.get("installed", False))
            docker_running = bool(d_info.get("is_active", False))
            docker_status = d_info.get("status", "stopped") if docker_installed else "not_installed"

        # Smart run_mode selection if only one is actually installed on host
        effective_mode = svc.run_mode
        if effective_mode == "docker" and not supports_docker:
            effective_mode = "native"
        elif effective_mode == "native" and not native_installed and docker_installed:
            effective_mode = "docker"
        elif effective_mode == "docker" and not docker_installed and native_installed:
            effective_mode = "native"

        active_status = docker_status if effective_mode == "docker" else native_status
        is_active = docker_running if effective_mode == "docker" else native_running
        installed = docker_installed or native_installed
        available_modes = ["native", "docker"] if supports_docker else ["native"]

        output.append({
            "id": svc.id,
            "name": svc.name,
            "display_name": svc.display_name,
            "description": svc.description,
            "default_port": svc.default_port,
            "category": svc.category,
            "run_mode": effective_mode,
            "supports_docker": supports_docker,
            "available_modes": available_modes,
            "status": "running" if is_active else "stopped",
            "is_active": is_active,
            "installed": installed,
            "native_installed": native_installed,
            "native_running": native_running,
            "native_status": native_status,
            "native_version": native_info.get("version") or "",
            "docker_installed": docker_installed,
            "docker_running": docker_running,
            "docker_status": docker_status,
            "docker_available": docker_available,
            "docker_image": svc.docker_image,
            "docker_container_name": svc.docker_container_name,
            "version": (native_info.get("version") or svc.docker_image or "") if installed else "",
            "install_command": native_info.get("install_command") or "",
            "uninstall_command": native_info.get("uninstall_command") or "",
            "manager": native_info.get("manager") or "",
            "binary_path": native_info.get("binary_path") or "",
            "os_type": os_type,
        })

    return output


@router.post("/{service_name}/install")
async def install_service_endpoint(
    service_name: str,
    req: InstallRequest,
    db: AsyncSession = Depends(get_db),
):
    canon = _canonical_service_name(service_name)
    mode = req.mode.lower()
    if mode not in ("native", "docker"):
        raise HTTPException(status_code=400, detail="Mode must be 'native' or 'docker'")

    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()

    if mode == "docker":
        if not _SUPPORTS_DOCKER.get(canon, canon != "docker"):
            raise HTTPException(status_code=400, detail=f"{service_name} does not support Docker mode")
        res = await DockerService.install_service_container(canon, req.version or "latest")
    else:
        res = await os_manager_factory.install_service(canon, version=req.version)

    if svc and res.get("success"):
        svc.run_mode = mode
        await db.commit()

    return {
        "success": bool(res.get("success", False)),
        "name": canon,
        "mode": mode,
        "version": res.get("version") or req.version or "latest",
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "output": res.get("output") or "",
        "message": res.get("message") or "",
    }


@router.post("/{service_name}/uninstall")
async def uninstall_service_endpoint(
    service_name: str,
    req: UninstallRequest = UninstallRequest(),
    db: AsyncSession = Depends(get_db),
):
    canon = _canonical_service_name(service_name)
    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()

    mode = (req.mode or (svc.run_mode if svc else "native")).lower()
    if mode == "docker":
        res = await DockerService.uninstall_service_container(canon)
    else:
        res = await os_manager_factory.uninstall_service(canon)

    return {
        "success": bool(res.get("success", False)),
        "name": canon,
        "mode": mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "output": res.get("output") or "",
        "message": res.get("message") or "",
    }


@router.post("/{service_name}/mode")
async def switch_service_mode(service_name: str, req: ModeSwitchRequest, db: AsyncSession = Depends(get_db)):
    if req.mode not in ("native", "docker"):
        raise HTTPException(status_code=400, detail="Mode must be 'native' or 'docker'")

    canon = _canonical_service_name(service_name)
    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=404, detail=f"Service '{service_name}' not found")
    if req.mode == "docker" and not _SUPPORTS_DOCKER.get(canon, canon != "docker"):
        raise HTTPException(status_code=400, detail=f"Service '{svc.display_name}' runs natively and does not support Docker container mode")

    svc.run_mode = req.mode
    await db.commit()
    return {"success": True, "name": canon, "mode": req.mode, "message": f"{svc.display_name} switched to {req.mode.upper()} mode."}


@router.post("/{service_name}/start")
async def start_service(
    service_name: str,
    req: ServiceActionRequest = ServiceActionRequest(),
    db: AsyncSession = Depends(get_db),
):
    canon = _canonical_service_name(service_name)
    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()
    target_mode = req.mode or (svc.run_mode if svc else "native")

    if target_mode == "docker":
        if not _SUPPORTS_DOCKER.get(canon, canon != "docker"):
            raise HTTPException(status_code=400, detail="Docker mode unsupported for this service")
        res = await DockerService.start_service_container(canon)
    else:
        res = await os_manager_factory.start_service(canon)

    return {
        "success": bool(res.get("success", False)),
        "mode": target_mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "message": res.get("message") or "",
        "details": res,
    }


@router.post("/{service_name}/stop")
async def stop_service(
    service_name: str,
    req: ServiceActionRequest = ServiceActionRequest(),
    db: AsyncSession = Depends(get_db),
):
    canon = _canonical_service_name(service_name)
    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()
    target_mode = req.mode or (svc.run_mode if svc else "native")

    if target_mode == "docker":
        res = await DockerService.stop_service_container(canon)
    else:
        res = await os_manager_factory.stop_service(canon)

    return {
        "success": bool(res.get("success", False)),
        "mode": target_mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "message": res.get("message") or "",
        "details": res,
    }


@router.post("/{service_name}/restart")
async def restart_service(
    service_name: str,
    req: ServiceActionRequest = ServiceActionRequest(),
    db: AsyncSession = Depends(get_db),
):
    canon = _canonical_service_name(service_name)
    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()
    target_mode = req.mode or (svc.run_mode if svc else "native")

    if target_mode == "docker":
        res = await DockerService.restart_service_container(canon)
    else:
        res = await os_manager_factory.restart_service(canon)

    return {
        "success": bool(res.get("success", False)),
        "mode": target_mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "message": res.get("message") or "",
        "details": res,
    }


@router.get("/{service_name}/logs")
async def get_service_logs(
    service_name: str,
    mode: Optional[str] = None,
    lines: int = 80,
    db: AsyncSession = Depends(get_db),
):
    canon = _canonical_service_name(service_name)
    result = await db.execute(select(ManagedService).where(ManagedService.name == canon))
    svc = result.scalar_one_or_none()
    target_mode = mode or (svc.run_mode if svc else "native")

    if target_mode == "docker":
        cname = svc.docker_container_name if svc and svc.docker_container_name else f"crosspanel_{canon}"
        logs_text = await DockerService.get_container_logs(cname, lines=lines)
    else:
        logs_text = await os_manager_factory.get_service_logs(canon, lines=lines)
    return {"name": canon, "mode": target_mode, "logs": logs_text}
