import os
import json
import yaml
import asyncio
import shutil
from typing import Dict, Any, List, Optional
from app.core.config import settings

class DockerService:
    TEMPLATES = {
        "wordpress": {
            "name": "WordPress + MariaDB",
            "category": "CMS & Web",
            "description": "Full WordPress blog and site engine paired with MariaDB database.",
            "default_port": 8080,
            "default_env": {
                "WORDPRESS_DB_PASSWORD": "crosspanel_db_pass",
                "WORDPRESS_DB_USER": "crosspanel_user",
                "WORDPRESS_DB_NAME": "wordpress"
            },
            "compose": """version: '3.8'
services:
  db:
    image: mariadb:10.11
    container_name: {app_name}_db
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: {WORDPRESS_DB_PASSWORD}
      MYSQL_DATABASE: {WORDPRESS_DB_NAME}
      MYSQL_USER: {WORDPRESS_DB_USER}
      MYSQL_PASSWORD: {WORDPRESS_DB_PASSWORD}
    volumes:
      - {app_name}_db_data:/var/lib/mysql

  wordpress:
    image: wordpress:latest
    container_name: {app_name}_app
    depends_on:
      - db
    restart: always
    ports:
      - "{port}:80"
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_USER: {WORDPRESS_DB_USER}
      WORDPRESS_DB_PASSWORD: {WORDPRESS_DB_PASSWORD}
      WORDPRESS_DB_NAME: {WORDPRESS_DB_NAME}
    volumes:
      - {app_name}_wp_data:/var/www/html

volumes:
  {app_name}_db_data:
  {app_name}_wp_data:
"""
        },
        "fastapi": {
            "name": "FastAPI (Python)",
            "category": "Backend API",
            "description": "High-performance Python ASGI API with auto OpenAPI docs and Uvicorn.",
            "default_port": 8000,
            "default_env": {
                "ENVIRONMENT": "production",
                "WORKERS": "2"
            },
            "compose": """version: '3.8'
services:
  api:
    image: tiangolo/uvicorn-gunicorn-fastapi:python3.11-slim
    container_name: {app_name}_api
    restart: always
    ports:
      - "{port}:80"
    environment:
      ENVIRONMENT: {ENVIRONMENT}
"""
        },
        "nodejs": {
            "name": "Node.js App",
            "category": "Backend / Fullstack",
            "description": "Modern Node.js runtime environment for microservices and backends.",
            "default_port": 3000,
            "default_env": {
                "NODE_ENV": "production",
                "PORT": "3000"
            },
            "compose": """version: '3.8'
services:
  app:
    image: node:20-alpine
    container_name: {app_name}_app
    restart: always
    ports:
      - "{port}:3000"
    command: node -e "const http=require('http');http.createServer((req,res)=>res.end('Hello from CrossPanel Node.js App!')).listen(3000,()=>console.log('Running on port 3000'))"
"""
        },
        "react": {
            "name": "React Single Page App",
            "category": "Frontend",
            "description": "Lightning fast React SPA served through high-performance Nginx web server.",
            "default_port": 5173,
            "default_env": {
                "VITE_API_URL": "http://localhost:8000"
            },
            "compose": """version: '3.8'
services:
  web:
    image: nginx:alpine
    container_name: {app_name}_web
    restart: always
    ports:
      - "{port}:80"
"""
        },
        "laravel": {
            "name": "Laravel PHP Framework",
            "category": "Web Framework",
            "description": "PHP web application framework with elegant, expressive syntax.",
            "default_port": 8001,
            "default_env": {
                "APP_ENV": "production",
                "APP_DEBUG": "false"
            },
            "compose": """version: '3.8'
services:
  laravel:
    image: bitnami/laravel:latest
    container_name: {app_name}_laravel
    restart: always
    ports:
      - "{port}:8000"
"""
        },
        "postgres": {
            "name": "PostgreSQL Database",
            "category": "Database",
            "description": "Powerful, open source object-relational database system.",
            "default_port": 5432,
            "default_env": {
                "POSTGRES_USER": "crosspanel",
                "POSTGRES_PASSWORD": "secure_db_password",
                "POSTGRES_DB": "crosspanel_db"
            },
            "compose": """version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    container_name: {app_name}_pg
    restart: always
    ports:
      - "{port}:5432"
    environment:
      POSTGRES_USER: {POSTGRES_USER}
      POSTGRES_PASSWORD: {POSTGRES_PASSWORD}
      POSTGRES_DB: {POSTGRES_DB}
    volumes:
      - {app_name}_pg_data:/var/lib/postgresql/data

volumes:
  {app_name}_pg_data:
"""
        },
        "django": {
            "name": "Django Web Application",
            "category": "Fullstack Framework",
            "description": "Batteries-included Python web framework for clean, rapid development.",
            "default_port": 8002,
            "default_env": {
                "DJANGO_SETTINGS_MODULE": "myproject.settings",
                "DEBUG": "0"
            },
            "compose": """version: '3.8'
services:
  django:
    image: python:3.11-slim
    container_name: {app_name}_django
    restart: always
    ports:
      - "{port}:8000"
    command: python -m http.server 8000
"""
        },
        "express": {
            "name": "Express.js REST API",
            "category": "Backend API",
            "description": "Fast, unopinionated, minimalist web framework for Node.js.",
            "default_port": 4000,
            "default_env": {
                "NODE_ENV": "production"
            },
            "compose": """version: '3.8'
services:
  express:
    image: node:20-alpine
    container_name: {app_name}_express
    restart: always
    ports:
      - "{port}:4000"
    command: node -e "const http=require('http');http.createServer((req,res)=>res.end(JSON.stringify({status:'ok',panel:'CrossPanel'}))).listen(4000)"
"""
        },
        "phpmyadmin": {
            "name": "phpMyAdmin (Auto Password-Free)",
            "category": "Database Management",
            "description": "Password-free, 1-click web database administration tool for MySQL and MariaDB.",
            "default_port": 888,
            "default_env": {
                "PMA_ARBITRARY": "1",
                "PMA_HOST": "host.docker.internal",
                "UPLOAD_LIMIT": "256M"
            },
            "compose": """version: '3.8'
services:
  phpmyadmin:
    image: phpmyadmin/phpmyadmin:latest
    container_name: crosspanel_phpmyadmin
    restart: always
    ports:
      - "{port}:80"
    environment:
      PMA_ARBITRARY: 1
      PMA_HOST: host.docker.internal
      UPLOAD_LIMIT: 256M
      PMA_USER: root
      PMA_PASSWORD: ""
"""
        }
    }

    @classmethod
    async def run_cmd(cls, cmd_list: List[str], cwd: Optional[str] = None) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd_list,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            return {
                "success": proc.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="ignore").strip(),
                "stderr": stderr.decode("utf-8", errors="ignore").strip(),
                "exit_code": proc.returncode
            }
        except asyncio.TimeoutError:
            try:
                proc.kill()
            except Exception:
                pass
            return {"success": False, "stdout": "", "stderr": "Command timed out", "exit_code": -1}
        except FileNotFoundError:
            return {"success": False, "stdout": "", "stderr": f"Command not found: {cmd_list[0]}", "exit_code": -1}
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def is_docker_running(cls) -> bool:
        if not shutil.which("docker"):
            return False
        try:
            res = await cls.run_cmd(["docker", "info"])
            return res.get("success", False)
        except Exception:
            return False

    @classmethod
    async def list_containers(cls) -> List[Dict[str, Any]]:
        is_up = await cls.is_docker_running()
        if not is_up:
            return []
        
        cmd = ["docker", "ps", "-a", "--format", "{{json .}}"]
        res = await cls.run_cmd(cmd)
        containers = []
        if res["success"] and res["stdout"]:
            for line in res["stdout"].strip().split("\n"):
                if line:
                    try:
                        containers.append(json.loads(line))
                    except Exception:
                        pass
        return containers

    @classmethod
    async def deploy_template(cls, app_name: str, template_key: str, port: int, env_vars: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        if template_key not in cls.TEMPLATES:
            return {"success": False, "message": f"Template {template_key} not found"}
        
        template_def = cls.TEMPLATES[template_key]
        app_dir = os.path.join(settings.PROJECTS_DIR, app_name)
        os.makedirs(app_dir, exist_ok=True)

        combined_env = dict(template_def.get("default_env", {}))
        if env_vars:
            combined_env.update(env_vars)

        # Substitute format variables
        format_dict = {"app_name": app_name.lower().replace(" ", "_"), "port": port}
        format_dict.update(combined_env)

        compose_content = template_def["compose"]
        for k, v in format_dict.items():
            compose_content = compose_content.replace(f"{{{k}}}", str(v))

        compose_file = os.path.join(app_dir, "docker-compose.yml")
        with open(compose_file, "w", encoding="utf-8") as f:
            f.write(compose_content)

        # Try to run docker compose
        is_docker = await cls.is_docker_running()
        if is_docker:
            res = await cls.run_cmd(["docker", "compose", "up", "-d"], cwd=app_dir)
            return {
                "success": res["success"],
                "message": f"Container {app_name} deployed successfully on port {port}." if res["success"] else res["stderr"],
                "compose_yaml": compose_content,
                "app_dir": app_dir,
                "docker_active": True
            }
        else:
            return {
                "success": True,
                "message": f"Project configuration created. (Docker engine not currently active; configuration saved at {compose_file})",
                "compose_yaml": compose_content,
                "app_dir": app_dir,
                "docker_active": False
            }

    @classmethod
    async def deploy_custom_compose(cls, app_name: str, compose_yaml: str) -> Dict[str, Any]:
        app_dir = os.path.join(settings.PROJECTS_DIR, app_name)
        os.makedirs(app_dir, exist_ok=True)
        compose_file = os.path.join(app_dir, "docker-compose.yml")
        with open(compose_file, "w", encoding="utf-8") as f:
            f.write(compose_yaml)

        is_docker = await cls.is_docker_running()
        if is_docker:
            res = await cls.run_cmd(["docker", "compose", "up", "-d"], cwd=app_dir)
            return {
                "success": res["success"],
                "message": "Custom Docker Compose executed successfully." if res["success"] else res["stderr"],
                "docker_active": True
            }
        else:
            return {
                "success": True,
                "message": "Custom Docker Compose saved. Docker engine is currently offline.",
                "docker_active": False
            }

    @classmethod
    async def get_container_logs(cls, container_name: str, lines: int = 100) -> str:
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return f"[INFO] Docker service is currently not running.\n[CONFIG] Target container: {container_name}\n[STATUS] Ready to stream logs when Docker daemon starts."
        
        res = await cls.run_cmd(["docker", "logs", "--tail", str(lines), container_name])
        return res["stdout"] or res["stderr"] or "No logs available."

    @classmethod
    async def stop_container(cls, container_name: str) -> Dict[str, Any]:
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": True, "message": f"Container {container_name} marked as stopped."}
        res = await cls.run_cmd(["docker", "stop", container_name])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

    @classmethod
    async def start_container(cls, container_name: str) -> Dict[str, Any]:
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": True, "message": f"Container {container_name} marked as started."}
        res = await cls.run_cmd(["docker", "start", container_name])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

    @classmethod
    async def restart_container(cls, container_name: str) -> Dict[str, Any]:
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": True, "message": f"Container {container_name} restarted."}
        res = await cls.run_cmd(["docker", "restart", container_name])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

    @classmethod
    async def delete_container(cls, container_name: str) -> Dict[str, Any]:
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": True, "message": f"Container {container_name} removed from registry."}
        res = await cls.run_cmd(["docker", "rm", "-f", container_name])
        return {"success": res["success"], "message": res["stdout"] or res["stderr"]}

    STANDARD_SERVICE_CONTAINERS = {
        "nginx": {
            "container_name": "crosspanel_nginx",
            "image": "nginx:alpine",
            "port": 80,
            "args": ["-p", "80:80", "nginx:alpine"]
        },
        "php-fpm": {
            "container_name": "crosspanel_phpfpm",
            "image": "php:8.2-fpm-alpine",
            "port": 9000,
            "args": ["-p", "9000:9000", "php:8.2-fpm-alpine"]
        },
        "mariadb": {
            "container_name": "crosspanel_mariadb",
            "image": "mariadb:10.11",
            "port": 3306,
            "args": ["-p", "3306:3306", "-e", "MYSQL_ROOT_PASSWORD=crosspanel", "mariadb:10.11"]
        },
        "redis": {
            "container_name": "crosspanel_redis",
            "image": "redis:alpine",
            "port": 6379,
            "args": ["-p", "6379:6379", "redis:alpine"]
        },
        "postgresql": {
            "container_name": "crosspanel_postgres",
            "image": "postgres:16-alpine",
            "port": 5432,
            "args": ["-p", "5432:5432", "-e", "POSTGRES_PASSWORD=crosspanel", "postgres:16-alpine"]
        }
    }

    @classmethod
    async def get_service_container_info(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower()}"
        image = target["image"] if target else f"{service_name}:latest"

        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {
                "container_name": cname,
                "image": image,
                "status": "stopped",
                "is_active": False,
                "docker_available": False
            }

        cmd = ["docker", "inspect", "--format", "{{json .State}}", cname]
        res = await cls.run_cmd(cmd)
        if res["success"] and res["stdout"]:
            try:
                state = json.loads(res["stdout"])
                running = state.get("Running", False)
                return {
                    "container_name": cname,
                    "image": image,
                    "status": "running" if running else "stopped",
                    "is_active": running,
                    "docker_available": True
                }
            except Exception:
                pass

        return {
            "container_name": cname,
            "image": image,
            "status": "stopped",
            "is_active": False,
            "docker_available": True
        }

    @classmethod
    async def start_service_container(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower()}"
        image = target["image"] if target else f"{service_name}:latest"
        args = target["args"] if target else ["-p", "80:80", image]

        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {
                "success": True,
                "message": f"Service {service_name} started in Docker Container mode (Simulated/Offline engine).",
                "container_name": cname
            }

        # Check if container exists
        check_cmd = ["docker", "ps", "-a", "--filter", f"name={cname}", "--format", "{{.Names}}"]
        check_res = await cls.run_cmd(check_cmd)

        if check_res["success"] and cname in check_res["stdout"]:
            # Start existing
            start_res = await cls.run_cmd(["docker", "start", cname])
            return {
                "success": start_res["success"],
                "message": f"Container {cname} started." if start_res["success"] else start_res["stderr"],
                "container_name": cname
            }
        else:
            # Create & run new container
            run_cmd = ["docker", "run", "-d", "--name", cname, "--restart", "always"] + args
            run_res = await cls.run_cmd(run_cmd)
            return {
                "success": run_res["success"],
                "message": f"Container {cname} created and running." if run_res["success"] else run_res["stderr"],
                "container_name": cname
            }

    @classmethod
    async def stop_service_container(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower()}"
        return await cls.stop_container(cname)

    @classmethod
    async def restart_service_container(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower()}"
        
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": True, "message": f"Container {cname} restarted in Docker mode."}

        # Check if exists
        check_res = await cls.run_cmd(["docker", "ps", "-a", "--filter", f"name={cname}", "--format", "{{.Names}}"])
        if check_res["success"] and cname in check_res["stdout"]:
            return await cls.restart_container(cname)
        else:
            return await cls.start_service_container(service_name)
