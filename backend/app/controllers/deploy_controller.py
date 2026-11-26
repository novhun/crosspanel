import json
import os
import shutil
import signal
import subprocess
import sys
import urllib.request
import zipfile
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db.database import get_db
from app.models.settings import DeployedApp
from app.services.docker_service import DockerService
from app.services.package_manager import PACKAGE_CATALOG, PackageManagerService, get_os_type

router = APIRouter(prefix="/deploy", tags=["Deployment & Applications"])


class OneClickDeployRequest(BaseModel):
    name: str
    template_name: str
    port: int
    mode: str = "docker"
    env_vars: Optional[Dict[str, str]] = None


class CatalogInstallRequest(BaseModel):
    app_name: str
    mode: str = "native"
    version: Optional[str] = "latest"
    port: Optional[int] = None
    instance_name: Optional[str] = None


class CatalogUninstallRequest(BaseModel):
    app_name: str
    mode: Optional[str] = None


class CustomComposeRequest(BaseModel):
    name: str
    compose_yaml: str


class GitDeployRequest(BaseModel):
    name: str
    repo_url: str
    branch: str = "main"
    port: int = 8080
    mode: str = "docker"
    env_vars: Optional[Dict[str, str]] = None
    build_command: Optional[str] = None


# Maps every Application Library app name -> native strategy + docker template key
APP_CATALOG_SPECS: Dict[str, Dict[str, Any]] = {
    "WordPress": {"slug": "wordpress", "native_kind": "php_archive", "docker_template": "wordpress", "default_port": 8080},
    "FastAPI": {"slug": "fastapi", "native_kind": "python_venv", "packages": ["fastapi", "uvicorn"], "docker_template": "fastapi", "default_port": 8000},
    "Node.js": {"slug": "nodejs", "native_kind": "os_package", "pkg_key": "nodejs", "docker_template": "nodejs", "default_port": 3000},
    "React": {"slug": "react", "native_kind": "node_project", "npm_packages": ["react", "react-dom", "vite"], "docker_template": "react", "default_port": 5173},
    "Next.js": {"slug": "nextjs", "native_kind": "node_project", "npm_packages": ["next", "react", "react-dom"], "docker_template": "nextjs", "default_port": 3001},
    "Vue.js": {"slug": "vuejs", "native_kind": "node_project", "npm_packages": ["vue", "vite"], "docker_template": "vuejs", "default_port": 5174},
    "Laravel": {"slug": "laravel", "native_kind": "php_scaffold", "docker_template": "laravel", "default_port": 8001},
    "Django": {"slug": "django", "native_kind": "python_venv", "packages": ["django"], "docker_template": "django", "default_port": 8002},
    "Express.js": {"slug": "express", "native_kind": "node_project", "npm_packages": ["express"], "docker_template": "express", "default_port": 4000},
    "PostgreSQL": {"slug": "postgresql", "native_kind": "os_package", "pkg_key": "postgresql", "docker_template": "postgres", "default_port": 5432},
    "MySQL": {"slug": "mysql", "native_kind": "os_package", "pkg_key": "mysql", "docker_template": "mysql", "default_port": 3306},
    "Redis": {"slug": "redis", "native_kind": "os_package", "pkg_key": "redis", "docker_template": "redis", "default_port": 6379},
    "MongoDB": {"slug": "mongodb", "native_kind": "os_package", "pkg_key": "mongodb", "docker_template": "mongodb", "default_port": 27017},
    "Docker": {"slug": "docker", "native_kind": "os_package", "pkg_key": "docker", "docker_template": None, "default_port": 2375},
    "Nginx": {"slug": "nginx", "native_kind": "os_package", "pkg_key": "nginx", "docker_template": "nginx", "default_port": 80},
    "PHP-FPM": {"slug": "php-fpm", "native_kind": "os_package", "pkg_key": "php-fpm", "docker_template": "php-fpm", "default_port": 9000},
    "Tailwind CSS": {"slug": "tailwind", "native_kind": "node_project", "npm_packages": ["tailwindcss"], "docker_template": "tailwind", "default_port": 5175},
    "Supabase": {"slug": "supabase", "native_kind": "node_project", "npm_packages": ["supabase"], "docker_template": "supabase", "default_port": 54321},
    "Flask": {"slug": "flask", "native_kind": "python_venv", "packages": ["flask"], "docker_template": "flask", "default_port": 5000},
    "Golang": {"slug": "golang", "native_kind": "os_package", "pkg_key": "golang", "docker_template": "golang", "default_port": 8082},
    "Rust": {"slug": "rust", "native_kind": "os_package", "pkg_key": "rust", "docker_template": "rust", "default_port": 8083},
}


def _resolve_spec(app_name: str) -> Dict[str, Any]:
    for k, v in APP_CATALOG_SPECS.items():
        if k.lower() == app_name.lower() or v["slug"] == app_name.lower():
            return {"name": k, **v}
    slug = app_name.lower().replace(" ", "-").replace(".", "")
    return {"name": app_name, "slug": slug, "native_kind": "project_dir", "docker_template": slug, "default_port": 8080}


def _read_pid(app_dir: str) -> Optional[int]:
    pid_file = os.path.join(app_dir, ".crosspanel.pid")
    if not os.path.isfile(pid_file):
        return None
    try:
        pid = int(open(pid_file, "r", encoding="utf-8").read().strip())
        os.kill(pid, 0)
        return pid
    except Exception:
        try:
            os.remove(pid_file)
        except Exception:
            pass
        return None


def _kill_pid(app_dir: str) -> None:
    pid_file = os.path.join(app_dir, ".crosspanel.pid")
    if not os.path.isfile(pid_file):
        return
    try:
        pid = int(open(pid_file, "r", encoding="utf-8").read().strip())
        os.kill(pid, signal.SIGTERM)
    except Exception:
        pass
    try:
        os.remove(pid_file)
    except Exception:
        pass


async def _detect_app_status(spec: Dict[str, Any]) -> Dict[str, Any]:
    slug = spec["slug"]
    native_kind = spec["native_kind"]
    native_installed = False
    native_running = False
    native_version = ""
    install_cmd = ""
    uninstall_cmd = ""

    if native_kind == "os_package":
        info = await PackageManagerService.detect_package(spec["pkg_key"])
        native_installed = bool(info.get("installed"))
        native_running = bool(info.get("is_active"))
        native_version = info.get("version") or ""
        install_cmd = info.get("install_command") or ""
        uninstall_cmd = info.get("uninstall_command") or ""
    else:
        app_dir = os.path.join(settings.PROJECTS_DIR, f"{slug}-native")
        marker = os.path.join(app_dir, ".crosspanel_manifest.json")
        if os.path.isfile(marker):
            native_installed = True
            try:
                meta = json.loads(open(marker, "r", encoding="utf-8").read())
                native_version = meta.get("version", "")
            except Exception:
                pass
            native_running = _read_pid(app_dir) is not None

    docker_available = await DockerService.is_docker_running()
    docker_installed = False
    docker_running = False
    if docker_available:
        d_info = await DockerService.get_service_container_info(slug)
        if d_info.get("installed"):
            docker_installed = True
            docker_running = bool(d_info.get("is_active"))
        else:
            # Also check compose directory container(s)
            containers = await DockerService.list_containers()
            for c in containers:
                cname = (c.get("Names") or "").lower()
                if f"{slug}_" in cname or f"crosspanel_{slug}" in cname or f"{slug}-docker" in cname:
                    docker_installed = True
                    state = (c.get("State") or "").lower()
                    if state == "running":
                        docker_running = True
                    break

    return {
        "name": spec["name"],
        "slug": slug,
        "native_kind": native_kind,
        "native_installed": native_installed,
        "native_running": native_running,
        "native_version": native_version,
        "docker_installed": docker_installed,
        "docker_running": docker_running,
        "docker_available": docker_available,
        "docker_supported": spec.get("docker_template") is not None,
        "installed": native_installed or docker_installed,
        "running": native_running or docker_running,
        "install_command": install_cmd,
        "uninstall_command": uninstall_cmd,
        "os_type": get_os_type(),
    }


async def _install_native_app(spec: Dict[str, Any], instance_name: str, port: int, version: str) -> Dict[str, Any]:
    kind = spec["native_kind"]
    slug = spec["slug"]

    if kind == "os_package":
        return await PackageManagerService.install_package(spec["pkg_key"], version=version)

    app_dir = os.path.join(settings.PROJECTS_DIR, instance_name)
    os.makedirs(app_dir, exist_ok=True)
    log_file = os.path.join(app_dir, "runtime.log")

    if kind == "python_venv":
        venv_dir = os.path.join(app_dir, ".venv")
        py_bin = sys.executable
        if not os.path.isdir(venv_dir):
            res = await PackageManagerService.run_exec([py_bin, "-m", "venv", venv_dir], timeout=120.0)
            if not res["success"]:
                return {"success": False, "requires_terminal": False, "message": res["stderr"] or "Failed to create Python venv"}
        pip_bin = os.path.join(venv_dir, "Scripts" if os.name == "nt" else "bin", "pip")
        vpy_bin = os.path.join(venv_dir, "Scripts" if os.name == "nt" else "bin", "python")
        pkgs = spec.get("packages", [])
        if pkgs:
            pip_res = await PackageManagerService.run_exec([pip_bin, "install", "--quiet"] + pkgs, timeout=240.0)
            if not pip_res["success"]:
                return {"success": False, "requires_terminal": False, "message": pip_res["stderr"] or "pip install failed", "output": pip_res["stderr"]}

        if slug == "fastapi":
            with open(os.path.join(app_dir, "main.py"), "w", encoding="utf-8") as f:
                f.write('from fastapi import FastAPI\napp = FastAPI()\n\n@app.get("/")\ndef root():\n    return {"app": "FastAPI", "managed_by": "CrossPanel"}\n')
            start_cmd = [vpy_bin, "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", str(port)]
        elif slug == "flask":
            with open(os.path.join(app_dir, "app.py"), "w", encoding="utf-8") as f:
                f.write(f'from flask import Flask\napp = Flask(__name__)\n\n@app.route("/")\ndef index():\n    return {{"app": "Flask", "managed_by": "CrossPanel"}}\n\nif __name__ == "__main__":\n    app.run(host="0.0.0.0", port={port})\n')
            start_cmd = [vpy_bin, "app.py"]
        else:  # django
            if not os.path.isfile(os.path.join(app_dir, "manage.py")):
                await PackageManagerService.run_exec([vpy_bin, "-m", "django", "startproject", "sitecore", "."], cwd=app_dir, timeout=60.0)
            start_cmd = [vpy_bin, "manage.py", "runserver", f"0.0.0.0:{port}"]

    elif kind == "node_project":
        npm_bin = PackageManagerService.find_binary(["npm", "npm.cmd"])
        if not npm_bin:
            return {
                "success": False,
                "requires_terminal": False,
                "message": "Node.js / npm is not installed on this host. Install Node.js first or use Docker mode.",
            }
        pkg_json = os.path.join(app_dir, "package.json")
        if not os.path.isfile(pkg_json):
            with open(pkg_json, "w", encoding="utf-8") as f:
                json.dump({"name": instance_name, "version": "1.0.0", "private": True}, f, indent=2)
        npm_pkgs = spec.get("npm_packages", [])
        if npm_pkgs:
            npm_res = await PackageManagerService.run_exec([npm_bin, "install", "--no-audit", "--no-fund"] + npm_pkgs, cwd=app_dir, timeout=240.0)
            if not npm_res["success"]:
                return {"success": False, "requires_terminal": False, "message": npm_res["stderr"] or "npm install failed"}

        node_bin = PackageManagerService.find_binary(["node", "node.exe"]) or "node"
        with open(os.path.join(app_dir, "server.js"), "w", encoding="utf-8") as f:
            f.write(
                f"const http = require('http');\n"
                f"const s = http.createServer((req, res) => {{ res.writeHead(200, {{'Content-Type': 'application/json'}}); res.end(JSON.stringify({{app: '{spec['name']}', managed_by: 'CrossPanel'}})); }});\n"
                f"s.listen({port}, '0.0.0.0');\n"
            )
        start_cmd = [node_bin, "server.js"]

    elif kind == "php_archive":
        zip_path = os.path.join(app_dir, "wordpress.zip")
        if not os.path.isfile(os.path.join(app_dir, "wp-config-sample.php")):
            try:
                urllib.request.urlretrieve("https://wordpress.org/latest.zip", zip_path)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(app_dir)
                wp_sub = os.path.join(app_dir, "wordpress")
                if os.path.isdir(wp_sub):
                    for item in os.listdir(wp_sub):
                        shutil.move(os.path.join(wp_sub, item), os.path.join(app_dir, item))
                    os.rmdir(wp_sub)
                os.remove(zip_path)
            except Exception as e:
                return {"success": False, "requires_terminal": False, "message": f"Failed to download WordPress: {e}"}
        php_bin = PackageManagerService.find_binary(["php", "php.exe"])
        start_cmd = [php_bin, "-S", f"0.0.0.0:{port}", "-t", app_dir] if php_bin else []

    else:  # php_scaffold / generic
        os.makedirs(app_dir, exist_ok=True)
        with open(os.path.join(app_dir, "index.php"), "w", encoding="utf-8") as f:
            f.write(f"<?php echo 'CrossPanel {spec['name']} Native Ready'; ?>\n")
        php_bin = PackageManagerService.find_binary(["php", "php.exe"])
        start_cmd = [php_bin, "-S", f"0.0.0.0:{port}", "-t", app_dir] if php_bin else []

    # Persist manifest + optional background runtime start
    with open(os.path.join(app_dir, ".crosspanel_manifest.json"), "w", encoding="utf-8") as f:
        json.dump({"name": spec["name"], "slug": slug, "version": version, "port": port, "start_cmd": start_cmd}, f, indent=2)

    if start_cmd:
        _kill_pid(app_dir)
        out_fp = open(log_file, "ab")
        proc = subprocess.Popen(start_cmd, cwd=app_dir, stdout=out_fp, stderr=out_fp, start_new_session=True)
        with open(os.path.join(app_dir, ".crosspanel.pid"), "w", encoding="utf-8") as f:
            f.write(str(proc.pid))

    return {
        "success": True,
        "requires_terminal": False,
        "app_dir": app_dir,
        "message": f"{spec['name']} installed natively in {app_dir} (port {port}).",
    }


@router.get("/templates")
async def get_templates():
    return [
        {
            "name": key,
            "display_name": val["name"],
            "description": val["description"],
            "category": val["category"],
            "default_port": val["default_port"],
            "env_defaults": val["default_env"],
        }
        for key, val in DockerService.TEMPLATES.items()
    ]


@router.get("/catalog")
async def get_catalog_status():
    results = []
    for app_name, spec in APP_CATALOG_SPECS.items():
        results.append(await _detect_app_status({"name": app_name, **spec}))
    return results


@router.get("/apps")
async def list_deployed_apps(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(DeployedApp).order_by(DeployedApp.created_at.desc()))
    apps = result.scalars().all()
    is_docker = await DockerService.is_docker_running()
    out = []
    for a in apps:
        mode = "docker" if (a.compose_content or (a.container_id or "").startswith("docker") or (a.container_id or "").startswith("crosspanel_")) else "native"
        if a.source_url == "native":
            mode = "native"
        elif a.source_url == "docker":
            mode = "docker"

        running = a.status == "running"
        app_dir = os.path.join(settings.PROJECTS_DIR, a.name)
        if mode == "native":
            spec = _resolve_spec(a.template_name)
            if spec["native_kind"] == "os_package":
                info = await PackageManagerService.detect_package(spec["pkg_key"])
                running = bool(info.get("is_active"))
            else:
                running = _read_pid(app_dir) is not None
        elif is_docker:
            info = await DockerService.get_service_container_info(a.name)
            if info.get("installed"):
                running = bool(info.get("is_active"))
            elif a.container_id:
                res = await DockerService.run_cmd(["docker", "inspect", "--format", "{{.State.Running}}", a.container_id], timeout=4.0)
                if res["success"]:
                    running = res["stdout"].strip().lower() == "true"

        out.append({
            "id": a.id,
            "name": a.name,
            "template_name": a.template_name,
            "status": "running" if running else "stopped",
            "port": a.port,
            "mode": mode,
            "container_id": a.container_id,
            "env_vars": a.env_vars,
            "source_url": a.source_url,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return out


@router.post("/install")
async def install_catalog_app(req: CatalogInstallRequest, db: AsyncSession = Depends(get_db)):
    spec = _resolve_spec(req.app_name)
    mode = req.mode.lower()
    if mode not in ("native", "docker"):
        raise HTTPException(status_code=400, detail="Mode must be 'native' or 'docker'")

    port = req.port or spec["default_port"]
    slug = spec["slug"]
    instance_name = req.instance_name or f"{slug}-{'native' if mode == 'native' else 'docker'}"

    if mode == "native":
        res = await _install_native_app(spec, instance_name, port, req.version or "latest")
        if not res.get("success"):
            return {
                "success": False,
                "app_name": spec["name"],
                "mode": mode,
                "requires_terminal": bool(res.get("requires_terminal", False)),
                "command": res.get("command") or "",
                "output": res.get("output") or "",
                "message": res.get("message") or "Native installation failed.",
            }
        container_id = f"native:{instance_name}"
        compose_yaml = ""
    else:
        tmpl = spec.get("docker_template")
        if not tmpl:
            return {"success": False, "app_name": spec["name"], "mode": mode, "requires_terminal": False, "message": f"{spec['name']} cannot be installed as a Docker container here — install it in Native OS mode."}
        if tmpl in DockerService.TEMPLATES:
            res = await DockerService.deploy_template(instance_name, tmpl, port)
            compose_yaml = res.get("compose_yaml", "")
        else:
            res = await DockerService.install_service_container(tmpl, req.version or "latest")
            compose_yaml = ""
        if not res.get("success"):
            return {
                "success": False,
                "app_name": spec["name"],
                "mode": mode,
                "requires_terminal": False,
                "command": "",
                "output": res.get("output") or "",
                "message": res.get("message") or "Docker installation failed.",
            }
        container_id = res.get("container_name") or f"crosspanel_{instance_name}"

    existing_q = await db.execute(select(DeployedApp).where(DeployedApp.name == instance_name))
    existing = existing_q.scalar_one_or_none()
    if existing:
        existing.status = "running"
        existing.port = port
        existing.container_id = container_id
        existing.source_url = mode
        existing.compose_content = compose_yaml
        app_row = existing
    else:
        app_row = DeployedApp(
            name=instance_name,
            template_name=slug,
            status="running",
            port=port,
            container_id=container_id,
            source_url=mode,
            compose_content=compose_yaml,
        )
        db.add(app_row)
    await db.commit()
    await db.refresh(app_row)

    return {
        "success": True,
        "app_name": spec["name"],
        "mode": mode,
        "requires_terminal": False,
        "message": res.get("message") or f"{spec['name']} installed cleanly ({mode}).",
        "app": {
            "id": app_row.id,
            "name": app_row.name,
            "template_name": app_row.template_name,
            "status": app_row.status,
            "port": app_row.port,
            "mode": mode,
        },
    }


@router.post("/uninstall")
async def uninstall_catalog_app(req: CatalogUninstallRequest, db: AsyncSession = Depends(get_db)):
    spec = _resolve_spec(req.app_name)
    slug = spec["slug"]
    mode = (req.mode or "native").lower()

    if mode == "docker":
        instance_name = f"{slug}-docker"
        res = await DockerService.delete_compose_project(instance_name)
        if spec.get("docker_template"):
            await DockerService.uninstall_service_container(spec["docker_template"])
            await DockerService.uninstall_service_container(slug)
        for cand_name in (instance_name, slug):
            q = await db.execute(select(DeployedApp).where(DeployedApp.name == cand_name))
            row = q.scalar_one_or_none()
            if row:
                await db.delete(row)
        await db.commit()
        return {"success": bool(res.get("success", True)), "mode": "docker", "requires_terminal": False, "message": res.get("message")}

    # Native uninstall
    instance_name = f"{slug}-native"
    app_dir = os.path.join(settings.PROJECTS_DIR, instance_name)
    _kill_pid(app_dir)
    if os.path.isdir(app_dir):
        shutil.rmtree(app_dir, ignore_errors=True)

    if spec["native_kind"] == "os_package":
        res = await PackageManagerService.uninstall_package(spec["pkg_key"])
    else:
        res = {"success": True, "requires_terminal": False, "message": f"{spec['name']} native installation removed from {app_dir}."}

    if res.get("success"):
        q = await db.execute(select(DeployedApp).where(DeployedApp.name == instance_name))
        row = q.scalar_one_or_none()
        if row:
            await db.delete(row)
            await db.commit()

    return {
        "success": bool(res.get("success", False)),
        "mode": "native",
        "requires_terminal": bool(res.get("requires_terminal", False)),
        "command": res.get("command") or "",
        "output": res.get("output") or "",
        "message": res.get("message") or "",
    }


@router.post("/one-click")
async def deploy_one_click(req: OneClickDeployRequest, db: AsyncSession = Depends(get_db)):
    spec = _resolve_spec(req.template_name)
    mode = req.mode.lower()
    if mode == "native":
        res = await _install_native_app(spec, req.name, req.port, "latest")
        if not res.get("success"):
            raise HTTPException(status_code=400, detail=res.get("message") or "Native deploy failed")
        new_app = DeployedApp(
            name=req.name,
            template_name=req.template_name,
            status="running",
            port=req.port,
            container_id=f"native:{req.name}",
            source_url="native",
            env_vars=json.dumps(req.env_vars or {}),
        )
        db.add(new_app)
        await db.commit()
        await db.refresh(new_app)
        return {"success": True, "mode": "native", "app": new_app, "message": res.get("message")}

    result = await DockerService.deploy_template(req.name, spec.get("docker_template") or req.template_name, req.port, req.env_vars)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Deploy failed"))

    new_app = DeployedApp(
        name=req.name,
        template_name=req.template_name,
        status="running",
        port=req.port,
        container_id=f"{req.name}_app",
        source_url="docker",
        compose_content=result.get("compose_yaml", ""),
        env_vars=json.dumps(req.env_vars or {}),
    )
    db.add(new_app)
    await db.commit()
    await db.refresh(new_app)
    return {"success": True, "mode": "docker", "app": new_app, "message": result.get("message")}


@router.post("/custom-compose")
async def deploy_custom_compose(req: CustomComposeRequest, db: AsyncSession = Depends(get_db)):
    result = await DockerService.deploy_custom_compose(req.name, req.compose_yaml)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    new_app = DeployedApp(
        name=req.name,
        template_name="custom-compose",
        status="running",
        port=0,
        container_id=f"crosspanel_{req.name}",
        source_url="docker",
        compose_content=req.compose_yaml,
    )
    db.add(new_app)
    await db.commit()
    return {"success": True, "message": result.get("message"), "app_id": new_app.id}


@router.post("/git")
async def deploy_from_git(req: GitDeployRequest, db: AsyncSession = Depends(get_db)):
    git_bin = PackageManagerService.find_binary(["git", "git.exe"])
    if not git_bin:
        raise HTTPException(status_code=400, detail="git CLI is not installed on this host.")

    app_dir = os.path.join(settings.PROJECTS_DIR, req.name)
    if os.path.isdir(app_dir):
        shutil.rmtree(app_dir, ignore_errors=True)
    res = await PackageManagerService.run_exec([git_bin, "clone", "--depth", "1", "-b", req.branch, req.repo_url, app_dir], timeout=120.0)
    if not res["success"]:
        raise HTTPException(status_code=400, detail=f"Git clone failed: {res['stderr']}")

    new_app = DeployedApp(
        name=req.name,
        template_name="git-repo",
        status="running",
        port=req.port,
        container_id=f"native:{req.name}",
        source_url=req.repo_url,
    )
    db.add(new_app)
    await db.commit()
    return {"success": True, "message": f"Repository cloned to {app_dir}", "log": res["stdout"] or res["stderr"]}


@router.post("/apps/{app_id}/{action}")
async def control_app(app_id: int, action: str, db: AsyncSession = Depends(get_db)):
    if action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Unsupported action")
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    mode = "native" if app.source_url == "native" or (app.container_id or "").startswith("native:") else "docker"
    app_dir = os.path.join(settings.PROJECTS_DIR, app.name)

    if mode == "native":
        spec = _resolve_spec(app.template_name)
        if spec["native_kind"] == "os_package":
            ctrl = await PackageManagerService.control_service(spec["pkg_key"], action)
            if not ctrl.get("success"):
                return ctrl
        else:
            if action in ("stop", "restart"):
                _kill_pid(app_dir)
            if action in ("start", "restart"):
                manifest = os.path.join(app_dir, ".crosspanel_manifest.json")
                if os.path.isfile(manifest):
                    meta = json.loads(open(manifest, "r", encoding="utf-8").read())
                    cmd = meta.get("start_cmd") or []
                    if cmd:
                        out_fp = open(os.path.join(app_dir, "runtime.log"), "ab")
                        proc = subprocess.Popen(cmd, cwd=app_dir, stdout=out_fp, stderr=out_fp, start_new_session=True)
                        with open(os.path.join(app_dir, ".crosspanel.pid"), "w", encoding="utf-8") as f:
                            f.write(str(proc.pid))
        app.status = "stopped" if action == "stop" else "running"
        await db.commit()
        return {"success": True, "message": f"{app.name} {action}ed cleanly."}

    compose_file = os.path.join(app_dir, "docker-compose.yml")
    if os.path.isfile(compose_file) and await DockerService.is_docker_running():
        dc_action = {"start": ["docker", "compose", "start"], "stop": ["docker", "compose", "stop"], "restart": ["docker", "compose", "restart"]}[action]
        out = await DockerService.run_cmd(dc_action, cwd=app_dir, timeout=60.0)
    elif action == "start":
        out = await DockerService.start_container(app.container_id or f"crosspanel_{app.name}")
    elif action == "stop":
        out = await DockerService.stop_container(app.container_id or f"crosspanel_{app.name}")
    else:
        out = await DockerService.restart_container(app.container_id or f"crosspanel_{app.name}")

    if out.get("success"):
        app.status = "stopped" if action == "stop" else "running"
        await db.commit()
    return out


@router.delete("/apps/{app_id}")
async def delete_app(app_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    mode = "native" if app.source_url == "native" or (app.container_id or "").startswith("native:") else "docker"
    app_dir = os.path.join(settings.PROJECTS_DIR, app.name)
    _kill_pid(app_dir)

    if mode == "docker":
        await DockerService.delete_compose_project(app.name, app.container_id)
    elif os.path.isdir(app_dir):
        shutil.rmtree(app_dir, ignore_errors=True)

    await db.delete(app)
    await db.commit()
    return {"success": True, "message": f"Application '{app.name}' removed cleanly."}


@router.get("/apps/{app_id}/logs")
async def get_app_logs(app_id: int, lines: int = 100, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(DeployedApp).where(DeployedApp.id == app_id))
    app = res.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    log_file = os.path.join(settings.PROJECTS_DIR, app.name, "runtime.log")
    if os.path.isfile(log_file):
        text = open(log_file, "r", encoding="utf-8", errors="replace").read()
        return {"logs": "\n".join(text.splitlines()[-lines:]) or "No native logs yet."}

    logs = await DockerService.get_container_logs(app.container_id or f"crosspanel_{app.name}", lines=lines)
    return {"logs": logs}
