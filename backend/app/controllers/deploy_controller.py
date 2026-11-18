import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.settings import DeployedApp
from app.schemas.deploy_schemas import DeployOneClickRequest, DeployCustomComposeRequest, GitDeployRequest, AppResponse
from app.services.docker_service import DockerService
from app.services.git_service import GitService

router = APIRouter(prefix="/deploy", tags=["App Deployments"])

@router.get("/templates")
async def get_templates():
    return DockerService.TEMPLATES

@router.get("/apps")
async def list_deployed_apps(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).order_by(DeployedApp.created_at.desc()))
    apps = res.scalars().all()
    return apps

@router.post("/one-click")
async def deploy_one_click(req: DeployOneClickRequest, db: AsyncSession = Depends(get_db)):
    docker_res = await DockerService.deploy_template(
        app_name=req.name,
        template_key=req.template_name,
        port=req.port,
        env_vars=req.env_vars
    )

    app_record = DeployedApp(
        name=req.name,
        template_name=req.template_name,
        status="running" if docker_res.get("success") else "failed",
        port=req.port,
        container_id=f"{req.name.lower()}_app",
        env_vars=json.dumps(req.env_vars or {}),
        source_url=req.source_url,
        compose_content=docker_res.get("compose_yaml")
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return {
        "success": docker_res.get("success", False),
        "app": app_record,
        "message": docker_res.get("message")
    }

@router.post("/custom-compose")
async def deploy_custom_compose(req: DeployCustomComposeRequest, db: AsyncSession = Depends(get_db)):
    docker_res = await DockerService.deploy_custom_compose(
        app_name=req.name,
        compose_yaml=req.compose_yaml
    )

    app_record = DeployedApp(
        name=req.name,
        template_name="custom",
        status="running" if docker_res.get("success") else "failed",
        container_id=f"{req.name.lower()}_custom",
        env_vars=json.dumps(req.env_vars or {}),
        compose_content=req.compose_yaml
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return {
        "success": docker_res.get("success", False),
        "app": app_record,
        "message": docker_res.get("message")
    }

@router.post("/git")
async def deploy_git(req: GitDeployRequest, db: AsyncSession = Depends(get_db)):
    # 1. Clone or pull repo
    git_res = await GitService.clone_or_pull(
        project_name=req.name,
        repo_url=req.repo_url,
        branch=req.branch
    )

    project_dir = git_res.get("project_dir")

    # 2. Write environment variables (.env.production / .env.local)
    if project_dir and req.env_vars:
        await GitService.write_env_file(project_dir, req.env_vars, req.env_type)

    # 3. Execute build script
    build_res = {"success": True, "logs": "Git code pulled successfully."}
    if project_dir and req.build_command:
        build_res = await GitService.execute_build(project_dir, req.build_command)

    # 4. Save to DB
    app_record = DeployedApp(
        name=req.name,
        template_name="git",
        status="running" if (git_res.get("success") and build_res.get("success")) else "failed",
        port=req.port,
        source_url=req.repo_url,
        git_branch=req.branch,
        env_vars=json.dumps(req.env_vars or {})
    )
    db.add(app_record)
    await db.commit()
    await db.refresh(app_record)

    return {
        "success": git_res.get("success") and build_res.get("success"),
        "app": app_record,
        "last_commit": git_res.get("last_commit"),
        "build_logs": build_res.get("logs")
    }

@router.post("/apps/{app_id}/restart")
async def restart_app(app_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app_rec = res.scalar_one_or_none()
    if not app_rec:
        raise HTTPException(status_code=404, detail="App not found")
    
    docker_res = await DockerService.restart_container(app_rec.container_id or app_rec.name)
    app_rec.status = "running"
    await db.commit()
    return {"success": True, "app": app_rec, "docker_res": docker_res}

@router.post("/apps/{app_id}/stop")
async def stop_app(app_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app_rec = res.scalar_one_or_none()
    if not app_rec:
        raise HTTPException(status_code=404, detail="App not found")

    docker_res = await DockerService.stop_container(app_rec.container_id or app_rec.name)
    app_rec.status = "stopped"
    await db.commit()
    return {"success": True, "app": app_rec, "docker_res": docker_res}

@router.delete("/apps/{app_id}")
async def delete_app(app_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app_rec = res.scalar_one_or_none()
    if not app_rec:
        raise HTTPException(status_code=404, detail="App not found")

    await DockerService.delete_container(app_rec.container_id or app_rec.name)
    await db.delete(app_rec)
    await db.commit()
    return {"success": True, "message": f"App {app_rec.name} deleted."}

@router.get("/apps/{app_id}/logs")
async def get_app_logs(app_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app_rec = res.scalar_one_or_none()
    if not app_rec:
        raise HTTPException(status_code=404, detail="App not found")

    logs = await DockerService.get_container_logs(app_rec.container_id or app_rec.name)
    return {"name": app_rec.name, "logs": logs}
