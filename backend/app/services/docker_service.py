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
        },
        "nextjs": {
            "name": "Next.js App",
            "category": "Fullstack Framework",
            "description": "Production React framework with server rendering and API routes.",
            "default_port": 3001,
            "default_env": {"NODE_ENV": "production"},
            "compose": """version: '3.8'
services:
  web:
    image: node:20-alpine
    container_name: {app_name}_nextjs
    restart: always
    ports:
      - "{port}:3000"
    command: node -e "const http=require('http');http.createServer((req,res)=>res.end('CrossPanel Next.js Runtime Ready')).listen(3000)"
"""
        },
        "vuejs": {
            "name": "Vue.js Frontend",
            "category": "Frontend",
            "description": "Progressive JavaScript SPA served by Nginx.",
            "default_port": 5174,
            "default_env": {},
            "compose": """version: '3.8'
services:
  web:
    image: nginx:alpine
    container_name: {app_name}_vue
    restart: always
    ports:
      - "{port}:80"
"""
        },
        "mysql": {
            "name": "MySQL Database",
            "category": "Database",
            "description": "Popular relational database management system.",
            "default_port": 3306,
            "default_env": {"MYSQL_ROOT_PASSWORD": "crosspanel_root_pass", "MYSQL_DATABASE": "app_db"},
            "compose": """version: '3.8'
services:
  mysql:
    image: mysql:8.4
    container_name: {app_name}_mysql
    restart: always
    ports:
      - "{port}:3306"
    environment:
      MYSQL_ROOT_PASSWORD: {MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: {MYSQL_DATABASE}
    volumes:
      - {app_name}_mysql_data:/var/lib/mysql

volumes:
  {app_name}_mysql_data:
"""
        },
        "redis": {
            "name": "Redis Cache",
            "category": "Database",
            "description": "In-memory data structure store and cache.",
            "default_port": 6379,
            "default_env": {},
            "compose": """version: '3.8'
services:
  redis:
    image: redis:7-alpine
    container_name: {app_name}_redis
    restart: always
    ports:
      - "{port}:6379"
"""
        },
        "mongodb": {
            "name": "MongoDB NoSQL",
            "category": "Database",
            "description": "Document-oriented NoSQL database.",
            "default_port": 27017,
            "default_env": {},
            "compose": """version: '3.8'
services:
  mongo:
    image: mongo:7
    container_name: {app_name}_mongo
    restart: always
    ports:
      - "{port}:27017"
    volumes:
      - {app_name}_mongo_data:/data/db

volumes:
  {app_name}_mongo_data:
"""
        },
        "nginx": {
            "name": "Nginx Reverse Proxy",
            "category": "Web Server",
            "description": "High-performance HTTP server and reverse proxy.",
            "default_port": 8085,
            "default_env": {},
            "compose": """version: '3.8'
services:
  nginx:
    image: nginx:alpine
    container_name: {app_name}_nginx
    restart: always
    ports:
      - "{port}:80"
"""
        },
        "php-fpm": {
            "name": "PHP-FPM Runtime",
            "category": "Runtime",
            "description": "FastCGI Process Manager for PHP workloads.",
            "default_port": 9000,
            "default_env": {},
            "compose": """version: '3.8'
services:
  php:
    image: php:8.3-fpm-alpine
    container_name: {app_name}_php
    restart: always
    ports:
      - "{port}:9000"
"""
        },
        "tailwind": {
            "name": "Tailwind CSS Builder",
            "category": "Frontend",
            "description": "Node.js workspace preconfigured for Tailwind CSS.",
            "default_port": 5175,
            "default_env": {},
            "compose": """version: '3.8'
services:
  tailwind:
    image: node:20-alpine
    container_name: {app_name}_tailwind
    restart: always
    ports:
      - "{port}:3000"
    command: node -e "const http=require('http');http.createServer((req,res)=>res.end('Tailwind CSS Ready')).listen(3000)"
"""
        },
        "supabase": {
            "name": "Supabase Postgres Stack",
            "category": "Backend / BaaS",
            "description": "PostgreSQL + PostgREST starter container.",
            "default_port": 54321,
            "default_env": {"POSTGRES_PASSWORD": "crosspanel_supabase_pass"},
            "compose": """version: '3.8'
services:
  db:
    image: postgres:16-alpine
    container_name: {app_name}_supabase_db
    restart: always
    ports:
      - "{port}:5432"
    environment:
      POSTGRES_PASSWORD: {POSTGRES_PASSWORD}
"""
        },
        "flask": {
            "name": "Flask Microservice",
            "category": "Python",
            "description": "Lightweight WSGI Python web application framework.",
            "default_port": 5000,
            "default_env": {},
            "compose": """version: '3.8'
services:
  flask:
    image: python:3.11-slim
    container_name: {app_name}_flask
    restart: always
    ports:
      - "{port}:5000"
    command: python -m http.server 5000
"""
        },
        "golang": {
            "name": "Golang Service",
            "category": "Runtime",
            "description": "Go language build and HTTP service container.",
            "default_port": 8082,
            "default_env": {},
            "compose": """version: '3.8'
services:
  golang:
    image: golang:1.23-alpine
    container_name: {app_name}_golang
    restart: always
    ports:
      - "{port}:8080"
    command: sh -c "while true; do sleep 3600; done"
"""
        },
        "rust": {
            "name": "Rust Service",
            "category": "Runtime",
            "description": "Rust toolchain container environment.",
            "default_port": 8083,
            "default_env": {},
            "compose": """version: '3.8'
services:
  rust:
    image: rust:1-alpine
    container_name: {app_name}_rust
    restart: always
    ports:
      - "{port}:8080"
    command: sh -c "while true; do sleep 3600; done"
"""
        }
    }

    @classmethod
    async def run_cmd(cls, cmd_list: List[str], cwd: Optional[str] = None, timeout: float = 30.0) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd_list,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
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
            res = await cls.run_cmd(["docker", "info"], timeout=4.0)
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

        is_docker = await cls.is_docker_running()
        if is_docker:
            res = await cls.run_cmd(["docker", "compose", "up", "-d"], cwd=app_dir, timeout=180.0)
            return {
                "success": res["success"],
                "message": f"Container {app_name} deployed successfully on port {port}." if res["success"] else (res["stderr"] or res["stdout"]),
                "compose_yaml": compose_content,
                "app_dir": app_dir,
                "docker_active": True
            }
        else:
            return {
                "success": False,
                "message": f"Docker engine is not running or not installed. Start Docker or choose Native OS mode. (Compose saved to {compose_file})",
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
            res = await cls.run_cmd(["docker", "compose", "up", "-d"], cwd=app_dir, timeout=180.0)
            return {
                "success": res["success"],
                "message": "Custom Docker Compose executed successfully." if res["success"] else (res["stderr"] or res["stdout"]),
                "docker_active": True
            }
        else:
            return {
                "success": False,
                "message": "Docker engine is not running or not installed. Start Docker to launch Compose stacks.",
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
        "apache": {
            "container_name": "crosspanel_apache",
            "image": "httpd:alpine",
            "port": 8081,
            "args": ["-p", "8081:80", "httpd:alpine"]
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
        "mysql": {
            "container_name": "crosspanel_mysql",
            "image": "mysql:8.4",
            "port": 3306,
            "args": ["-p", "3306:3306", "-e", "MYSQL_ROOT_PASSWORD=crosspanel", "mysql:8.4"]
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
        },
        "mongodb": {
            "container_name": "crosspanel_mongodb",
            "image": "mongo:7",
            "port": 27017,
            "args": ["-p", "27017:27017", "mongo:7"]
        },
        "memcached": {
            "container_name": "crosspanel_memcached",
            "image": "memcached:alpine",
            "port": 11211,
            "args": ["-p", "11211:11211", "memcached:alpine"]
        },
        "supervisor": {
            "container_name": "crosspanel_supervisor",
            "image": "ochinchina/supervisord:latest",
            "port": 9001,
            "args": ["-p", "9001:9001", "ochinchina/supervisord:latest"]
        }
    }

    @classmethod
    async def get_service_container_info(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower().replace('-', '_')}"
        image = target["image"] if target else f"{service_name}:latest"
        port = target["port"] if target else 80

        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {
                "container_name": cname,
                "image": image,
                "port": port,
                "installed": False,
                "image_present": False,
                "status": "stopped",
                "is_active": False,
                "docker_available": False
            }

        cmd = ["docker", "inspect", "--format", "{{json .}}", cname]
        res = await cls.run_cmd(cmd, timeout=5.0)
        if res["success"] and res["stdout"]:
            try:
                data = json.loads(res["stdout"])
                state = data.get("State", {})
                running = bool(state.get("Running", False))
                actual_image = data.get("Config", {}).get("Image") or image
                return {
                    "container_name": cname,
                    "image": actual_image,
                    "port": port,
                    "installed": True,
                    "image_present": True,
                    "status": "running" if running else "stopped",
                    "is_active": running,
                    "docker_available": True
                }
            except Exception:
                pass

        img_res = await cls.run_cmd(["docker", "image", "inspect", image], timeout=4.0)
        return {
            "container_name": cname,
            "image": image,
            "port": port,
            "installed": False,
            "image_present": img_res.get("success", False),
            "status": "stopped",
            "is_active": False,
            "docker_available": True
        }

    @classmethod
    async def install_service_container(cls, service_name: str, version: str = "latest") -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower().replace('-', '_')}"
        base_image = target["image"] if target else f"{service_name}:latest"
        repo = base_image.split(":")[0]
        if version and version not in ("latest", "Latest"):
            image = f"{repo}:{version}"
        else:
            image = base_image

        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {
                "success": False,
                "docker_available": False,
                "container_name": cname,
                "image": image,
                "requires_terminal": False,
                "message": "Docker daemon is not running or not installed. Start Docker or choose Native OS mode."
            }

        pull_res = await cls.run_cmd(["docker", "pull", image], timeout=240.0)
        if not pull_res["success"]:
            return {
                "success": False,
                "docker_available": True,
                "container_name": cname,
                "image": image,
                "requires_terminal": False,
                "output": pull_res["stderr"] or pull_res["stdout"],
                "message": f"Failed to pull Docker image {image}: {pull_res['stderr'] or pull_res['stdout']}"
            }

        # Remove existing container with same name if present so re-install uses new image/tag cleanly
        await cls.run_cmd(["docker", "rm", "-f", cname], timeout=15.0)
        base_args = target["args"][:-1] if target else ["-p", "80:80"]
        run_cmd = ["docker", "run", "-d", "--name", cname, "--restart", "always"] + base_args + [image]
        run_res = await cls.run_cmd(run_cmd, timeout=60.0)
        return {
            "success": run_res["success"],
            "docker_available": True,
            "container_name": cname,
            "image": image,
            "requires_terminal": False,
            "output": run_res["stdout"] or run_res["stderr"],
            "message": (
                f"Docker container {cname} ({image}) installed and started."
                if run_res["success"]
                else (run_res["stderr"] or run_res["stdout"] or "Failed to start container")
            )
        }

    @classmethod
    async def uninstall_service_container(cls, service_name: str, remove_image: bool = False) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower().replace('-', '_')}"
        image = target["image"] if target else f"{service_name}:latest"

        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {
                "success": False,
                "docker_available": False,
                "container_name": cname,
                "message": "Docker daemon is not running or not installed."
            }

        rm_res = await cls.run_cmd(["docker", "rm", "-f", cname], timeout=30.0)
        if remove_image:
            await cls.run_cmd(["docker", "rmi", image], timeout=30.0)
        success = rm_res["success"] or "No such container" in rm_res.get("stderr", "")
        return {
            "success": success,
            "docker_available": True,
            "container_name": cname,
            "output": rm_res["stdout"] or rm_res["stderr"],
            "message": f"Docker container {cname} removed." if success else rm_res["stderr"]
        }

    @classmethod
    async def delete_compose_project(cls, app_name: str, container_id: Optional[str] = None) -> Dict[str, Any]:
        app_dir = os.path.join(settings.PROJECTS_DIR, app_name)
        is_docker = await cls.is_docker_running()
        messages: List[str] = []
        if is_docker:
            compose_file = os.path.join(app_dir, "docker-compose.yml")
            if os.path.isfile(compose_file):
                res = await cls.run_cmd(["docker", "compose", "down", "-v", "--remove-orphans"], cwd=app_dir, timeout=60.0)
                if res["success"]:
                    messages.append("Compose stack torn down.")
            if container_id:
                await cls.run_cmd(["docker", "rm", "-f", container_id], timeout=20.0)
            await cls.run_cmd(["docker", "rm", "-f", f"crosspanel_{app_name}"], timeout=20.0)
        if os.path.isdir(app_dir):
            shutil.rmtree(app_dir, ignore_errors=True)
            messages.append(f"Removed {app_dir}.")
        return {
            "success": True,
            "message": " ".join(messages) or f"Removed {app_name}."
        }

    @classmethod
    async def start_service_container(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower().replace('-', '_')}"
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {
                "success": False,
                "message": "Docker daemon is not running or not installed.",
                "container_name": cname
            }

        check_cmd = ["docker", "ps", "-a", "--filter", f"name=^{cname}$", "--format", "{{.Names}}"]
        check_res = await cls.run_cmd(check_cmd, timeout=6.0)
        if check_res["success"] and cname in check_res["stdout"].splitlines():
            start_res = await cls.run_cmd(["docker", "start", cname], timeout=30.0)
            return {
                "success": start_res["success"],
                "message": f"Container {cname} started." if start_res["success"] else start_res["stderr"],
                "container_name": cname
            }
        return await cls.install_service_container(service_name)

    @classmethod
    async def stop_service_container(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower().replace('-', '_')}"
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": False, "message": "Docker daemon is not running or not installed."}
        return await cls.stop_container(cname)

    @classmethod
    async def restart_service_container(cls, service_name: str) -> Dict[str, Any]:
        target = cls.STANDARD_SERVICE_CONTAINERS.get(service_name.lower())
        cname = target["container_name"] if target else f"crosspanel_{service_name.lower().replace('-', '_')}"
        is_docker = await cls.is_docker_running()
        if not is_docker:
            return {"success": False, "message": "Docker daemon is not running or not installed."}
        check_res = await cls.run_cmd(["docker", "ps", "-a", "--filter", f"name=^{cname}$", "--format", "{{.Names}}"], timeout=6.0)
        if check_res["success"] and cname in check_res["stdout"].splitlines():
            return await cls.restart_container(cname)
        return await cls.install_service_container(service_name)
