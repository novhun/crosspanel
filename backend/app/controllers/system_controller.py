from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.settings import FirewallRule, SystemSetting
from app.schemas.server_stats import SystemStatus, FirewallRuleCreate, FirewallRuleResponse, TargetOSUpdate
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
