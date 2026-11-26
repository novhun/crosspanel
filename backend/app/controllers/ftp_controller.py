import os
import posixpath
from typing import Dict, Any, List
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.models.settings import FtpAccount, FtpConnection
from app.schemas.ftp_schemas import (
    FtpAccountCreate,
    FtpAccountUpdate,
    FtpChmodRequest,
    FtpConnectionCreate,
    FtpDeleteRequest,
    FtpPathRequest,
    FtpRenameRequest,
    FtpServerStartRequest,
    FtpSyncLocalRequest,
    FtpTargetConfig,
    FtpWriteRequest,
)
from app.services.ftp_service import FtpClientService, FtpPackageService, FtpServerManager

router = APIRouter(prefix="/ftp", tags=["FTP / SFTP Manager"])


async def _resolve_target_config(cfg: FtpTargetConfig, db: AsyncSession) -> Dict[str, Any]:
    if cfg.connection_id is not None:
        res = await db.execute(select(FtpConnection).where(FtpConnection.id == cfg.connection_id))
        row = res.scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Saved FTP connection not found.")
        return {
            "protocol": row.protocol,
            "host": row.host,
            "port": row.port,
            "username": row.username,
            "password": row.password or "",
            "passive": row.passive,
            "remote_path": row.remote_path or "/",
        }
    return cfg.model_dump()


async def _load_all_accounts(db: AsyncSession) -> List[Dict[str, Any]]:
    res = await db.execute(select(FtpAccount).order_by(FtpAccount.id.asc()))
    return [
        {
            "id": a.id,
            "username": a.username,
            "password": a.password,
            "home_dir": a.home_dir,
            "permissions": a.permissions,
            "enabled": a.enabled,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in res.scalars().all()
    ]


# ==============================================================================
# Saved FTP/SFTP Connection Profiles
# ==============================================================================

@router.get("/connections")
async def list_connections(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(FtpConnection).order_by(FtpConnection.id.desc()))
    rows = res.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "protocol": r.protocol,
            "host": r.host,
            "port": r.port,
            "username": r.username,
            "has_password": bool(r.password),
            "remote_path": r.remote_path or "/",
            "passive": r.passive,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post("/connections")
async def create_connection(req: FtpConnectionCreate, db: AsyncSession = Depends(get_db)):
    row = FtpConnection(
        name=req.name.strip(),
        protocol=req.protocol.lower(),
        host=req.host.strip(),
        port=req.port,
        username=req.username.strip(),
        password=req.password,
        remote_path=req.remote_path or "/",
        passive=req.passive,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": row.id,
        "name": row.name,
        "protocol": row.protocol,
        "host": row.host,
        "port": row.port,
        "username": row.username,
        "has_password": bool(row.password),
        "remote_path": row.remote_path,
        "passive": row.passive,
    }


@router.delete("/connections/{conn_id}")
async def delete_connection(conn_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(FtpConnection).where(FtpConnection.id == conn_id))
    row = res.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Connection not found.")
    await db.delete(row)
    await db.commit()
    return {"success": True, "message": "Connection deleted."}


# ==============================================================================
# Remote FTP / FTPS / SFTP Client Operations
# ==============================================================================

@router.post("/client/test")
async def test_client_connection(req: FtpTargetConfig, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.test_connection(cfg)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/list")
async def list_remote_directory(req: FtpPathRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        target = req.path or cfg.get("remote_path") or "/"
        return FtpClientService.list_dir(cfg, target)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/read")
async def read_remote_file(req: FtpPathRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        content = FtpClientService.read_file(cfg, req.path)
        return {"path": req.path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/write")
async def write_remote_file(req: FtpWriteRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.write_file(cfg, req.path, req.content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/mkdir")
async def mkdir_remote(req: FtpPathRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.mkdir(cfg, req.path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/rename")
async def rename_remote(req: FtpRenameRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.rename(cfg, req.old_path, req.new_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/delete")
async def delete_remote(req: FtpDeleteRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.delete(cfg, req.path, is_dir=req.is_dir)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/chmod")
async def chmod_remote(req: FtpChmodRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.chmod(cfg, req.path, req.mode)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/upload")
async def upload_remote(
    remote_dir: str = Form("/"),
    connection_id: str = Form(""),
    protocol: str = Form("ftp"),
    host: str = Form("127.0.0.1"),
    port: int = Form(21),
    username: str = Form("anonymous"),
    password: str = Form(""),
    passive: bool = Form(True),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    conn_int = int(connection_id) if connection_id.strip().isdigit() else None
    cfg = await _resolve_target_config(
        FtpTargetConfig(
            connection_id=conn_int,
            protocol=protocol,
            host=host,
            port=port,
            username=username,
            password=password,
            passive=passive,
        ),
        db,
    )
    try:
        uploaded: List[str] = []
        for upload in files:
            data = await upload.read()
            name = upload.filename or "upload.bin"
            FtpClientService.upload_bytes(cfg, remote_dir, name, data)
            uploaded.append(name)
        return {"success": True, "files": uploaded, "message": f"Uploaded {len(uploaded)} file(s) to {remote_dir}"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/download")
async def download_remote(req: FtpPathRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        data = FtpClientService.download_bytes(cfg, req.path)
        filename = posixpath.basename(req.path) or "download.bin"
        return StreamingResponse(
            iter([data]),
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/client/sync-local")
async def sync_local(req: FtpSyncLocalRequest, db: AsyncSession = Depends(get_db)):
    cfg = await _resolve_target_config(req, db)
    try:
        return FtpClientService.sync_local(cfg, req.direction, req.local_path, req.remote_target)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==============================================================================
# Built-in Local FTP Server & Account Management
# ==============================================================================

@router.get("/server/status")
async def server_status():
    return FtpServerManager.status()


@router.post("/server/start")
async def server_start(req: FtpServerStartRequest, db: AsyncSession = Depends(get_db)):
    accounts = await _load_all_accounts(db)
    if not any(a["enabled"] for a in accounts):
        raise HTTPException(status_code=400, detail="Create and enable at least one FTP user account first.")
    try:
        return FtpServerManager.start(req.host, req.port, accounts)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/server/stop")
async def server_stop():
    return FtpServerManager.stop()


@router.get("/accounts")
async def list_accounts(db: AsyncSession = Depends(get_db)):
    accounts = await _load_all_accounts(db)
    return [
        {
            "id": a["id"],
            "username": a["username"],
            "home_dir": a["home_dir"],
            "permissions": a["permissions"],
            "enabled": a["enabled"],
            "created_at": a["created_at"],
        }
        for a in accounts
    ]


@router.post("/accounts")
async def create_account(req: FtpAccountCreate, db: AsyncSession = Depends(get_db)):
    username = req.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required.")
    existing = await db.execute(select(FtpAccount).where(FtpAccount.username == username))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"FTP user '{username}' already exists.")

    home_dir = os.path.abspath(os.path.expanduser(req.home_dir.strip() or "~"))
    os.makedirs(home_dir, exist_ok=True)

    acc = FtpAccount(
        username=username,
        password=req.password,
        home_dir=home_dir.replace("\\", "/"),
        permissions=req.permissions or "elradfmwMT",
        enabled=req.enabled,
    )
    db.add(acc)
    await db.commit()
    await db.refresh(acc)

    FtpServerManager.reload_accounts(await _load_all_accounts(db))
    return {
        "id": acc.id,
        "username": acc.username,
        "home_dir": acc.home_dir,
        "permissions": acc.permissions,
        "enabled": acc.enabled,
        "created_at": acc.created_at.isoformat() if acc.created_at else None,
    }


@router.put("/accounts/{account_id}")
async def update_account(account_id: int, req: FtpAccountUpdate, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(FtpAccount).where(FtpAccount.id == account_id))
    acc = res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="FTP account not found.")

    if req.password is not None and req.password != "":
        acc.password = req.password
    if req.home_dir is not None:
        home_dir = os.path.abspath(os.path.expanduser(req.home_dir.strip() or "~"))
        os.makedirs(home_dir, exist_ok=True)
        acc.home_dir = home_dir.replace("\\", "/")
    if req.permissions is not None:
        acc.permissions = req.permissions
    if req.enabled is not None:
        acc.enabled = req.enabled

    await db.commit()
    await db.refresh(acc)
    FtpServerManager.reload_accounts(await _load_all_accounts(db))
    return {
        "id": acc.id,
        "username": acc.username,
        "home_dir": acc.home_dir,
        "permissions": acc.permissions,
        "enabled": acc.enabled,
        "created_at": acc.created_at.isoformat() if acc.created_at else None,
    }


@router.delete("/accounts/{account_id}")
async def delete_account(account_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(FtpAccount).where(FtpAccount.id == account_id))
    acc = res.scalar_one_or_none()
    if not acc:
        raise HTTPException(status_code=404, detail="FTP account not found.")
    await db.delete(acc)
    await db.commit()
    FtpServerManager.reload_accounts(await _load_all_accounts(db))
    return {"success": True, "message": "FTP account deleted."}


# ==============================================================================
# Native OS FTP / SFTP Server Package Install / Uninstall / Control
# ==============================================================================

@router.get("/packages")
async def list_ftp_packages():
    return await FtpPackageService.list_packages()


@router.post("/packages/{package_name}/{action}")
async def manage_ftp_package(package_name: str, action: str):
    if action not in ("install", "uninstall", "start", "stop", "restart"):
        raise HTTPException(status_code=400, detail=f"Invalid action: {action}")
    try:
        return await FtpPackageService.manage_package(package_name, action)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
