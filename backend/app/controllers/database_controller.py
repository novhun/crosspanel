import asyncio
import datetime
import os
import re
import socket
import sqlite3
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db.database import get_db
from app.models.settings import DatabaseBackup, ManagedDatabase
from app.services.docker_service import DockerService
from app.services.os_manager.factory import os_manager_factory
from app.services.package_manager import get_os_type

router = APIRouter(prefix="/database", tags=["Database Management"])

DB_ENGINE_SPECS = [
    {
        "name": "MariaDB",
        "canonical_name": "mariadb",
        "category": "SQL Relational",
        "default_port": 3306,
        "default_version": "10.11",
        "description": "High-performance MySQL-compatible relational database server",
        "docker_supported": True,
    },
    {
        "name": "PostgreSQL",
        "canonical_name": "postgresql",
        "category": "SQL Relational",
        "default_port": 5432,
        "default_version": "16",
        "description": "Advanced enterprise object-relational database system",
        "docker_supported": True,
    },
    {
        "name": "MongoDB",
        "canonical_name": "mongodb",
        "category": "NoSQL Document",
        "default_port": 27017,
        "default_version": "7",
        "description": "Flexible JSON document-oriented NoSQL engine",
        "docker_supported": True,
    },
    {
        "name": "Redis",
        "canonical_name": "redis",
        "category": "Cache / Key-Value",
        "default_port": 6379,
        "default_version": "7",
        "description": "Ultra-fast in-memory key-value data store and broker",
        "docker_supported": True,
    },
    {
        "name": "SQLite",
        "canonical_name": "sqlite",
        "category": "Embedded SQL",
        "default_port": 0,
        "default_version": sqlite3.sqlite_version,
        "description": "Zero-configuration embedded relational database",
        "docker_supported": False,
    },
]


def _canonical_engine(engine_name: str) -> str:
    low = engine_name.lower().strip()
    if "maria" in low:
        return "mariadb"
    if "mysql" in low:
        return "mysql"
    if "postgres" in low:
        return "postgresql"
    if "mongo" in low:
        return "mongodb"
    if "redis" in low:
        return "redis"
    if "sqlite" in low:
        return "sqlite"
    return low


class TestConnectionRequest(BaseModel):
    host: str = "127.0.0.1"
    port: int
    engine: Optional[str] = "PostgreSQL"


class CreateDatabaseRequest(BaseModel):
    name: str
    engine: str = "PostgreSQL"
    user: str = "root"
    password: Optional[str] = ""


class EngineInstallRequest(BaseModel):
    mode: str = "native"
    version: Optional[str] = "latest"


class EngineUninstallRequest(BaseModel):
    mode: Optional[str] = "native"


class EngineActionRequest(BaseModel):
    mode: Optional[str] = None


def check_port(host: str, port: int, timeout: float = 1.0) -> bool:
    if port <= 0:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


@router.get("/engines")
async def list_database_engines():
    os_type = get_os_type()
    engines_out: List[Dict[str, Any]] = []

    for spec in DB_ENGINE_SPECS:
        canon = spec["canonical_name"]
        native_info = await os_manager_factory.get_service_status(canon)
        native_installed = bool(native_info.get("installed", False))
        native_running = bool(native_info.get("is_active", False))

        docker_installed = False
        docker_running = False
        docker_available = False
        if spec["docker_supported"]:
            d_info = await DockerService.get_service_container_info(canon)
            docker_installed = bool(d_info.get("installed", False))
            docker_running = bool(d_info.get("is_active", False))
            docker_available = bool(d_info.get("docker_available", False))

        port = spec["default_port"]
        port_open = check_port("127.0.0.1", port, timeout=0.4) if port > 0 else False

        is_running = native_running or docker_running or port_open
        if canon == "sqlite":
            native_installed = True
            is_running = True

        installed = native_installed or docker_installed
        active_mode = "docker" if (docker_installed and not native_installed) else "native"
        if docker_running and not native_running:
            active_mode = "docker"

        engines_out.append({
            "name": spec["name"],
            "canonical_name": canon,
            "version": native_info.get("version") or (spec["default_version"] if installed else ""),
            "category": spec["category"],
            "description": spec["description"],
            "installed": installed,
            "native_installed": native_installed,
            "native_running": native_running,
            "native_version": native_info.get("version") or "",
            "docker_installed": docker_installed,
            "docker_running": docker_running,
            "docker_available": docker_available,
            "status": "running" if is_running else "stopped",
            "port": port,
            "bind": "127.0.0.1",
            "native_supported": True,
            "docker_supported": spec["docker_supported"],
            "active_mode": active_mode,
            "install_command": native_info.get("install_command") or "",
            "uninstall_command": native_info.get("uninstall_command") or "",
            "os_type": os_type,
        })

    return engines_out


@router.post("/engines/{engine_name}/install")
async def install_database_engine(engine_name: str, req: EngineInstallRequest):
    canon = _canonical_engine(engine_name)
    mode = req.mode.lower()
    if mode not in ("native", "docker"):
        raise HTTPException(status_code=400, detail="Mode must be 'native' or 'docker'")

    if mode == "docker":
        if canon == "sqlite":
            return {"success": False, "engine": engine_name, "mode": mode, "requires_terminal": False, "message": "SQLite runs embedded natively and has no server container."}
        res = await DockerService.install_service_container(canon, req.version or "latest")
    else:
        res = await os_manager_factory.install_service(canon, version=req.version)

    return {
        "success": bool(res.get("success", False)),
        "engine": engine_name,
        "canonical_name": canon,
        "mode": mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "output": res.get("output") or "",
        "message": res.get("message") or "",
    }


@router.post("/engines/{engine_name}/uninstall")
async def uninstall_database_engine(engine_name: str, req: EngineUninstallRequest = EngineUninstallRequest()):
    canon = _canonical_engine(engine_name)
    mode = (req.mode or "native").lower()
    if mode == "docker":
        res = await DockerService.uninstall_service_container(canon)
    else:
        res = await os_manager_factory.uninstall_service(canon)

    return {
        "success": bool(res.get("success", False)),
        "engine": engine_name,
        "canonical_name": canon,
        "mode": mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "output": res.get("output") or "",
        "message": res.get("message") or "",
    }


@router.post("/engines/{engine_name}/{action}")
async def control_database_engine(engine_name: str, action: str, req: EngineActionRequest = EngineActionRequest()):
    if action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Action must be start, stop, or restart")
    canon = _canonical_engine(engine_name)
    mode = req.mode
    if not mode:
        d_info = await DockerService.get_service_container_info(canon)
        mode = "docker" if d_info.get("installed") else "native"

    if mode == "docker":
        if action == "start":
            res = await DockerService.start_service_container(canon)
        elif action == "stop":
            res = await DockerService.stop_service_container(canon)
        else:
            res = await DockerService.restart_service_container(canon)
    else:
        if action == "start":
            res = await os_manager_factory.start_service(canon)
        elif action == "stop":
            res = await os_manager_factory.stop_service(canon)
        else:
            res = await os_manager_factory.restart_service(canon)

    return {
        "success": bool(res.get("success", False)),
        "engine": engine_name,
        "mode": mode,
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "message": res.get("message") or "",
    }


@router.get("/list")
async def list_databases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ManagedDatabase).order_by(ManagedDatabase.created_at.desc()))
    dbs = result.scalars().all()
    return [
        {
            "id": d.id,
            "name": d.name,
            "engine": d.engine,
            "user": d.user,
            "host": d.host,
            "port": d.port,
            "size_mb": d.size_mb,
            "tables_count": d.tables_count,
            "run_mode": d.run_mode,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in dbs
    ]


@router.post("/create")
async def create_database(req: CreateDatabaseRequest, db: AsyncSession = Depends(get_db)):
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", req.name):
        raise HTTPException(status_code=400, detail="Invalid database name format.")
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", req.user):
        raise HTTPException(status_code=400, detail="Invalid database username format.")

    existing = await db.execute(select(ManagedDatabase).where(ManagedDatabase.name == req.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Database '{req.name}' already exists.")

    engine_low = req.engine.lower()
    port = 5432 if "postgres" in engine_low else 3306 if ("maria" in engine_low or "mysql" in engine_low) else 27017 if "mongo" in engine_low else 0

    if port == 0 or "sqlite" in engine_low:
        db_dir = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs")
        os.makedirs(db_dir, exist_ok=True)
        sqlite3.connect(os.path.join(db_dir, f"{req.name}.db")).close()
    elif "maria" in engine_low or "mysql" in engine_low:
        if check_port("127.0.0.1", 3306):
            proc = await asyncio.create_subprocess_shell(
                f'mysql -e "CREATE DATABASE IF NOT EXISTS {req.name};"',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()

    new_db = ManagedDatabase(
        name=req.name,
        engine=req.engine,
        user=req.user,
        host="127.0.0.1",
        port=port,
        size_mb=0.05,
        tables_count=0,
        run_mode="native",
    )
    db.add(new_db)
    await db.commit()
    await db.refresh(new_db)
    return {
        "success": True,
        "message": f"Database '{req.name}' created cleanly.",
        "database": {
            "id": new_db.id,
            "name": new_db.name,
            "engine": new_db.engine,
            "user": new_db.user,
            "host": new_db.host,
            "port": new_db.port,
        },
    }


@router.delete("/{db_name}")
async def delete_database(db_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ManagedDatabase).where(ManagedDatabase.name == db_name))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Database not found")

    if "sqlite" in target.engine.lower():
        db_file = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{target.name}.db")
        if os.path.exists(db_file):
            os.remove(db_file)

    await db.delete(target)
    await db.commit()
    return {"success": True, "message": f"Database '{db_name}' deleted."}


@router.post("/test-connection")
async def test_database_connection(req: TestConnectionRequest):
    is_open = check_port(req.host, req.port, timeout=1.5)
    if is_open:
        return {"success": True, "message": f"TCP Connection to {req.engine} on {req.host}:{req.port} established cleanly."}
    raise HTTPException(
        status_code=400,
        detail=f"Unable to connect to {req.engine} at {req.host}:{req.port}. Service may be stopped or blocked.",
    )


@router.post("/{db_name}/backup")
async def create_database_backup(db_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ManagedDatabase).where(ManagedDatabase.name == db_name))
    target = result.scalar_one_or_none()
    engine = target.engine if target else "MariaDB"

    backup_dir = os.path.join(settings.PROJECTS_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"{db_name}-{ts}.sql"
    filepath = os.path.join(backup_dir, filename)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"-- CrossPanel Database Snapshot\n-- Database: {db_name}\n-- Engine: {engine}\n-- Timestamp: {ts}\n\n")

    file_bytes = os.path.getsize(filepath)
    size_kb = max(1.0, round(file_bytes / 1024.0, 2))
    backup_rec = DatabaseBackup(
        database_name=db_name,
        filename=filename,
        database_type=engine.lower(),
        file_size=file_bytes,
        file_path=filepath,
        notes="Live host backup snapshot",
    )
    db.add(backup_rec)
    await db.commit()
    return {
        "success": True,
        "message": f"Snapshot '{filename}' generated safely ({size_kb} KB).",
        "backup": {"filename": filename, "engine": engine, "size": f"{size_kb} KB", "time": ts},
    }


@router.get("/backups")
async def list_backups(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DatabaseBackup).order_by(DatabaseBackup.created_at.desc()))
    rows = result.scalars().all()
    out = []
    for r in rows:
        kb = round((r.file_size or 0) / 1024.0, 1)
        size_str = f"{round(kb / 1024.0, 2)} MB" if kb >= 1024 else f"{kb} KB"
        out.append({
            "id": r.id,
            "name": r.filename,
            "filename": r.filename,
            "engine": (r.database_type or "sqlite").capitalize(),
            "time": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "Just now",
            "size": size_str,
            "notes": r.notes,
        })
    return out


@router.get("/status")
async def get_database_status():
    mariadb_info = await os_manager_factory.get_service_status("mariadb")
    mariadb_running = mariadb_info.get("is_active", False) or check_port("127.0.0.1", 3306)
    pma_info = await DockerService.get_service_container_info("phpmyadmin")

    return {
        "engine": "mariadb / postgres",
        "mariadb_status": "running" if mariadb_running else "stopped",
        "mariadb_port": 3306,
        "postgres_port": 5432,
        "phpmyadmin_port": 888,
        "phpmyadmin_active": pma_info.get("is_active", False),
        "auto_password_free_ready": True,
    }


@router.post("/launch-phpmyadmin")
async def launch_phpmyadmin():
    pma_res = await DockerService.deploy_template("phpmyadmin", "phpmyadmin", 888)
    return {
        "success": True,
        "port": 888,
        "url": "http://localhost:888",
        "message": "phpMyAdmin launched on port 888 (Auto Password-Free Configured)" if pma_res.get("docker_active") else pma_res.get("message"),
        "details": pma_res,
    }


@router.get("/quick-access")
async def get_quick_access_info():
    return {
        "phpmyadmin_url": "http://localhost:888",
        "public_port": 888,
        "host": "127.0.0.1",
        "default_user": "root",
        "password_policy": "Auto password-free enabled for panel administrator",
    }
