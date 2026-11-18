from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.settings import JenkinsConfig, AnsiblePlaybook
from app.schemas.deploy_schemas import JenkinsJobCreate, AnsiblePlaybookCreate
from app.services.jenkins_service import JenkinsService
from app.services.ansible_service import AnsibleService

router = APIRouter(prefix="/automation", tags=["DevOps Automation (Jenkins & Ansible)"])

# Default seeded playbooks & jobs
DEFAULT_PLAYBOOK = """---
- name: CrossPanel Multi-Server Provisioning
  hosts: all
  become: yes
  tasks:
    - name: Ensure latest security patches
      package:
        name: "*"
        state: latest

    - name: Install Essential DevOps Tools
      package:
        name:
          - curl
          - git
          - htop
          - ufw
        state: present

    - name: Configure Nginx & Firewall Ports
      service:
        name: nginx
        state: started
        enabled: yes
"""

@router.get("/jenkins/jobs")
async def list_jenkins_jobs(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(JenkinsConfig).order_by(JenkinsConfig.id.desc()))
    jobs = res.scalars().all()
    if not jobs:
        # Seed an example job
        demo = JenkinsConfig(
            name="Deploy-Production-Pipeline",
            url="http://jenkins.local:8080",
            job_name="production-build-and-test",
            last_status="SUCCESS",
            last_duration="1m 32s",
            last_run=datetime.utcnow()
        )
        db.add(demo)
        await db.commit()
        await db.refresh(demo)
        jobs = [demo]
    return jobs

@router.post("/jenkins/create")
async def create_jenkins_job(req: JenkinsJobCreate, db: AsyncSession = Depends(get_db)):
    job = JenkinsConfig(
        name=req.name,
        url=req.url,
        job_name=req.job_name,
        username=req.username,
        token=req.token,
        last_status="IDLE"
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"success": True, "job": job}

@router.post("/jenkins/{job_id}/build")
async def trigger_jenkins_build(job_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(JenkinsConfig).where(JenkinsConfig.id == job_id))
    job = res.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Jenkins Job not found")

    result = await JenkinsService.trigger_build(
        jenkins_url=job.url,
        job_name=job.job_name,
        username=job.username,
        token=job.token
    )
    job.last_status = result.get("status", "SUCCESS")
    job.last_run = datetime.utcnow()
    job.last_duration = "45s"
    await db.commit()
    return {"success": True, "result": result, "job": job}

@router.get("/ansible/playbooks")
async def list_ansible_playbooks(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AnsiblePlaybook).order_by(AnsiblePlaybook.id.desc()))
    playbooks = res.scalars().all()
    if not playbooks:
        # Seed a default playbook
        demo = AnsiblePlaybook(
            name="Server-Hardening-Nginx",
            description="Initializes baseline server security, updates packages and starts Nginx.",
            content=DEFAULT_PLAYBOOK,
            inventory="web-server-1 ansible_host=192.168.1.100\nweb-server-2 ansible_host=192.168.1.101",
            last_status="READY"
        )
        db.add(demo)
        await db.commit()
        await db.refresh(demo)
        playbooks = [demo]
    return playbooks

@router.post("/ansible/create")
async def create_ansible_playbook(req: AnsiblePlaybookCreate, db: AsyncSession = Depends(get_db)):
    val = AnsibleService.validate_playbook_syntax(req.content)
    if not val["valid"]:
        raise HTTPException(status_code=400, detail=f"Syntax Error in YAML: {val.get('error')}")

    pb = AnsiblePlaybook(
        name=req.name,
        description=req.description,
        content=req.content,
        inventory=req.inventory or "localhost ansible_connection=local",
        last_status="READY"
    )
    db.add(pb)
    await db.commit()
    await db.refresh(pb)
    return {"success": True, "playbook": pb}

@router.post("/ansible/{playbook_id}/run")
async def run_ansible_playbook(playbook_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(AnsiblePlaybook).where(AnsiblePlaybook.id == playbook_id))
    pb = res.scalar_one_or_none()
    if not pb:
        raise HTTPException(status_code=404, detail="Ansible Playbook not found")

    result = await AnsibleService.run_playbook(
        playbook_name=pb.name,
        content=pb.content,
        inventory=pb.inventory
    )

    pb.last_status = result["status"]
    pb.last_output = result["output"]
    pb.last_run = datetime.utcnow()
    await db.commit()

    return {"success": result["success"], "output": result["output"], "playbook": pb}
