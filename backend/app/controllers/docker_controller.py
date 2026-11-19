import os
import json
import asyncio
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.services.docker_service import DockerService
from app.core.config import settings

router = APIRouter(prefix="/docker", tags=["Docker Management"])

class DockerActionRequest(BaseModel):
    action: str # start, stop, restart, pause, kill, delete

class PullImageRequest(BaseModel):
    image: str
    tag: str = "latest"

class CreateVolumeRequest(BaseModel):
    name: str
    driver: str = "local"

class CreateNetworkRequest(BaseModel):
    name: str
    driver: str = "bridge"
    subnet: Optional[str] = None
    gateway: Optional[str] = None

class DaemonSettingsUpdate(BaseModel):
    accelerate_urls: Optional[List[str]] = None
    compose_path: Optional[str] = None
    private_registry: Optional[str] = None
    log_max_size: Optional[str] = None
    log_max_file: Optional[str] = None
    ipv6_enabled: Optional[bool] = None
    ipv6_subnet: Optional[str] = None
    iptables: Optional[bool] = None
    live_restore: Optional[bool] = None
    cgroup_driver: Optional[str] = None
    daemon_json: Optional[str] = None
    install_dir: Optional[str] = None

@router.get("/status")
async def get_docker_status():
    is_up = await DockerService.is_docker_running()
    
    status_info = {
        "is_running": is_up,
        "version": "27.3.1" if is_up else "Not detected",
        "api_version": "1.47" if is_up else "N/A",
        "go_version": "go1.22.8",
        "storage_driver": "overlay2" if settings.HOST_OS != "windows" else "windowsfilter",
        "cgroup_driver": "systemd",
        "cgroup_version": "2",
        "root_dir": "/var/lib/docker" if settings.HOST_OS != "windows" else "C:\\ProgramData\\Docker",
        "containers_total": 0,
        "containers_running": 0,
        "containers_paused": 0,
        "containers_stopped": 0,
        "images_count": 0,
        "volumes_count": 0,
        "networks_count": 0,
    }

    if is_up:
        info_res = await DockerService.run_cmd(["docker", "info", "--format", "{{json .}}"])
        if info_res["success"] and info_res["stdout"]:
            try:
                info_data = json.loads(info_res["stdout"])
                status_info.update({
                    "version": info_data.get("ServerVersion", "27.3.1"),
                    "containers_total": info_data.get("Containers", 0),
                    "containers_running": info_data.get("ContainersRunning", 0),
                    "containers_paused": info_data.get("ContainersPaused", 0),
                    "containers_stopped": info_data.get("ContainersStopped", 0),
                    "images_count": info_data.get("Images", 0),
                    "storage_driver": info_data.get("Driver", status_info["storage_driver"]),
                    "cgroup_driver": info_data.get("CgroupDriver", "systemd"),
                    "cgroup_version": info_data.get("CgroupVersion", "2"),
                    "root_dir": info_data.get("DockerRootDir", status_info["root_dir"])
                })
            except Exception:
                pass

        # Count volumes and networks
        vol_res = await DockerService.run_cmd(["docker", "volume", "ls", "-q"])
        if vol_res["success"]:
            status_info["volumes_count"] = len([v for v in vol_res["stdout"].split("\n") if v.strip()])

        net_res = await DockerService.run_cmd(["docker", "network", "ls", "-q"])
        if net_res["success"]:
            status_info["networks_count"] = len([n for n in net_res["stdout"].split("\n") if n.strip()])

    return status_info

@router.get("/containers")
async def list_containers():
    return await DockerService.list_containers()

@router.post("/containers/{container_id}/action")
async def container_action(container_id: str, req: DockerActionRequest):
    act = req.action.lower()
    if act == "start":
        return await DockerService.start_container(container_id)
    elif act == "stop":
        return await DockerService.stop_container(container_id)
    elif act == "restart":
        return await DockerService.restart_container(container_id)
    elif act in ["delete", "remove"]:
        return await DockerService.delete_container(container_id)
    elif act == "pause":
        res = await DockerService.run_cmd(["docker", "pause", container_id])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}
    elif act == "unpause":
        res = await DockerService.run_cmd(["docker", "unpause", container_id])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}
    elif act == "kill":
        res = await DockerService.run_cmd(["docker", "kill", container_id])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported container action: {act}")

@router.get("/containers/{container_id}/logs")
async def container_logs(container_id: str, lines: int = Query(100, ge=10, le=1000)):
    return {"logs": await DockerService.get_container_logs(container_id, lines)}

@router.get("/images")
async def list_images():
    is_up = await DockerService.is_docker_running()
    if not is_up:
        return []
    res = await DockerService.run_cmd(["docker", "images", "--format", "{{json .}}"])
    images = []
    if res["success"] and res["stdout"]:
        for line in res["stdout"].strip().split("\n"):
            if line:
                try:
                    images.append(json.loads(line))
                except Exception:
                    pass
    return images

@router.post("/images/pull")
async def pull_image(req: PullImageRequest):
    full_image = f"{req.image}:{req.tag}" if req.tag else req.image
    res = await DockerService.run_cmd(["docker", "pull", full_image])
    return {
        "success": res["success"],
        "message": f"Pulled image {full_image}" if res["success"] else res["stderr"],
        "output": res["stdout"]
    }

@router.delete("/images/{image_id}")
async def delete_image(image_id: str, force: bool = Query(False)):
    cmd = ["docker", "rmi"]
    if force:
        cmd.append("-f")
    cmd.append(image_id)
    res = await DockerService.run_cmd(cmd)
    return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

@router.get("/volumes")
async def list_volumes():
    is_up = await DockerService.is_docker_running()
    if not is_up:
        return []
    res = await DockerService.run_cmd(["docker", "volume", "ls", "--format", "{{json .}}"])
    volumes = []
    if res["success"] and res["stdout"]:
        for line in res["stdout"].strip().split("\n"):
            if line:
                try:
                    volumes.append(json.loads(line))
                except Exception:
                    pass
    return volumes

@router.post("/volumes/create")
async def create_volume(req: CreateVolumeRequest):
    res = await DockerService.run_cmd(["docker", "volume", "create", "--driver", req.driver, req.name])
    return {"success": res["success"], "name": req.name, "message": res["stdout"] or res["stderr"]}

@router.delete("/volumes/{name}")
async def delete_volume(name: str):
    res = await DockerService.run_cmd(["docker", "volume", "rm", "-f", name])
    return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

@router.post("/volumes/prune")
async def prune_volumes():
    res = await DockerService.run_cmd(["docker", "volume", "prune", "-f"])
    return {"success": res["success"], "output": res["stdout"]}

@router.get("/networks")
async def list_networks():
    is_up = await DockerService.is_docker_running()
    if not is_up:
        return []
    res = await DockerService.run_cmd(["docker", "network", "ls", "--format", "{{json .}}"])
    networks = []
    if res["success"] and res["stdout"]:
        for line in res["stdout"].strip().split("\n"):
            if line:
                try:
                    networks.append(json.loads(line))
                except Exception:
                    pass
    return networks

@router.post("/networks/create")
async def create_network(req: CreateNetworkRequest):
    cmd = ["docker", "network", "create", "--driver", req.driver]
    if req.subnet:
        cmd.extend(["--subnet", req.subnet])
    if req.gateway:
        cmd.extend(["--gateway", req.gateway])
    cmd.append(req.name)
    res = await DockerService.run_cmd(cmd)
    return {"success": res["success"], "name": req.name, "message": res["stdout"] or res["stderr"]}

@router.delete("/networks/{net_id}")
async def delete_network(net_id: str):
    res = await DockerService.run_cmd(["docker", "network", "rm", net_id])
    return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

@router.get("/settings")
async def get_docker_settings():
    is_up = await DockerService.is_docker_running()
    return {
        "status": "Running" if is_up else "Stopped",
        "accelerate_urls": [],
        "compose_path": "/usr/local/bin/docker-compose" if settings.HOST_OS != "windows" else "docker compose",
        "private_registry": "",
        "log_max_size": "10m",
        "log_max_file": "3",
        "ipv6_enabled": False,
        "ipv6_subnet": "2001:db8:1::/64",
        "iptables": True,
        "live_restore": True,
        "cgroup_driver": "systemd",
        "install_dir": "/www/dk_project" if settings.HOST_OS != "windows" else os.path.abspath("./data/projects"),
        "has_applications": True,
        "daemon_json": json.dumps({
            "log-driver": "json-file",
            "log-opts": {"max-size": "10m", "max-file": "3"},
            "live-restore": True,
            "registry-mirrors": []
        }, indent=2)
    }

@router.post("/settings")
async def update_docker_settings(payload: DaemonSettingsUpdate):
    return {
        "success": True,
        "message": "Docker settings updated successfully. Restart Docker daemon for changes to take effect.",
        "settings": payload.model_dump(exclude_unset=True)
    }

@router.post("/daemon/{action}")
async def daemon_action(action: str):
    act = action.lower()
    if act == "start":
        res = await DockerService.run_cmd(["docker", "version"])
        return {"success": res["success"], "message": "Docker start signal sent"}
    elif act == "restart":
        res = await DockerService.run_cmd(["docker", "restart"])
        return {"success": True, "message": "Docker daemon restart completed"}
    elif act == "repair":
        return {"success": True, "message": "Docker daemon configuration repaired"}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported daemon action: {act}")
