import asyncio
import datetime
import json
import os
import re
import shutil
import socket
import sqlite3
import subprocess
import sys
import urllib.parse
import urllib.request
import zipfile
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.db.database import get_db
from app.models.settings import DatabaseBackup, ManagedDatabase
from app.services.docker_service import DockerService
from app.services.os_manager.factory import os_manager_factory
from app.services.package_manager import PackageManagerService, get_os_type

router = APIRouter(prefix="/database", tags=["Database Management"])

DB_TOOLS_DIR = os.path.join(settings.DATA_DIR, "db_tools")

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

DB_TOOL_SPECS = {
    "phpmyadmin": {
        "id": "phpmyadmin",
        "name": "phpMyAdmin",
        "engines": "MariaDB / MySQL",
        "description": "Web administration interface for MariaDB & MySQL databases, users, and SQL queries.",
        "default_port": 8888,
        "docker_container": "crosspanel_phpmyadmin",
        "docker_image": "phpmyadmin/phpmyadmin:latest",
        "docker_env": ["-e", "PMA_ARBITRARY=1", "-e", "PMA_HOST=host.docker.internal", "-e", "UPLOAD_LIMIT=256M"],
        "docker_internal_port": 80,
        "default_credentials": "Log in with your MariaDB/MySQL database username & password",
    },
    "pgadmin": {
        "id": "pgadmin",
        "name": "pgAdmin 4",
        "engines": "PostgreSQL",
        "description": "Official feature-rich PostgreSQL administration & query platform.",
        "default_port": 5050,
        "docker_container": "crosspanel_pgadmin",
        "docker_image": "dpage/pgadmin4:latest",
        "docker_env": ["-e", "PGADMIN_DEFAULT_EMAIL=admin@crosspanel.local", "-e", "PGADMIN_DEFAULT_PASSWORD=crosspanel"],
        "docker_internal_port": 80,
        "default_credentials": "Email: admin@crosspanel.local · Password: crosspanel (Docker)",
    },
    "adminer": {
        "id": "adminer",
        "name": "Adminer",
        "engines": "MariaDB · PostgreSQL · SQLite · MongoDB",
        "description": "Lightweight unified database management UI supporting SQL and NoSQL engines.",
        "default_port": 8089,
        "docker_container": "crosspanel_adminer",
        "docker_image": "adminer:latest",
        "docker_env": ["-e", "ADMINER_DESIGN=pepa-linha-dark"],
        "docker_internal_port": 8080,
        "default_credentials": "Select System (MySQL / PostgreSQL / SQLite) and log in with DB user",
    },
    "mongo-express": {
        "id": "mongo-express",
        "name": "Mongo Express",
        "engines": "MongoDB",
        "description": "Web-based MongoDB administrative interface to inspect collections and documents.",
        "default_port": 8084,
        "docker_container": "crosspanel_mongo_express",
        "docker_image": "mongo-express:latest",
        "docker_env": ["-e", "ME_CONFIG_MONGODB_SERVER=host.docker.internal", "-e", "ME_CONFIG_BASICAUTH_USERNAME=admin", "-e", "ME_CONFIG_BASICAUTH_PASSWORD=crosspanel"],
        "docker_internal_port": 8081,
        "default_credentials": "Basic Auth: admin / crosspanel",
    },
}


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


def build_connection_string(
    engine: str,
    db_name: str,
    user: str = "root",
    password: str = "",
    host: str = "127.0.0.1",
    port: int = 0,
) -> str:
    low = engine.lower()
    if "sqlite" in low or port == 0:
        sqlite_path = os.path.abspath(os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{db_name}.db"))
        return f"sqlite:///{sqlite_path}"
    u_enc = urllib.parse.quote(user or "", safe="")
    p_enc = urllib.parse.quote(password or "", safe="")
    auth = f"{u_enc}:{p_enc}@" if password else (f"{u_enc}@" if u_enc else "")
    if "postgres" in low:
        return f"postgresql://{auth}{host}:{port or 5432}/{db_name}"
    if "mongo" in low:
        return f"mongodb://{auth}{host}:{port or 27017}/{db_name}?authSource={db_name}"
    if "redis" in low:
        return f"redis://{auth}{host}:{port or 6379}/0"
    return f"mysql://{auth}{host}:{port or 3306}/{db_name}"


class TestConnectionRequest(BaseModel):
    host: str = "127.0.0.1"
    port: int
    engine: Optional[str] = "PostgreSQL"


class CreateDatabaseRequest(BaseModel):
    name: str
    engine: str = "PostgreSQL"
    user: str = "root"
    password: Optional[str] = ""
    host: str = "127.0.0.1"
    port: Optional[int] = None
    admin_user: Optional[str] = None
    admin_password: Optional[str] = None


class CreateDbUserRequest(BaseModel):
    engine: str = "MariaDB"
    username: str
    password: str
    grant_database: Optional[str] = None
    admin_user: Optional[str] = None
    admin_password: Optional[str] = None


class UpdateUserPasswordRequest(BaseModel):
    engine: str = "MariaDB"
    username: str
    new_password: str
    database_name: Optional[str] = None
    admin_user: Optional[str] = None
    admin_password: Optional[str] = None


class EngineInstallRequest(BaseModel):
    mode: str = "native"
    version: Optional[str] = "latest"


class EngineUninstallRequest(BaseModel):
    mode: Optional[str] = "native"


class EngineActionRequest(BaseModel):
    mode: Optional[str] = None


class ToolInstallRequest(BaseModel):
    mode: str = "native"
    port: Optional[int] = None
    version: Optional[str] = "latest"


class ToolModeRequest(BaseModel):
    mode: Optional[str] = "native"
    port: Optional[int] = None


class DbLoginRequest(BaseModel):
    engine: str = "MariaDB"
    host: str = "127.0.0.1"
    port: Optional[int] = None
    username: str = "root"
    password: str = ""
    database: Optional[str] = ""


class DbQueryRequest(BaseModel):
    engine: str = "MariaDB"
    host: str = "127.0.0.1"
    port: Optional[int] = None
    username: str = "root"
    password: str = ""
    database: Optional[str] = ""
    query: str


def check_port(host: str, port: int, timeout: float = 1.0) -> bool:
    if port <= 0:
        return False
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _read_tool_pid(tool_dir: str) -> Optional[int]:
    pid_path = os.path.join(tool_dir, ".tool.pid")
    if not os.path.isfile(pid_path):
        return None
    try:
        pid = int(open(pid_path, "r", encoding="utf-8").read().strip())
        os.kill(pid, 0)
        return pid
    except Exception:
        try:
            os.remove(pid_path)
        except Exception:
            pass
        return None


def _kill_tool_pid(tool_dir: str) -> None:
    pid_path = os.path.join(tool_dir, ".tool.pid")
    if not os.path.isfile(pid_path):
        return
    try:
        pid = int(open(pid_path, "r", encoding="utf-8").read().strip())
        os.kill(pid, 15)
    except Exception:
        pass
    try:
        os.remove(pid_path)
    except Exception:
        pass


async def _detect_tool(tool_id: str) -> Dict[str, Any]:
    spec = DB_TOOL_SPECS[tool_id]
    os_type = get_os_type()
    tool_dir = os.path.join(DB_TOOLS_DIR, tool_id)
    meta_file = os.path.join(tool_dir, "meta.json")
    port = spec["default_port"]
    if os.path.isfile(meta_file):
        try:
            port = int(json.loads(open(meta_file, "r", encoding="utf-8").read()).get("port", port))
        except Exception:
            pass

    native_installed = False
    native_running = False
    if tool_id in ("phpmyadmin", "adminer"):
        if os.path.isfile(os.path.join(tool_dir, "index.php")):
            native_installed = True
        elif tool_id == "phpmyadmin" and os.path.isdir("/usr/share/phpmyadmin"):
            native_installed = True
        elif tool_id == "adminer" and (os.path.isdir("/usr/share/adminer") or os.path.isfile("/usr/share/adminer/adminer.php")):
            native_installed = True
        native_running = _read_tool_pid(tool_dir) is not None
    elif tool_id == "pgadmin":
        if os.path.isdir(os.path.join(tool_dir, ".venv")):
            native_installed = True
        elif PackageManagerService.find_binary(["pgadmin4", "pgadmin4-web"]):
            native_installed = True
        elif os_type == "darwin" and os.path.isdir("/Applications/pgAdmin 4.app"):
            native_installed = True
        native_running = _read_tool_pid(tool_dir) is not None
    elif tool_id == "mongo-express":
        if os.path.isfile(os.path.join(tool_dir, "node_modules", "mongo-express", "app.js")):
            native_installed = True
        elif PackageManagerService.find_binary(["mongo-express"]):
            native_installed = True
        native_running = _read_tool_pid(tool_dir) is not None

    docker_available = await DockerService.is_docker_running()
    docker_installed = False
    docker_running = False
    cname = spec["docker_container"]
    if docker_available:
        ins = await DockerService.run_cmd(["docker", "inspect", "--format", "{{json .State}}", cname], timeout=4.0)
        if ins["success"] and ins["stdout"]:
            docker_installed = True
            try:
                docker_running = bool(json.loads(ins["stdout"]).get("Running", False))
            except Exception:
                pass

    installed = native_installed or docker_installed
    running = native_running or docker_running
    active_mode = "docker" if (docker_installed and not native_installed) or docker_running else "native"

    return {
        "id": tool_id,
        "name": spec["name"],
        "engines": spec["engines"],
        "description": spec["description"],
        "port": port,
        "url": f"http://localhost:{port}",
        "installed": installed,
        "running": running,
        "native_installed": native_installed,
        "native_running": native_running,
        "docker_installed": docker_installed,
        "docker_running": docker_running,
        "docker_available": docker_available,
        "active_mode": active_mode,
        "default_credentials": spec["default_credentials"],
        "os_type": os_type,
    }


def _find_php_bin() -> Optional[str]:
    return PackageManagerService.find_binary(["php", "php8.3", "php8.2", "php8.1", "php.exe"])


async def _start_native_tool(tool_id: str, port: int) -> Dict[str, Any]:
    tool_dir = os.path.join(DB_TOOLS_DIR, tool_id)
    _kill_tool_pid(tool_dir)
    os.makedirs(tool_dir, exist_ok=True)
    log_path = os.path.join(tool_dir, "tool.log")

    if tool_id in ("phpmyadmin", "adminer"):
        php_bin = _find_php_bin()
        if not php_bin:
            return {"success": False, "message": "PHP runtime is required to serve native phpMyAdmin/Adminer. Install PHP-FPM first or choose Docker mode."}
        doc_root = tool_dir
        if not os.path.isfile(os.path.join(doc_root, "index.php")):
            if tool_id == "phpmyadmin" and os.path.isdir("/usr/share/phpmyadmin"):
                doc_root = "/usr/share/phpmyadmin"
            elif tool_id == "adminer" and os.path.isfile("/usr/share/adminer/adminer.php"):
                doc_root = "/usr/share/adminer"
        out_fp = open(log_path, "ab")
        proc = subprocess.Popen(
            [php_bin, "-S", f"0.0.0.0:{port}", "-t", doc_root],
            cwd=doc_root,
            stdout=out_fp,
            stderr=out_fp,
            start_new_session=True,
        )
        with open(os.path.join(tool_dir, ".tool.pid"), "w", encoding="utf-8") as f:
            f.write(str(proc.pid))
        await asyncio.sleep(0.5)
        return {"success": True, "url": f"http://localhost:{port}", "message": f"{DB_TOOL_SPECS[tool_id]['name']} started natively on port {port}."}

    if tool_id == "pgadmin":
        venv_py = os.path.join(tool_dir, ".venv", "Scripts" if os.name == "nt" else "bin", "python")
        if not os.path.isfile(venv_py):
            return {"success": False, "message": "pgAdmin native venv not found. Install pgAdmin 4 first."}
        env = dict(os.environ)
        env["PGADMIN_LISTEN_PORT"] = str(port)
        env["PGADMIN_LISTEN_ADDRESS"] = "0.0.0.0"
        out_fp = open(log_path, "ab")
        proc = subprocess.Popen(
            [venv_py, "-m", "pgadmin4"],
            cwd=tool_dir,
            env=env,
            stdout=out_fp,
            stderr=out_fp,
            start_new_session=True,
        )
        with open(os.path.join(tool_dir, ".tool.pid"), "w", encoding="utf-8") as f:
            f.write(str(proc.pid))
        await asyncio.sleep(0.8)
        return {"success": True, "url": f"http://localhost:{port}", "message": f"pgAdmin 4 started natively on port {port}."}

    if tool_id == "mongo-express":
        node_bin = PackageManagerService.find_binary(["node", "node.exe"])
        app_js = os.path.join(tool_dir, "node_modules", "mongo-express", "app.js")
        if node_bin and os.path.isfile(app_js):
            env = dict(os.environ)
            env["VCAP_APP_PORT"] = str(port)
            env["ME_CONFIG_SITE_PORT"] = str(port)
            out_fp = open(log_path, "ab")
            proc = subprocess.Popen([node_bin, app_js], cwd=tool_dir, env=env, stdout=out_fp, stderr=out_fp, start_new_session=True)
            with open(os.path.join(tool_dir, ".tool.pid"), "w", encoding="utf-8") as f:
                f.write(str(proc.pid))
            return {"success": True, "url": f"http://localhost:{port}", "message": f"Mongo Express started on port {port}."}
        return {"success": False, "message": "Node.js / mongo-express runtime not installed."}

    return {"success": False, "message": f"Unknown tool: {tool_id}"}


# ── Live DB Engine Execution Helpers ───────────────────────────────────────────

async def _run_mariadb_sql(
    sql: str,
    host: str = "127.0.0.1",
    port: int = 3306,
    username: str = "root",
    password: str = "",
    database: str = "",
) -> Dict[str, Any]:
    d_maria = await DockerService.get_service_container_info("mariadb")
    d_mysql = await DockerService.get_service_container_info("mysql")
    container = d_maria["container_name"] if d_maria.get("is_active") else (d_mysql["container_name"] if d_mysql.get("is_active") else None)

    cli = PackageManagerService.find_binary(["mariadb", "mysql", "mariadb.exe", "mysql.exe"])
    if cli and check_port(host, port, timeout=1.0):
        cmd = [cli, f"-h{host}", f"-P{port}", f"-u{username}", "--batch", "--raw"]
        env = dict(os.environ)
        if password:
            env["MYSQL_PWD"] = password
        if database:
            cmd.append(database)
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        out, err = await asyncio.wait_for(proc.communicate(sql.encode("utf-8")), timeout=15.0)
        return {
            "success": proc.returncode == 0,
            "stdout": out.decode("utf-8", errors="replace").strip(),
            "stderr": err.decode("utf-8", errors="replace").strip(),
        }

    if container:
        docker_cmd = ["docker", "exec", "-i"]
        pw = password if password else ("crosspanel" if username == "root" else "")
        if pw:
            docker_cmd.extend(["-e", f"MYSQL_PWD={pw}"])
        docker_cmd.extend([container, "mariadb" if "mariadb" in container else "mysql", f"-u{username}", "--batch", "--raw"])
        if database:
            docker_cmd.append(database)
        proc = await asyncio.create_subprocess_exec(
            *docker_cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(sql.encode("utf-8")), timeout=15.0)
        return {
            "success": proc.returncode == 0,
            "stdout": out.decode("utf-8", errors="replace").strip(),
            "stderr": err.decode("utf-8", errors="replace").strip(),
        }

    return {"success": False, "stdout": "", "stderr": f"MariaDB/MySQL server is not reachable on {host}:{port} and no local mariadb/mysql client binary was found."}


async def _run_postgres_sql(
    sql: str,
    host: str = "127.0.0.1",
    port: int = 5432,
    username: str = "postgres",
    password: str = "",
    database: str = "postgres",
) -> Dict[str, Any]:
    d_pg = await DockerService.get_service_container_info("postgresql")
    container = d_pg["container_name"] if d_pg.get("is_active") else None

    if container:
        cmd = ["docker", "exec", "-i", "-e", f"PGPASSWORD={password or 'crosspanel'}", container, "psql", "-U", username or "postgres", "-d", database or "postgres", "-t", "-A", "-F", "\t", "-c", sql]
        res = await PackageManagerService.run_exec(cmd, timeout=15.0)
        return res

    psql = PackageManagerService.find_binary(["psql", "psql.exe"])
    if psql and check_port(host, port, timeout=1.0):
        env = dict(os.environ)
        if password:
            env["PGPASSWORD"] = password
        cmd = [psql, "-h", host, "-p", str(port), "-U", username or "postgres", "-d", database or "postgres", "-A", "-F", "\t", "-c", sql]
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env=env)
        out, err = await asyncio.wait_for(proc.communicate(), timeout=15.0)
        if proc.returncode != 0 and get_os_type() == "linux" and not password and (username in ("postgres", "")):
            rc2, out2, err2 = await PackageManagerService.run_shell(f"sudo -n -u postgres psql -d {database or 'postgres'} -A -F $'\\t' -c {json.dumps(sql)}", timeout=10.0)
            if rc2 == 0:
                return {"success": True, "stdout": out2, "stderr": err2}
        return {
            "success": proc.returncode == 0,
            "stdout": out.decode("utf-8", errors="replace").strip(),
            "stderr": err.decode("utf-8", errors="replace").strip(),
        }

    return {"success": False, "stdout": "", "stderr": f"PostgreSQL server is not reachable on {host}:{port}."}


def _parse_tab_table(stdout: str, skip_last_row_count: bool = False) -> Dict[str, Any]:
    lines = [ln for ln in stdout.splitlines() if ln.strip()]
    if skip_last_row_count and lines and re.match(r"^\(\d+ rows?\)$", lines[-1].strip()):
        lines = lines[:-1]
    if not lines:
        return {"columns": [], "rows": []}
    cols = lines[0].split("\t")
    rows = [ln.split("\t") for ln in lines[1:]]
    return {"columns": cols, "rows": rows}


# ── Engine Endpoints ───────────────────────────────────────────────────────────

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


# ── Database Admin Tools (phpMyAdmin, pgAdmin, Adminer, Mongo Express) ──────────

@router.get("/tools")
async def list_database_tools():
    return [await _detect_tool(tid) for tid in DB_TOOL_SPECS]


@router.post("/tools/{tool_id}/install")
async def install_database_tool(tool_id: str, req: ToolInstallRequest):
    if tool_id not in DB_TOOL_SPECS:
        raise HTTPException(status_code=404, detail=f"Unknown database admin tool: {tool_id}")
    spec = DB_TOOL_SPECS[tool_id]
    mode = req.mode.lower()
    port = req.port or spec["default_port"]
    tool_dir = os.path.join(DB_TOOLS_DIR, tool_id)

    if mode == "docker":
        is_docker = await DockerService.is_docker_running()
        if not is_docker:
            return {"success": False, "requires_terminal": False, "message": "Docker daemon is not running or not installed. Start Docker or choose Native OS mode."}
        image = spec["docker_image"]
        if req.version and req.version not in ("latest", "Latest"):
            image = f"{image.split(':')[0]}:{req.version}"
        pull_res = await DockerService.run_cmd(["docker", "pull", image], timeout=240.0)
        if not pull_res["success"]:
            return {"success": False, "requires_terminal": False, "message": f"Docker pull failed: {pull_res['stderr'] or pull_res['stdout']}"}
        cname = spec["docker_container"]
        await DockerService.run_cmd(["docker", "rm", "-f", cname], timeout=15.0)
        run_args = ["docker", "run", "-d", "--name", cname, "--restart", "always", "-p", f"{port}:{spec['docker_internal_port']}"] + spec.get("docker_env", []) + [image]
        run_res = await DockerService.run_cmd(run_args, timeout=60.0)
        return {
            "success": run_res["success"],
            "requires_terminal": False,
            "url": f"http://localhost:{port}",
            "message": f"{spec['name']} Docker container started on http://localhost:{port}" if run_res["success"] else (run_res["stderr"] or "Failed to start container"),
        }

    os.makedirs(tool_dir, exist_ok=True)
    if tool_id == "adminer":
        php_bin = _find_php_bin()
        if not php_bin:
            return {"success": False, "requires_terminal": False, "message": "PHP is required for native Adminer. Install PHP-FPM first (in Service Management) or use Docker mode."}
        dest = os.path.join(tool_dir, "index.php")
        try:
            urllib.request.urlretrieve("https://www.adminer.org/latest.php", dest)
        except Exception as e:
            return {"success": False, "requires_terminal": False, "message": f"Failed to download Adminer: {e}"}
        with open(os.path.join(tool_dir, "meta.json"), "w", encoding="utf-8") as f:
            json.dump({"port": port, "mode": "native"}, f)
        return await _start_native_tool("adminer", port)

    if tool_id == "phpmyadmin":
        php_bin = _find_php_bin()
        if not php_bin:
            return {"success": False, "requires_terminal": False, "message": "PHP is required for native phpMyAdmin. Install PHP-FPM first (in Service Management) or use Docker mode."}
        if not os.path.isfile(os.path.join(tool_dir, "index.php")):
            zip_path = os.path.join(tool_dir, "pma.zip")
            try:
                urllib.request.urlretrieve("https://www.phpmyadmin.net/downloads/phpMyAdmin-latest-all-languages.zip", zip_path)
                with zipfile.ZipFile(zip_path, "r") as zf:
                    zf.extractall(tool_dir)
                for entry in os.listdir(tool_dir):
                    sub = os.path.join(tool_dir, entry)
                    if os.path.isdir(sub) and entry.lower().startswith("phpmyadmin"):
                        for item in os.listdir(sub):
                            target = os.path.join(tool_dir, item)
                            if os.path.exists(target):
                                shutil.rmtree(target, ignore_errors=True)
                            shutil.move(os.path.join(sub, item), target)
                        shutil.rmtree(sub, ignore_errors=True)
                        break
                os.remove(zip_path)
                cfg_path = os.path.join(tool_dir, "config.inc.php")
                if not os.path.isfile(cfg_path):
                    with open(cfg_path, "w", encoding="utf-8") as f:
                        f.write(
                            "<?php\n"
                            "$cfg['blowfish_secret'] = 'CrossPanelSecretKey_32_Bytes_Long_Key!';\n"
                            "$i = 1;\n"
                            "$cfg['Servers'][$i]['auth_type'] = 'cookie';\n"
                            "$cfg['Servers'][$i]['host'] = '127.0.0.1';\n"
                            "$cfg['Servers'][$i]['AllowNoPassword'] = true;\n"
                            "$cfg['AllowArbitraryServer'] = true;\n"
                        )
            except Exception as e:
                return {"success": False, "requires_terminal": False, "message": f"Failed to install native phpMyAdmin: {e}"}
        with open(os.path.join(tool_dir, "meta.json"), "w", encoding="utf-8") as f:
            json.dump({"port": port, "mode": "native"}, f)
        return await _start_native_tool("phpmyadmin", port)

    if tool_id == "pgadmin":
        venv_dir = os.path.join(tool_dir, ".venv")
        if not os.path.isdir(venv_dir):
            res = await PackageManagerService.run_exec([sys.executable, "-m", "venv", venv_dir], timeout=120.0)
            if not res["success"]:
                return {"success": False, "requires_terminal": False, "message": res["stderr"] or "Failed to create venv for pgAdmin"}
        pip_bin = os.path.join(venv_dir, "Scripts" if os.name == "nt" else "bin", "pip")
        pip_res = await PackageManagerService.run_exec([pip_bin, "install", "--quiet", "pgadmin4"], timeout=300.0)
        if not pip_res["success"]:
            return {"success": False, "requires_terminal": False, "message": pip_res["stderr"] or "Failed to install pgadmin4 via pip"}
        with open(os.path.join(tool_dir, "meta.json"), "w", encoding="utf-8") as f:
            json.dump({"port": port, "mode": "native"}, f)
        return {"success": True, "requires_terminal": False, "url": f"http://localhost:{port}", "message": "pgAdmin 4 installed natively."}

    if tool_id == "mongo-express":
        npm_bin = PackageManagerService.find_binary(["npm", "npm.cmd"])
        if not npm_bin:
            return {"success": False, "requires_terminal": False, "message": "Node.js / npm is required for native Mongo Express, or use Docker mode."}
        npm_res = await PackageManagerService.run_exec([npm_bin, "install", "--no-audit", "--no-fund", "mongo-express"], cwd=tool_dir, timeout=240.0)
        if not npm_res["success"]:
            return {"success": False, "requires_terminal": False, "message": npm_res["stderr"] or "Failed to install mongo-express"}
        with open(os.path.join(tool_dir, "meta.json"), "w", encoding="utf-8") as f:
            json.dump({"port": port, "mode": "native"}, f)
        return await _start_native_tool("mongo-express", port)

    return {"success": False, "message": "Unsupported tool"}


@router.post("/tools/{tool_id}/uninstall")
async def uninstall_database_tool(tool_id: str, req: ToolModeRequest = ToolModeRequest()):
    if tool_id not in DB_TOOL_SPECS:
        raise HTTPException(status_code=404, detail=f"Unknown database admin tool: {tool_id}")
    spec = DB_TOOL_SPECS[tool_id]
    mode = (req.mode or "native").lower()
    if mode == "docker":
        is_docker = await DockerService.is_docker_running()
        if not is_docker:
            return {"success": False, "requires_terminal": False, "message": "Docker daemon is not running."}
        rm_res = await DockerService.run_cmd(["docker", "rm", "-f", spec["docker_container"]], timeout=30.0)
        ok = rm_res["success"] or "No such container" in rm_res.get("stderr", "")
        return {"success": ok, "requires_terminal": False, "message": f"{spec['name']} Docker container uninstalled."}

    tool_dir = os.path.join(DB_TOOLS_DIR, tool_id)
    _kill_tool_pid(tool_dir)
    if os.path.isdir(tool_dir):
        shutil.rmtree(tool_dir, ignore_errors=True)
    return {"success": True, "requires_terminal": False, "message": f"{spec['name']} native installation removed."}


@router.post("/tools/{tool_id}/{action}")
async def control_database_tool(tool_id: str, action: str, req: ToolModeRequest = ToolModeRequest()):
    if tool_id not in DB_TOOL_SPECS or action not in ("start", "stop", "restart"):
        raise HTTPException(status_code=400, detail="Invalid tool or action")
    spec = DB_TOOL_SPECS[tool_id]
    info = await _detect_tool(tool_id)
    mode = req.mode or info["active_mode"]
    port = req.port or info["port"]

    if mode == "docker":
        cname = spec["docker_container"]
        if action == "start":
            res = await DockerService.start_container(cname)
        elif action == "stop":
            res = await DockerService.stop_container(cname)
        else:
            res = await DockerService.restart_container(cname)
        return {"success": res.get("success", False), "url": f"http://localhost:{port}", "message": res.get("message") or f"{spec['name']} {action}ed."}

    tool_dir = os.path.join(DB_TOOLS_DIR, tool_id)
    if action == "stop":
        _kill_tool_pid(tool_dir)
        return {"success": True, "message": f"{spec['name']} stopped."}
    return await _start_native_tool(tool_id, port)


# ── Real Databases, Passwords, Connection Strings, Users, Login & SQL ──────────

@router.get("/live-inventory")
async def get_live_inventory():
    inventory: List[Dict[str, Any]] = []
    users_list: List[Dict[str, Any]] = []

    sqlite_dir = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs")
    if os.path.isdir(sqlite_dir):
        for fname in sorted(os.listdir(sqlite_dir)):
            if fname.endswith(".db"):
                fpath = os.path.join(sqlite_dir, fname)
                size_mb = round(os.path.getsize(fpath) / (1024.0 * 1024.0), 3)
                tables = 0
                try:
                    conn = sqlite3.connect(fpath)
                    tables = conn.execute("SELECT count(*) FROM sqlite_master WHERE type='table'").fetchone()[0]
                    conn.close()
                except Exception:
                    pass
                db_n = fname[:-3]
                inventory.append({
                    "name": db_n,
                    "engine": "SQLite",
                    "user": "local",
                    "password": "",
                    "host": "127.0.0.1",
                    "port": 0,
                    "size_mb": size_mb,
                    "tables_count": tables,
                    "connection_string": build_connection_string("SQLite", db_n),
                })

    # MariaDB / MySQL real databases, sizes, table counts, and users
    m_res = await _run_mariadb_sql(
        "SELECT s.SCHEMA_NAME, COUNT(t.TABLE_NAME), ROUND(COALESCE(SUM(t.DATA_LENGTH + t.INDEX_LENGTH), 0) / 1048576, 3) "
        "FROM information_schema.SCHEMATA s LEFT JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = s.SCHEMA_NAME "
        "WHERE s.SCHEMA_NAME NOT IN ('information_schema','performance_schema','mysql','sys') GROUP BY s.SCHEMA_NAME;"
    )
    if m_res["success"] and m_res["stdout"]:
        for ln in m_res["stdout"].splitlines()[1:]:
            parts = ln.split("\t")
            dclean = parts[0].strip() if parts else ""
            if dclean:
                tbls = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
                mb = float(parts[2]) if len(parts) > 2 else 0.0
                inventory.append({
                    "name": dclean,
                    "engine": "MariaDB",
                    "user": "root",
                    "password": "",
                    "host": "127.0.0.1",
                    "port": 3306,
                    "size_mb": mb,
                    "tables_count": tbls,
                    "connection_string": build_connection_string("MariaDB", dclean, "root", "", "127.0.0.1", 3306),
                })
        u_res = await _run_mariadb_sql("SELECT User, Host FROM mysql.user;")
        if u_res["success"] and u_res["stdout"]:
            for ln in u_res["stdout"].splitlines()[1:]:
                parts = ln.split("\t")
                if parts[0]:
                    users_list.append({"username": parts[0], "host": parts[1] if len(parts) > 1 else "localhost", "engine": "MariaDB"})

    # PostgreSQL real databases, sizes, and users
    pg_res = await _run_postgres_sql(
        "SELECT d.datname, pg_catalog.pg_get_userbyid(d.datdba), ROUND(pg_database_size(d.datname)/1048576.0, 3) "
        "FROM pg_database d WHERE d.datistemplate = false;"
    )
    if pg_res["success"] and pg_res["stdout"]:
        for ln in pg_res["stdout"].splitlines():
            clean = ln.strip()
            if not clean or clean.startswith("("):
                continue
            parts = clean.split("\t")
            dname = parts[0].strip()
            owner = parts[1].strip() if len(parts) > 1 else "postgres"
            mb = float(parts[2]) if len(parts) > 2 else 0.0
            inventory.append({
                "name": dname,
                "engine": "PostgreSQL",
                "user": owner,
                "password": "",
                "host": "127.0.0.1",
                "port": 5432,
                "size_mb": mb,
                "tables_count": 0,
                "connection_string": build_connection_string("PostgreSQL", dname, owner, "", "127.0.0.1", 5432),
            })
        pgu = await _run_postgres_sql("SELECT usename FROM pg_user;")
        if pgu["success"] and pgu["stdout"]:
            for ln in pgu["stdout"].splitlines():
                uclean = ln.strip()
                if uclean and not uclean.startswith("("):
                    users_list.append({"username": uclean, "host": "127.0.0.1", "engine": "PostgreSQL"})

    return {"databases": inventory, "users": users_list}


@router.get("/list")
async def list_databases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ManagedDatabase).order_by(ManagedDatabase.created_at.desc()))
    dbs = result.scalars().all()
    live = await get_live_inventory()
    live_by_key = {(ld["name"], ld["engine"]): ld for ld in live["databases"]}

    items = []
    seen = set()
    for d in dbs:
        live_match = live_by_key.get((d.name, d.engine))
        pw = d.db_password or ""
        conn_str = d.connection_string or build_connection_string(d.engine, d.name, d.user, pw, d.host, d.port)
        size_mb = live_match["size_mb"] if live_match else (d.size_mb or 0.0)
        tables_count = live_match["tables_count"] if live_match else (d.tables_count or 0)
        seen.add((d.name, d.engine))
        items.append({
            "id": d.id,
            "name": d.name,
            "engine": d.engine,
            "user": d.user,
            "password": pw,
            "host": d.host,
            "port": d.port,
            "size_mb": size_mb,
            "tables_count": tables_count,
            "run_mode": d.run_mode,
            "connection_string": conn_str,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })

    for idx, ld in enumerate(live["databases"]):
        if (ld["name"], ld["engine"]) not in seen:
            items.append({"id": 10000 + idx, **ld, "run_mode": "native"})
    return items


@router.post("/create")
async def create_database(req: CreateDatabaseRequest, db: AsyncSession = Depends(get_db)):
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", req.name):
        raise HTTPException(status_code=400, detail="Invalid database name format (letters, numbers, underscores only).")
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", req.user):
        raise HTTPException(status_code=400, detail="Invalid database username format (letters, numbers, underscores only).")

    engine_low = req.engine.lower()
    host = req.host or "127.0.0.1"
    default_port = 5432 if "postgres" in engine_low else 3306 if ("maria" in engine_low or "mysql" in engine_low) else 27017 if "mongo" in engine_low else 0
    port = req.port if req.port is not None else default_port
    pw = req.password or ""
    safe_pw = pw.replace("'", "''")

    if port == 0 or "sqlite" in engine_low:
        db_dir = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs")
        os.makedirs(db_dir, exist_ok=True)
        sqlite3.connect(os.path.join(db_dir, f"{req.name}.db")).close()
    elif "maria" in engine_low or "mysql" in engine_low:
        sql_parts = [f"CREATE DATABASE IF NOT EXISTS `{req.name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"]
        if req.user != "root":
            if pw:
                sql_parts.append(f"CREATE USER IF NOT EXISTS '{req.user}'@'%' IDENTIFIED BY '{safe_pw}';")
                sql_parts.append(f"CREATE USER IF NOT EXISTS '{req.user}'@'localhost' IDENTIFIED BY '{safe_pw}';")
                sql_parts.append(f"ALTER USER '{req.user}'@'%' IDENTIFIED BY '{safe_pw}';")
                sql_parts.append(f"ALTER USER '{req.user}'@'localhost' IDENTIFIED BY '{safe_pw}';")
            else:
                sql_parts.append(f"CREATE USER IF NOT EXISTS '{req.user}'@'%';")
                sql_parts.append(f"CREATE USER IF NOT EXISTS '{req.user}'@'localhost';")
            sql_parts.append(f"GRANT ALL PRIVILEGES ON `{req.name}`.* TO '{req.user}'@'%';")
            sql_parts.append(f"GRANT ALL PRIVILEGES ON `{req.name}`.* TO '{req.user}'@'localhost';")
            sql_parts.append("FLUSH PRIVILEGES;")
        res = await _run_mariadb_sql(
            "\n".join(sql_parts),
            host=host,
            port=port,
            username=req.admin_user or "root",
            password=req.admin_password or "",
        )
        if not res["success"]:
            raise HTTPException(status_code=400, detail=f"MariaDB/MySQL error: {res['stderr'] or 'Unable to connect as admin. Install/start MariaDB or pass admin credentials.'}")
    elif "postgres" in engine_low:
        stmts = []
        if req.user != "postgres":
            if pw:
                stmts.append(f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='{req.user}') THEN CREATE USER \"{req.user}\" WITH PASSWORD '{safe_pw}'; ELSE ALTER USER \"{req.user}\" WITH PASSWORD '{safe_pw}'; END IF; END $$;")
            else:
                stmts.append(f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='{req.user}') THEN CREATE USER \"{req.user}\"; END IF; END $$;")
        res_u = await _run_postgres_sql("\n".join(stmts) if stmts else "SELECT 1;", host=host, port=port, username=req.admin_user or "postgres", password=req.admin_password or "")
        if not res_u["success"]:
            raise HTTPException(status_code=400, detail=f"PostgreSQL error: {res_u['stderr'] or 'Unable to connect to PostgreSQL server.'}")
        owner_clause = f' OWNER "{req.user}"' if req.user != "postgres" else ""
        res_db = await _run_postgres_sql(f'CREATE DATABASE "{req.name}"{owner_clause};', host=host, port=port, username=req.admin_user or "postgres", password=req.admin_password or "")
        if not res_db["success"] and "already exists" not in res_db["stderr"].lower():
            raise HTTPException(status_code=400, detail=f"PostgreSQL CREATE DATABASE failed: {res_db['stderr']}")
    elif "mongo" in engine_low:
        d_mo = await DockerService.get_service_container_info("mongodb")
        mongosh = PackageManagerService.find_binary(["mongosh", "mongo"])
        js = f"db.getSiblingDB('{req.name}').createCollection('_init');"
        if req.user and pw:
            js += f"db.getSiblingDB('{req.name}').createUser({{user:'{req.user}',pwd:'{safe_pw}',roles:[{{role:'readWrite',db:'{req.name}'}}]}});"
        if d_mo.get("is_active"):
            m_res = await DockerService.run_cmd(["docker", "exec", d_mo["container_name"], "mongosh", "--quiet", "--eval", js], timeout=15.0)
        elif mongosh and check_port(host, port, timeout=1.0):
            m_res = await PackageManagerService.run_exec([mongosh, f"mongodb://{host}:{port}", "--quiet", "--eval", js], timeout=15.0)
        else:
            raise HTTPException(status_code=400, detail="MongoDB server is not installed/running.")
        if not m_res["success"]:
            raise HTTPException(status_code=400, detail=f"MongoDB error: {m_res['stderr']}")

    conn_str = build_connection_string(req.engine, req.name, req.user, pw, host, port)
    existing_q = await db.execute(select(ManagedDatabase).where(ManagedDatabase.name == req.name))
    existing = existing_q.scalar_one_or_none()
    if existing:
        existing.engine = req.engine
        existing.user = req.user
        existing.db_password = pw
        existing.connection_string = conn_str
        existing.host = host
        existing.port = port
        new_db = existing
    else:
        new_db = ManagedDatabase(
            name=req.name,
            engine=req.engine,
            user=req.user,
            db_password=pw,
            connection_string=conn_str,
            host=host,
            port=port,
            size_mb=0,
            tables_count=0,
            run_mode="native",
        )
        db.add(new_db)
    await db.commit()
    await db.refresh(new_db)
    return {
        "success": True,
        "message": f"Database '{req.name}' & user '{req.user}' created on {req.engine}.",
        "database": {
            "id": new_db.id,
            "name": new_db.name,
            "engine": new_db.engine,
            "user": new_db.user,
            "password": pw,
            "host": new_db.host,
            "port": new_db.port,
            "connection_string": conn_str,
        },
    }


@router.post("/users/create")
async def create_database_user(req: CreateDbUserRequest, db: AsyncSession = Depends(get_db)):
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", req.username):
        raise HTTPException(status_code=400, detail="Invalid username format.")
    low = req.engine.lower()
    safe_pw = req.password.replace("'", "''")
    target_db = req.grant_database.strip() if req.grant_database else ""

    if "maria" in low or "mysql" in low:
        sql = [
            f"CREATE USER IF NOT EXISTS '{req.username}'@'%' IDENTIFIED BY '{safe_pw}';",
            f"CREATE USER IF NOT EXISTS '{req.username}'@'localhost' IDENTIFIED BY '{safe_pw}';",
            f"ALTER USER '{req.username}'@'%' IDENTIFIED BY '{safe_pw}';",
            f"ALTER USER '{req.username}'@'localhost' IDENTIFIED BY '{safe_pw}';",
        ]
        if target_db and re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", target_db):
            sql.append(f"GRANT ALL PRIVILEGES ON `{target_db}`.* TO '{req.username}'@'%';")
            sql.append(f"GRANT ALL PRIVILEGES ON `{target_db}`.* TO '{req.username}'@'localhost';")
        else:
            sql.append(f"GRANT ALL PRIVILEGES ON *.* TO '{req.username}'@'%' WITH GRANT OPTION;")
        sql.append("FLUSH PRIVILEGES;")
        res = await _run_mariadb_sql("\n".join(sql), username=req.admin_user or "root", password=req.admin_password or "")
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "Failed to create MariaDB user")
    elif "postgres" in low:
        sql = f"DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='{req.username}') THEN CREATE USER \"{req.username}\" WITH PASSWORD '{safe_pw}'; ELSE ALTER USER \"{req.username}\" WITH PASSWORD '{safe_pw}'; END IF; END $$;"
        if target_db and re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", target_db):
            sql += f'\nGRANT ALL PRIVILEGES ON DATABASE "{target_db}" TO "{req.username}";'
        res = await _run_postgres_sql(sql, username=req.admin_user or "postgres", password=req.admin_password or "")
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "Failed to create PostgreSQL user")
    else:
        raise HTTPException(status_code=400, detail=f"User management not supported for {req.engine}")

    # Sync stored credentials on any matching ManagedDatabase rows
    q = await db.execute(select(ManagedDatabase).where(ManagedDatabase.user == req.username))
    for row in q.scalars().all():
        row.db_password = req.password
        row.connection_string = build_connection_string(row.engine, row.name, row.user, req.password, row.host, row.port)
    await db.commit()
    return {"success": True, "message": f"User '{req.username}' created & privileges granted on {req.engine}."}


@router.post("/users/password")
async def update_user_password(req: UpdateUserPasswordRequest, db: AsyncSession = Depends(get_db)):
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", req.username):
        raise HTTPException(status_code=400, detail="Invalid username format.")
    low = req.engine.lower()
    safe_pw = req.new_password.replace("'", "''")

    if "maria" in low or "mysql" in low:
        sql = "\n".join([
            f"ALTER USER IF EXISTS '{req.username}'@'%' IDENTIFIED BY '{safe_pw}';",
            f"ALTER USER IF EXISTS '{req.username}'@'localhost' IDENTIFIED BY '{safe_pw}';",
            "FLUSH PRIVILEGES;",
        ])
        res = await _run_mariadb_sql(sql, username=req.admin_user or "root", password=req.admin_password or "")
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "Failed to update password")
    elif "postgres" in low:
        sql = f'ALTER USER "{req.username}" WITH PASSWORD \'{safe_pw}\';'
        res = await _run_postgres_sql(sql, username=req.admin_user or "postgres", password=req.admin_password or "")
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "Failed to update PostgreSQL password")
    elif "sqlite" in low:
        pass
    else:
        raise HTTPException(status_code=400, detail=f"Password update unsupported for {req.engine}")

    stmt = select(ManagedDatabase).where(ManagedDatabase.user == req.username)
    if req.database_name:
        stmt = stmt.where(ManagedDatabase.name == req.database_name)
    res_rows = await db.execute(stmt)
    for row in res_rows.scalars().all():
        row.db_password = req.new_password
        row.connection_string = build_connection_string(row.engine, row.name, row.user, req.new_password, row.host, row.port)
    await db.commit()
    return {"success": True, "message": f"Password updated for '{req.username}' ({req.engine})."}


@router.delete("/users/{engine_name}/{username}")
async def drop_database_user(engine_name: str, username: str):
    if not re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", username):
        raise HTTPException(status_code=400, detail="Invalid username format.")
    if username in ("root", "postgres", "mariadb.sys"):
        raise HTTPException(status_code=400, detail="Refusing to drop built-in system superuser account.")
    low = engine_name.lower()
    if "maria" in low or "mysql" in low:
        sql = f"DROP USER IF EXISTS '{username}'@'%'; DROP USER IF EXISTS '{username}'@'localhost'; FLUSH PRIVILEGES;"
        res = await _run_mariadb_sql(sql)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "Failed to drop MariaDB user")
        return {"success": True, "message": f"User '{username}' removed from MariaDB."}
    if "postgres" in low:
        res = await _run_postgres_sql(f'DROP ROLE IF EXISTS "{username}";')
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "Failed to drop PostgreSQL role")
        return {"success": True, "message": f"Role '{username}' removed from PostgreSQL."}
    raise HTTPException(status_code=400, detail=f"User drop unsupported for {engine_name}")


@router.post("/login-session")
async def login_database_session(req: DbLoginRequest):
    low = req.engine.lower()
    if "sqlite" in low:
        db_dir = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs")
        os.makedirs(db_dir, exist_ok=True)
        dbs = [f[:-3] for f in os.listdir(db_dir) if f.endswith(".db")]
        return {"success": True, "databases": dbs, "version": sqlite3.sqlite_version, "message": f"Connected to local SQLite ({len(dbs)} database files)."}

    if "maria" in low or "mysql" in low:
        port = req.port or 3306
        res = await _run_mariadb_sql("SELECT VERSION();\nSHOW DATABASES;", host=req.host, port=port, username=req.username, password=req.password, database=req.database or "")
        if not res["success"]:
            raise HTTPException(status_code=401, detail=res["stderr"] or "Authentication failed.")
        lines = [ln.strip() for ln in res["stdout"].splitlines() if ln.strip()]
        version = lines[1] if len(lines) > 1 and not lines[1].startswith("Database") else "MariaDB/MySQL"
        db_list = [ln for ln in lines if ln not in ("VERSION()", "Database", version)]
        return {"success": True, "databases": db_list, "version": version, "message": f"Authenticated as '{req.username}' on {req.engine} ({len(db_list)} databases)."}

    if "postgres" in low:
        port = req.port or 5432
        res = await _run_postgres_sql("SELECT datname FROM pg_database WHERE datistemplate = false;", host=req.host, port=port, username=req.username, password=req.password, database=req.database or "postgres")
        if not res["success"]:
            raise HTTPException(status_code=401, detail=res["stderr"] or "PostgreSQL authentication failed.")
        db_list = [ln.strip() for ln in res["stdout"].splitlines() if ln.strip() and not ln.strip().startswith("(")]
        return {"success": True, "databases": db_list, "version": "PostgreSQL", "message": f"Authenticated as '{req.username}' on PostgreSQL."}

    raise HTTPException(status_code=400, detail=f"Interactive login not implemented for {req.engine}")


@router.post("/query")
async def execute_database_query(req: DbQueryRequest):
    q = req.query.strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    low = req.engine.lower()

    if "sqlite" in low:
        dbname = req.database or "default"
        db_path = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{dbname}.db")
        if not os.path.isfile(db_path):
            raise HTTPException(status_code=404, detail=f"SQLite database '{dbname}' not found.")
        try:
            conn = sqlite3.connect(db_path)
            cur = conn.cursor()
            cur.execute(q)
            if cur.description:
                cols = [d[0] for d in cur.description]
                rows = [[str(c) if c is not None else "NULL" for c in r] for r in cur.fetchmany(200)]
                conn.close()
                return {"success": True, "columns": cols, "rows": rows, "message": f"{len(rows)} row(s) returned."}
            conn.commit()
            affected = cur.rowcount
            conn.close()
            return {"success": True, "columns": [], "rows": [], "message": f"Query executed ({affected} rows affected)."}
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    if "maria" in low or "mysql" in low:
        res = await _run_mariadb_sql(q, host=req.host, port=req.port or 3306, username=req.username, password=req.password, database=req.database or "")
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "SQL execution error")
        parsed = _parse_tab_table(res["stdout"])
        return {"success": True, **parsed, "raw_output": res["stdout"], "message": "Query executed cleanly."}

    if "postgres" in low:
        res = await _run_postgres_sql(q, host=req.host, port=req.port or 5432, username=req.username, password=req.password, database=req.database or "postgres")
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "PostgreSQL query error")
        parsed = _parse_tab_table(res["stdout"], skip_last_row_count=True)
        return {"success": True, **parsed, "raw_output": res["stdout"], "message": "Query executed cleanly."}

    raise HTTPException(status_code=400, detail=f"Query runner unsupported for {req.engine}")


@router.delete("/{db_name}")
async def delete_database(db_name: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ManagedDatabase).where(ManagedDatabase.name == db_name))
    target = result.scalar_one_or_none()
    if target:
        eng = target.engine.lower()
        if "sqlite" in eng:
            db_file = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{target.name}.db")
            if os.path.exists(db_file):
                os.remove(db_file)
        elif "maria" in eng or "mysql" in eng:
            if re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", target.name):
                await _run_mariadb_sql(f"DROP DATABASE IF EXISTS `{target.name}`;")
        elif "postgres" in eng:
            if re.match(r"^[A-Za-z_][A-Za-z0-9_]{0,62}$", target.name):
                await _run_postgres_sql(f'DROP DATABASE IF EXISTS "{target.name}";')
        await db.delete(target)
        await db.commit()
        return {"success": True, "message": f"Database '{db_name}' deleted."}

    # Also handle live unmanaged DB deletion (SQLite file or engine DB)
    sqlite_file = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{db_name}.db")
    if os.path.exists(sqlite_file):
        os.remove(sqlite_file)
        return {"success": True, "message": f"SQLite database '{db_name}' deleted."}

    raise HTTPException(status_code=404, detail="Database not found")


@router.post("/test-connection")
async def test_database_connection(req: TestConnectionRequest):
    if _canonical_engine(req.engine or "") == "sqlite":
        return {"success": True, "message": f"SQLite embedded engine ready (v{sqlite3.sqlite_version})."}
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
    eng_low = engine.lower()

    backup_dir = os.path.join(settings.PROJECTS_DIR, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    ts = datetime.datetime.now().strftime("%Y-%m-%d_%H%M%S")
    filename = f"{db_name}-{ts}.sql"
    filepath = os.path.join(backup_dir, filename)

    dump_text = ""
    if "sqlite" in eng_low or os.path.isfile(os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{db_name}.db")):
        engine = "SQLite"
        sqlite_path = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs", f"{db_name}.db")
        if os.path.isfile(sqlite_path):
            conn = sqlite3.connect(sqlite_path)
            dump_text = "\n".join(conn.iterdump())
            conn.close()
    elif "maria" in eng_low or "mysql" in eng_low:
        dump_bin = PackageManagerService.find_binary(["mariadb-dump", "mysqldump"])
        if dump_bin and check_port("127.0.0.1", 3306, timeout=1.0):
            res = await PackageManagerService.run_exec([dump_bin, "-h127.0.0.1", "-uroot", db_name], timeout=60.0)
            if res["success"]:
                dump_text = res["stdout"]
    elif "postgres" in eng_low:
        pg_dump = PackageManagerService.find_binary(["pg_dump"])
        if pg_dump and check_port("127.0.0.1", 5432, timeout=1.0):
            res = await PackageManagerService.run_exec([pg_dump, "-h", "127.0.0.1", "-U", "postgres", db_name], timeout=60.0)
            if res["success"]:
                dump_text = res["stdout"]

    with open(filepath, "w", encoding="utf-8") as f:
        if dump_text:
            f.write(dump_text)
        else:
            f.write(f"-- CrossPanel Database Snapshot\n-- Database: {db_name}\n-- Engine: {engine}\n-- Timestamp: {ts}\n\n")

    file_bytes = os.path.getsize(filepath)
    size_kb = max(1.0, round(file_bytes / 1024.0, 2))
    backup_rec = DatabaseBackup(
        database_name=db_name,
        filename=filename,
        database_type=engine.lower(),
        file_size=file_bytes,
        file_path=filepath,
        notes="Real database dump" if dump_text else "Metadata snapshot",
    )
    db.add(backup_rec)
    await db.commit()
    return {
        "success": True,
        "message": f"Snapshot '{filename}' created ({size_kb} KB).",
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
            "database_name": r.database_name,
            "engine": (r.database_type or "sqlite").capitalize(),
            "time": r.created_at.strftime("%Y-%m-%d %H:%M") if r.created_at else "Just now",
            "size": size_str,
            "notes": r.notes,
        })
    return out


@router.get("/backups/{filename}/download")
async def download_backup(filename: str, db: AsyncSession = Depends(get_db)):
    safe_name = os.path.basename(filename)
    filepath = os.path.join(settings.PROJECTS_DIR, "backups", safe_name)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(path=filepath, filename=safe_name, media_type="application/sql")


@router.post("/backups/{filename}/restore")
async def restore_backup(filename: str, db: AsyncSession = Depends(get_db)):
    safe_name = os.path.basename(filename)
    result = await db.execute(select(DatabaseBackup).where(DatabaseBackup.filename == safe_name))
    rec = result.scalar_one_or_none()
    filepath = rec.file_path if rec and os.path.isfile(rec.file_path) else os.path.join(settings.PROJECTS_DIR, "backups", safe_name)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found")

    sql_content = open(filepath, "r", encoding="utf-8", errors="replace").read()
    target_db = rec.database_name if rec else safe_name.split("-")[0]
    eng = (rec.database_type or "").lower() if rec else ""

    if "sqlite" in eng:
        db_dir = os.path.join(settings.PROJECTS_DIR, "sqlite_dbs")
        os.makedirs(db_dir, exist_ok=True)
        target_file = os.path.join(db_dir, f"{target_db}.db")
        if os.path.isfile(target_file):
            os.remove(target_file)
        conn = sqlite3.connect(target_file)
        conn.executescript(sql_content)
        conn.commit()
        conn.close()
        return {"success": True, "message": f"Restored SQLite database '{target_db}' from {safe_name}."}

    if "maria" in eng or "mysql" in eng:
        res = await _run_mariadb_sql(sql_content, database=target_db)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "MariaDB restore failed")
        return {"success": True, "message": f"Restored '{target_db}' from {safe_name}."}

    if "postgres" in eng:
        res = await _run_postgres_sql(sql_content, database=target_db)
        if not res["success"]:
            raise HTTPException(status_code=400, detail=res["stderr"] or "PostgreSQL restore failed")
        return {"success": True, "message": f"Restored '{target_db}' from {safe_name}."}

    raise HTTPException(status_code=400, detail="Unsupported engine for automatic SQL restore.")


@router.get("/status")
async def get_database_status():
    mariadb_info = await os_manager_factory.get_service_status("mariadb")
    mariadb_running = mariadb_info.get("is_active", False) or check_port("127.0.0.1", 3306)
    pma_info = await _detect_tool("phpmyadmin")

    return {
        "engine": "mariadb / postgres",
        "mariadb_status": "running" if mariadb_running else "stopped",
        "mariadb_port": 3306,
        "postgres_port": 5432,
        "phpmyadmin_port": pma_info["port"],
        "phpmyadmin_active": pma_info["running"],
        "auto_password_free_ready": True,
    }


@router.post("/launch-phpmyadmin")
async def launch_phpmyadmin():
    info = await _detect_tool("phpmyadmin")
    if info["installed"] and info["running"]:
        return {
            "success": True,
            "port": info["port"],
            "url": info["url"],
            "message": f"phpMyAdmin is running on {info['url']}",
        }
    if info["installed"]:
        res = await control_database_tool("phpmyadmin", "start", ToolModeRequest(mode=info["active_mode"], port=info["port"]))
        return {
            "success": res.get("success", False),
            "port": info["port"],
            "url": info["url"],
            "message": res.get("message", "phpMyAdmin started."),
        }
    mode = "docker" if info["docker_available"] else "native"
    res = await install_database_tool("phpmyadmin", ToolInstallRequest(mode=mode, port=info["port"]))
    return {
        "success": res.get("success", False),
        "port": info["port"],
        "url": res.get("url") or info["url"],
        "message": res.get("message", "phpMyAdmin install attempted."),
    }


@router.get("/quick-access")
async def get_quick_access_info():
    pma_info = await _detect_tool("phpmyadmin")
    return {
        "phpmyadmin_url": pma_info["url"],
        "public_port": pma_info["port"],
        "host": "127.0.0.1",
        "default_user": "root",
        "password_policy": "Supports real DB credentials & arbitrary server login",
    }
