from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.settings import ManagedService
from app.services.os_manager.factory import os_manager_factory

router = APIRouter(prefix="/service", tags=["Service Control"])

DEFAULT_SERVICES = [
    {"name": "nginx", "display_name": "Nginx Web Server", "description": "High performance HTTP & reverse proxy server", "default_port": 80, "category": "web"},
    {"name": "php-fpm", "display_name": "PHP-FPM Process Manager", "description": "FastCGI Process Manager for PHP applications", "default_port": 9000, "category": "runtime"},
    {"name": "mariadb", "display_name": "MariaDB / MySQL Server", "description": "Relational SQL database engine", "default_port": 3306, "category": "db"},
    {"name": "docker", "display_name": "Docker Engine", "description": "Container virtualization runtime", "default_port": 2375, "category": "container"},
]

@router.get("/list")
async def list_services(db: AsyncSession = Depends(get_db)):
    results = []
    for svc in DEFAULT_SERVICES:
        name = svc["name"]
        os_status = await os_manager_factory.get_service_status(name)
        
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
                status=os_status.get("status", "stopped"),
                is_active=os_status.get("is_active", False)
            )
            db.add(record)
            await db.commit()
            await db.refresh(record)
        else:
            record.status = os_status.get("status", "stopped")
            record.is_active = os_status.get("is_active", False)
            await db.commit()

        results.append({
            "id": record.id,
            "name": record.name,
            "display_name": record.display_name,
            "description": record.description,
            "default_port": record.default_port,
            "category": record.category,
            "status": record.status,
            "is_active": record.is_active,
            "os_environment": os_manager_factory.os_name
        })
    return results

@router.post("/{service_name}/start")
async def start_service(service_name: str, db: AsyncSession = Depends(get_db)):
    res = await os_manager_factory.start_service(service_name)
    stmt = select(ManagedService).where(ManagedService.name == service_name)
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()
    if record:
        record.status = "running" if res.get("success") else "error"
        record.is_active = res.get("success", False)
        await db.commit()
    return res

@router.post("/{service_name}/stop")
async def stop_service(service_name: str, db: AsyncSession = Depends(get_db)):
    res = await os_manager_factory.stop_service(service_name)
    stmt = select(ManagedService).where(ManagedService.name == service_name)
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()
    if record:
        record.status = "stopped"
        record.is_active = False
        await db.commit()
    return res

@router.post("/{service_name}/restart")
async def restart_service(service_name: str, db: AsyncSession = Depends(get_db)):
    res = await os_manager_factory.restart_service(service_name)
    stmt = select(ManagedService).where(ManagedService.name == service_name)
    db_res = await db.execute(stmt)
    record = db_res.scalar_one_or_none()
    if record:
        record.status = "running" if res.get("success") else "error"
        record.is_active = res.get("success", False)
        await db.commit()
    return res
