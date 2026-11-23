from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.db.database import get_db
from app.models.settings import ManagedService
from app.schemas.server_stats import ServiceItemSchema, ServiceModeUpdate, ServiceActionRequest
from app.services.os_manager.factory import os_manager_factory
from app.services.docker_service import DockerService

router = APIRouter(prefix="/service", tags=["Service Control (Dual Mode: Native OS & Docker)"])

DEFAULT_SERVICES = [
    {
        "name": "nginx",
        "display_name": "Nginx Web Server",
        "description": "High performance HTTP & reverse proxy server",
        "default_port": 80,
        "category": "web",
        "docker_image": "nginx:alpine",
        "docker_container_name": "crosspanel_nginx",
        "supports_docker": True
    },
    {
        "name": "php-fpm",
        "display_name": "PHP-FPM Process Manager",
        "description": "FastCGI Process Manager for PHP applications",
        "default_port": 9000,
        "category": "runtime",
        "docker_image": "php:8.2-fpm-alpine",
        "docker_container_name": "crosspanel_phpfpm",
        "supports_docker": True
    },
    {
        "name": "mariadb",
        "display_name": "MariaDB / MySQL Server",
        "description": "Relational SQL database engine",
        "default_port": 3306,
        "category": "db",
        "docker_image": "mariadb:10.11",
        "docker_container_name": "crosspanel_mariadb",
        "supports_docker": True
    },
    {
        "name": "redis",
        "display_name": "Redis In-Memory Store",
        "description": "High performance in-memory cache and message broker",
        "default_port": 6379,
        "category": "db",
        "docker_image": "redis:alpine",
        "docker_container_name": "crosspanel_redis",
        "supports_docker": True
    },
    {
        "name": "postgresql",
        "display_name": "PostgreSQL Database",
        "description": "Advanced relational SQL database engine",
        "default_port": 5432,
        "category": "db",
        "docker_image": "postgres:16-alpine",
        "docker_container_name": "crosspanel_postgres",
        "supports_docker": True
    },
    {
        "name": "docker",
        "display_name": "Docker Engine",
        "description": "Container virtualization runtime on host OS",
        "default_port": 2375,
        "category": "container",
        "docker_image": None,
        "docker_container_name": None,
        "supports_docker": False
    },
]

@router.get("/list")
async def list_services(db: AsyncSession = Depends(get_db)):
    results = []
    for svc in DEFAULT_SERVICES:
        name = svc["name"]
        
        # Check DB or create
        stmt = select(ManagedService).where(ManagedService.name == name)
        db_res = await db.execute(stmt)
        record = db_res.scalar_one_or_none()

        if not record:
            record = ManagedService(
                name=name,
                display_name=svc["display_name"],
                description=svc["description"],
                default_port=svc["default_port"],
                category=svc["category"],
                run_mode="native",
                docker_image=svc.get("docker_image"),
                docker_container_name=svc.get("docker_container_name"),
                status="stopped",
                is_active=False
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
        else:
            updated = False
            if not record.docker_image and svc.get("docker_image"):
                record.docker_image = svc.get("docker_image")
                updated = True
            if not record.docker_container_name and svc.get("docker_container_name"):
                record.docker_container_name = svc.get("docker_container_name")
                updated = True
            if updated:
                await db.commit()

        current_mode = record.run_mode or "native"

        # Check native status
        native_status = await os_manager_factory.get_service_status(name)

        # Check docker container status if supported
        docker_status = {"status": "stopped", "is_active": False}
        if svc.get("supports_docker"):
            docker_status = await DockerService.get_service_container_info(name)

        # Active status depends on selected run_mode
        if current_mode == "docker":
            active_status = docker_status.get("status", "stopped")
            is_active = docker_status.get("is_active", False)
        else:
            active_status = native_status.get("status", "stopped")
            is_active = native_status.get("is_active", False)

        record.status = active_status
        record.is_active = is_active
        await db.commit()

        results.append({
            "id": record.id,
            "name": record.name,
            "display_name": record.display_name,
            "description": record.description,
            "default_port": record.default_port,
            "category": record.category,
            "run_mode": current_mode,
            "available_modes": ["native", "docker"] if svc.get("supports_docker") else ["native"],
            "status": active_status,
            "is_active": is_active,
            "native_status": native_status.get("status", "stopped"),
            "docker_status": docker_status.get("status", "stopped"),
            "docker_image": record.docker_image,
            "docker_container_name": record.docker_container_name,
            "os_environment": os_manager_factory.os_name
        })
    return results

class ServiceInstallRequest(BaseModel):
    mode: Optional[str] = "native"
    version: Optional[str] = "latest"

@router.post("/{service_name}/install")
async def install_service_endpoint(service_name: str, payload: Optional[ServiceInstallRequest] = None, db: AsyncSession = Depends(get_db)):
    mode = (payload.mode if payload else "native") or "native"
    stmt = select(ManagedService).where(ManagedService.name == service_name)
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()

    if mode == "native":
        res = await os_manager_factory.install_service(service_name)
    else:
        if record and record.docker_image:
            res = await DockerService.pull_image(record.docker_image)
        else:
            res = {"success": True, "message": f"Docker image for {service_name} prepared."}

    if record:
        record.run_mode = mode
        if res.get("success"):
            record.status = "stopped"
        await db.commit()

    return {
        "success": res.get("success", True),
        "name": service_name,
        "mode": mode,
        "message": res.get("message", f"Service {service_name} installed successfully ({mode} mode).")
    }

def normalize_service_name(name: str) -> str:
    n = name.lower().replace("-", "").replace("_", "").replace(" ", "")
    if "nginx" in n:
        return "nginx"
    if "php" in n:
        return "php-fpm"
    if "maria" in n or "mysql" in n:
        return "mariadb"
    if "redis" in n:
        return "redis"
    if "postgres" in n:
        return "postgresql"
    if "docker" in n:
        return "docker"
    return name.lower()

@router.post("/{service_name}/mode")
async def update_service_mode(service_name: str, payload: ServiceModeUpdate, db: AsyncSession = Depends(get_db)):
    if payload.mode.lower() not in ["native", "docker"]:
        raise HTTPException(status_code=400, detail="Mode must be 'native' or 'docker'")

    canon = normalize_service_name(service_name)
    stmt = select(ManagedService).where(
        (ManagedService.name == canon) |
        (ManagedService.name == service_name) |
        (ManagedService.display_name.ilike(f"%{service_name}%"))
    )
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()

    if not record:
        raise HTTPException(status_code=404, detail="Service not found")

    record.run_mode = payload.mode.lower()
    await db.commit()
    await db.refresh(record)

    return {
        "success": True,
        "name": record.name,
        "run_mode": record.run_mode,
        "message": f"Service {record.name} run mode switched to {record.run_mode.upper()}."
    }

@router.post("/{service_name}/start")
async def start_service(service_name: str, mode: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    canon = normalize_service_name(service_name)
    stmt = select(ManagedService).where(
        (ManagedService.name == canon) |
        (ManagedService.name == service_name) |
        (ManagedService.display_name.ilike(f"%{service_name}%"))
    )
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()

    target_mode = mode or (record.run_mode if record else "native")

    if target_mode == "docker":
        res = await DockerService.start_service_container(canon)
    else:
        res = await os_manager_factory.start_service(canon)

    if record:
        record.status = "running" if res.get("success") else "error"
        record.is_active = res.get("success", False)
        record.run_mode = target_mode
        await db.commit()

    return {**res, "mode": target_mode, "name": canon}

@router.post("/{service_name}/stop")
async def stop_service(service_name: str, mode: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    canon = normalize_service_name(service_name)
    stmt = select(ManagedService).where(
        (ManagedService.name == canon) |
        (ManagedService.name == service_name) |
        (ManagedService.display_name.ilike(f"%{service_name}%"))
    )
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()

    target_mode = mode or (record.run_mode if record else "native")

    if target_mode == "docker":
        res = await DockerService.stop_service_container(canon)
    else:
        res = await os_manager_factory.stop_service(canon)

    if record:
        record.status = "stopped"
        record.is_active = False
        record.run_mode = target_mode
        await db.commit()

    return {**res, "mode": target_mode, "name": canon}

@router.post("/{service_name}/restart")
async def restart_service(service_name: str, mode: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    canon = normalize_service_name(service_name)
    stmt = select(ManagedService).where(
        (ManagedService.name == canon) |
        (ManagedService.name == service_name) |
        (ManagedService.display_name.ilike(f"%{service_name}%"))
    )
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()

    target_mode = mode or (record.run_mode if record else "native")

    if target_mode == "docker":
        res = await DockerService.restart_service_container(canon)
    else:
        res = await os_manager_factory.restart_service(canon)

    if record:
        record.status = "running" if res.get("success") else "error"
        record.is_active = res.get("success", False)
        record.run_mode = target_mode
        await db.commit()

    return {**res, "mode": target_mode, "name": canon}

