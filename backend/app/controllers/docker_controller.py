import os
import json
import asyncio
import platform
import subprocess
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query, Body
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.services.docker_service import DockerService
from app.core.config import settings

router = APIRouter(prefix="/docker", tags=["Docker Management"])

class DockerActionRequest(BaseModel):
    action: str  # start, stop, restart, pause, unpause, kill, delete

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

class TemplateDeployRequest(BaseModel):
    name: str
    template: str
    port: int = 8080
    env: Optional[Dict[str, str]] = None

class ComposeDeployRequest(BaseModel):
    name: str
    compose_yaml: str

class ComposeActionRequest(BaseModel):
    action: str  # start, stop, restart, down, pull

class RegistryLoginRequest(BaseModel):
    server: str = "https://index.docker.io/v1/"
    username: str
    password: str

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


def get_daemon_json_path() -> Path:
    """Locate the daemon.json path on the current host PC."""
    if platform.system().lower() == "windows":
        user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
        user_daemon = Path(user_profile) / ".docker" / "daemon.json"
        if user_daemon.exists():
            return user_daemon
        prog_data = Path("C:/ProgramData/Docker/config/daemon.json")
        if prog_data.exists():
            return prog_data
        return user_daemon
    else:
        sys_daemon = Path("/etc/docker/daemon.json")
        if sys_daemon.exists():
            return sys_daemon
        home_daemon = Path(os.path.expanduser("~")) / ".docker" / "daemon.json"
        return home_daemon


def get_docker_config_path() -> Path:
    """Locate the Docker client config.json file."""
    user_home = os.environ.get("USERPROFILE", os.path.expanduser("~"))
    return Path(user_home) / ".docker" / "config.json"


@router.get("/status")
async def get_docker_status():
    is_up = await DockerService.is_docker_running()

    status_info = {
        "is_running": is_up,
        "version": "Not detected",
        "api_version": "N/A",
        "go_version": "N/A",
        "storage_driver": "overlayfs" if platform.system().lower() != "windows" else "windowsfilter",
        "cgroup_driver": "cgroupfs",
        "cgroup_version": "2",
        "root_dir": "/var/lib/docker",
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
                    "version": info_data.get("ServerVersion", "28.3.2"),
                    "api_version": info_data.get("Server", {}).get("Engine", {}).get("APIVersion", "1.51") if isinstance(info_data.get("Server"), dict) else "1.51",
                    "go_version": info_data.get("GoVersion", "go1.24.5"),
                    "containers_total": info_data.get("Containers", 0),
                    "containers_running": info_data.get("ContainersRunning", 0),
                    "containers_paused": info_data.get("ContainersPaused", 0),
                    "containers_stopped": info_data.get("ContainersStopped", 0),
                    "images_count": info_data.get("Images", 0),
                    "storage_driver": info_data.get("Driver", "overlayfs"),
                    "cgroup_driver": info_data.get("CgroupDriver", "cgroupfs"),
                    "cgroup_version": info_data.get("CgroupVersion", "2"),
                    "root_dir": info_data.get("DockerRootDir", "/var/lib/docker")
                })
            except Exception:
                pass

        # Count volumes
        vol_res = await DockerService.run_cmd(["docker", "volume", "ls", "-q"])
        if vol_res["success"] and vol_res["stdout"]:
            status_info["volumes_count"] = len([v for v in vol_res["stdout"].split("\n") if v.strip()])

        # Count networks
        net_res = await DockerService.run_cmd(["docker", "network", "ls", "-q"])
        if net_res["success"] and net_res["stdout"]:
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
    full_image = f"{req.image}:{req.tag}" if req.tag and ":" not in req.image else req.image
    res = await DockerService.run_cmd(["docker", "pull", full_image])
    return {
        "success": res["success"],
        "message": f"Pulled image {full_image}" if res["success"] else (res["stderr"] or res["stdout"]),
        "output": res["stdout"] or res["stderr"]
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


# ==========================================
# DOCKER COMPOSE STACKS
# ==========================================

@router.get("/compose")
async def list_compose_stacks():
    """List all active Docker Compose stacks on the host PC + projects in directory."""
    stacks = []
    seen_names = set()

    is_up = await DockerService.is_docker_running()
    if is_up:
        res = await DockerService.run_cmd(["docker", "compose", "ls", "--format", "json"])
        if res["success"] and res["stdout"]:
            try:
                raw_stacks = json.loads(res["stdout"])
                if isinstance(raw_stacks, list):
                    for st in raw_stacks:
                        name = st.get("Name", "")
                        seen_names.add(name)
                        stacks.append({
                            "name": name,
                            "status": st.get("Status", "Running"),
                            "config_files": st.get("ConfigFiles", ""),
                            "dir": str(Path(st.get("ConfigFiles", "")).parent) if st.get("ConfigFiles") else "",
                            "services": len(st.get("Status", "").split(",")) if "," in st.get("Status", "") else 1
                        })
            except Exception:
                pass

    # Check projects directory
    projects_dir = Path(settings.PROJECTS_DIR)
    if projects_dir.exists():
        for item in projects_dir.iterdir():
            if item.is_dir():
                compose_file = item / "docker-compose.yml"
                if not compose_file.exists():
                    compose_file = item / "compose.yml"
                if compose_file.exists() and item.name not in seen_names:
                    stacks.append({
                        "name": item.name,
                        "status": "Stopped",
                        "config_files": str(compose_file),
                        "dir": str(item),
                        "services": 1
                    })

    return stacks


@router.post("/compose/deploy")
async def deploy_compose_stack(req: ComposeDeployRequest):
    return await DockerService.deploy_custom_compose(req.name, req.compose_yaml)


@router.post("/compose/{project_name}/action")
async def compose_action(project_name: str, req: ComposeActionRequest):
    act = req.action.lower()
    app_dir = Path(settings.PROJECTS_DIR) / project_name
    cwd = str(app_dir) if app_dir.exists() else None

    if act == "start":
        cmd = ["docker", "compose", "-p", project_name, "start"]
    elif act == "stop":
        cmd = ["docker", "compose", "-p", project_name, "stop"]
    elif act == "restart":
        cmd = ["docker", "compose", "-p", project_name, "restart"]
    elif act == "down":
        cmd = ["docker", "compose", "-p", project_name, "down"]
    elif act == "pull":
        cmd = ["docker", "compose", "-p", project_name, "pull"]
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported compose action: {act}")

    res = await DockerService.run_cmd(cmd, cwd=cwd)
    return {"success": res["success"], "message": res["stdout"] or res["stderr"]}


@router.get("/compose/{project_name}/config")
async def get_compose_config(project_name: str):
    app_dir = Path(settings.PROJECTS_DIR) / project_name
    compose_file = app_dir / "docker-compose.yml"
    if not compose_file.exists():
        compose_file = app_dir / "compose.yml"

    if compose_file.exists():
        with open(compose_file, "r", encoding="utf-8") as f:
            content = f.read()
        return {"name": project_name, "compose_yaml": content, "path": str(compose_file)}
    
    # Try finding via docker compose config
    res = await DockerService.run_cmd(["docker", "compose", "-p", project_name, "config"])
    if res["success"]:
        return {"name": project_name, "compose_yaml": res["stdout"], "path": "generated from running stack"}

    return {"name": project_name, "compose_yaml": "", "path": ""}


# ==========================================
# 1-CLICK TEMPLATES
# ==========================================

@router.post("/templates/deploy")
async def deploy_template(req: TemplateDeployRequest):
    return await DockerService.deploy_template(
        app_name=req.name,
        template_key=req.template,
        port=req.port,
        env_vars=req.env
    )


# ==========================================
# REGISTRIES / REPOSITORIES
# ==========================================

@router.get("/repositories")
async def list_repositories():
    """List configured container registries from ~/.docker/config.json."""
    config_file = get_docker_config_path()
    repos = [
        {
            "name": "Docker Hub (Default)",
            "url": "https://index.docker.io/v1/",
            "user": "Anonymous",
            "status": "Connected",
            "isDefault": True
        }
    ]

    if config_file.exists():
        try:
            with open(config_file, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            auths = cfg.get("auths", {})
            for reg_url, reg_info in auths.items():
                if "docker.io" in reg_url:
                    repos[0]["user"] = reg_info.get("username", "Authenticated User")
                    repos[0]["status"] = "Active"
                else:
                    repos.append({
                        "name": reg_url,
                        "url": reg_url,
                        "user": reg_info.get("username", "Token configured"),
                        "status": "Active",
                        "isDefault": False
                    })
        except Exception:
            pass

    return repos


@router.post("/repositories/login")
async def login_repository(req: RegistryLoginRequest):
    cmd = ["docker", "login", req.server, "-u", req.username, "--password-stdin"]
    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate(input=req.password.encode())
        success = proc.returncode == 0
        return {
            "success": success,
            "message": stdout.decode().strip() or stderr.decode().strip() or "Login succeeded"
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# ==========================================
# SETTINGS & DAEMON
# ==========================================

@router.get("/settings")
async def get_docker_settings():
    is_up = await DockerService.is_docker_running()
    daemon_path = get_daemon_json_path()
    
    daemon_data: Dict[str, Any] = {}
    if daemon_path.exists():
        try:
            with open(daemon_path, "r", encoding="utf-8") as f:
                daemon_data = json.load(f)
        except Exception:
            daemon_data = {}

    # Extract daemon configurations
    mirrors = daemon_data.get("registry-mirrors", [])
    log_opts = daemon_data.get("log-opts", {})
    max_size = log_opts.get("max-size", "10m")
    max_file = log_opts.get("max-file", "3")
    ipv6_enabled = daemon_data.get("ipv6", False)
    ipv6_subnet = daemon_data.get("fixed-cidr-v6", "2001:db8:1::/64")
    iptables = daemon_data.get("iptables", True)
    live_restore = daemon_data.get("live-restore", False)
    cgroup_driver = "cgroupfs"

    # Query live docker info if running
    if is_up:
        info_res = await DockerService.run_cmd(["docker", "info", "--format", "{{json .}}"])
        if info_res["success"] and info_res["stdout"]:
            try:
                info_json = json.loads(info_res["stdout"])
                cgroup_driver = info_json.get("CgroupDriver", "cgroupfs")
                live_restore = info_json.get("LiveRestoreEnabled", live_restore)
                if not mirrors and info_json.get("RegistryConfig", {}).get("Mirrors"):
                    mirrors = info_json.get("RegistryConfig", {}).get("Mirrors", [])
            except Exception:
                pass

    # Detect compose path
    compose_path = "docker compose"
    if platform.system().lower() == "windows":
        possible_compose = Path("C:/Program Files/Docker/Docker/resources/bin/docker-compose.exe")
        if possible_compose.exists():
            compose_path = str(possible_compose)
    else:
        for p in ["/usr/local/bin/docker-compose", "/usr/bin/docker-compose"]:
            if os.path.exists(p):
                compose_path = p
                break

    # Format daemon.json string
    formatted_daemon_json = json.dumps(daemon_data if daemon_data else {
        "log-driver": "json-file",
        "log-opts": {"max-size": max_size, "max-file": max_file},
        "live-restore": live_restore,
        "registry-mirrors": mirrors
    }, indent=2)

    projects_dir = os.path.abspath(settings.PROJECTS_DIR)

    return {
        "status": "Running" if is_up else "Stopped",
        "accelerate_urls": mirrors,
        "compose_path": compose_path,
        "private_registry": "",
        "log_max_size": max_size,
        "log_max_file": str(max_file),
        "ipv6_enabled": ipv6_enabled,
        "ipv6_subnet": ipv6_subnet,
        "iptables": iptables,
        "live_restore": live_restore,
        "cgroup_driver": cgroup_driver,
        "install_dir": projects_dir,
        "has_applications": True,
        "daemon_json": formatted_daemon_json
    }


@router.post("/settings")
async def update_docker_settings(payload: DaemonSettingsUpdate):
    daemon_path = get_daemon_json_path()
    daemon_path.parent.mkdir(parents=True, exist_ok=True)

    daemon_data: Dict[str, Any] = {}
    if daemon_path.exists():
        try:
            with open(daemon_path, "r", encoding="utf-8") as f:
                daemon_data = json.load(f)
        except Exception:
            daemon_data = {}

    if payload.daemon_json:
        try:
            daemon_data = json.loads(payload.daemon_json)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON configuration: {str(e)}")
    else:
        if payload.accelerate_urls is not None:
            daemon_data["registry-mirrors"] = payload.accelerate_urls
        if payload.log_max_size or payload.log_max_file:
            log_opts = daemon_data.get("log-opts", {})
            if payload.log_max_size:
                log_opts["max-size"] = payload.log_max_size
            if payload.log_max_file:
                log_opts["max-file"] = str(payload.log_max_file)
            daemon_data["log-opts"] = log_opts
            daemon_data["log-driver"] = "json-file"
        if payload.ipv6_enabled is not None:
            daemon_data["ipv6"] = payload.ipv6_enabled
        if payload.ipv6_subnet:
            daemon_data["fixed-cidr-v6"] = payload.ipv6_subnet
        if payload.iptables is not None:
            daemon_data["iptables"] = payload.iptables
        if payload.live_restore is not None:
            daemon_data["live-restore"] = payload.live_restore

    # Write to disk
    with open(daemon_path, "w", encoding="utf-8") as f:
        json.dump(daemon_data, f, indent=2)

    return {
        "success": True,
        "message": f"Docker settings saved to {daemon_path}. Restart Docker for changes to take effect.",
        "settings": payload.model_dump(exclude_unset=True),
        "daemon_json": json.dumps(daemon_data, indent=2)
    }


@router.post("/daemon/{action}")
async def daemon_action(action: str):
    act = action.lower()
    is_windows = platform.system().lower() == "windows"

    if act == "start":
        if is_windows:
            desktop_exe = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"
            if os.path.exists(desktop_exe):
                subprocess.Popen([desktop_exe])
                return {"success": True, "message": "Docker Desktop launched successfully."}
            else:
                res = await DockerService.run_cmd(["net", "start", "com.docker.service"])
                return {"success": res["success"], "message": res["stdout"] or res["stderr"]}
        else:
            res = await DockerService.run_cmd(["systemctl", "start", "docker"])
            return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

    elif act == "restart":
        if is_windows:
            # Check if docker desktop is running
            await DockerService.run_cmd(["taskkill", "/IM", "Docker Desktop.exe", "/F"])
            desktop_exe = "C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe"
            if os.path.exists(desktop_exe):
                await asyncio.sleep(1)
                subprocess.Popen([desktop_exe])
                return {"success": True, "message": "Docker Desktop restarting on host PC."}
            else:
                res = await DockerService.run_cmd(["net", "stop", "com.docker.service"])
                res2 = await DockerService.run_cmd(["net", "start", "com.docker.service"])
                return {"success": res2["success"], "message": "Docker service restart triggered."}
        else:
            res = await DockerService.run_cmd(["systemctl", "restart", "docker"])
            return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

    elif act == "repair":
        # Prune system and remove dead networks
        prune_res = await DockerService.run_cmd(["docker", "system", "prune", "-f"])
        return {
            "success": prune_res["success"],
            "message": "Docker engine system prune completed. Unused containers, networks, and build caches reclaimed."
        }

    else:
        raise HTTPException(status_code=400, detail=f"Unsupported daemon action: {act}")
