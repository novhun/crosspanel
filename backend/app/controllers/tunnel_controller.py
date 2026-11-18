from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.settings import TunnelConfig
from app.schemas.deploy_schemas import TunnelCreateRequest
from app.services.tunnel_service import TunnelService

router = APIRouter(prefix="/tunnel", tags=["Network Tunnels"])

@router.get("/list")
async def list_tunnels(db: AsyncSession = Depends(get_db)):
    active_memory = TunnelService.list_tunnels()
    res = await db.execute(select(TunnelConfig).order_by(TunnelConfig.created_at.desc()))
    db_tunnels = res.scalars().all()
    
    # Merge active runtime info
    result = []
    seen = set()
    for t in active_memory:
        seen.add(t["name"])
        result.append(t)
        
    for d in db_tunnels:
        if d.name not in seen:
            result.append({
                "id": str(d.id),
                "name": d.name,
                "tunnel_type": d.tunnel_type,
                "local_port": d.local_port,
                "remote_url": d.remote_url,
                "status": d.status,
                "created_at": d.created_at.isoformat() if d.created_at else None
            })
    return result

@router.post("/create")
async def create_tunnel(req: TunnelCreateRequest, db: AsyncSession = Depends(get_db)):
    tunnel_res = await TunnelService.create_tunnel(
        name=req.name,
        tunnel_type=req.tunnel_type,
        local_port=req.local_port,
        auth_token=req.auth_token or ""
    )

    db_item = TunnelConfig(
        name=req.name,
        tunnel_type=req.tunnel_type,
        local_port=req.local_port,
        remote_url=tunnel_res["remote_url"],
        status="active",
        pid=tunnel_res.get("pid")
    )
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)

    return {
        "success": True,
        "tunnel": tunnel_res,
        "db_id": db_item.id
    }

@router.delete("/{tunnel_id}")
async def stop_tunnel(tunnel_id: str, db: AsyncSession = Depends(get_db)):
    await TunnelService.stop_tunnel(tunnel_id)
    # Check if integer DB id
    try:
        db_id = int(tunnel_id)
        res = await db.execute(select(TunnelConfig).where(TunnelConfig.id == db_id))
        rec = res.scalar_one_or_none()
        if rec:
            rec.status = "inactive"
            await db.commit()
    except ValueError:
        pass

    return {"success": True, "message": f"Tunnel {tunnel_id} stopped."}
