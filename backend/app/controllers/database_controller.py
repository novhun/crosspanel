from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any
from app.db.database import get_db
from app.services.docker_service import DockerService
from app.services.os_manager.factory import os_manager_factory
from app.core.config import settings

router = APIRouter(prefix="/database", tags=["Database Management"])

@router.get("/status")
async def get_database_status():
    mariadb_status = await os_manager_factory.get_service_status("mariadb")
    is_docker_up = await DockerService.is_docker_running()
    return {
        "engine": "MariaDB / MySQL & PostgreSQL",
        "mariadb_status": mariadb_status.get("status", "stopped"),
        "mariadb_port": 3306,
        "postgres_port": 5432,
        "phpmyadmin_port": settings.PHPMYADMIN_PORT,
        "phpmyadmin_active": mariadb_status.get("is_active", False) or is_docker_up,
        "auto_password_free_ready": True
    }

@router.post("/launch-phpmyadmin")
async def launch_phpmyadmin():
    # Deploy or start phpmyadmin container on port 888
    res = await DockerService.deploy_template(
        app_name="crosspanel_phpmyadmin",
        template_key="phpmyadmin",
        port=settings.PHPMYADMIN_PORT,
        env_vars={"PMA_ARBITRARY": "1", "UPLOAD_LIMIT": "256M"}
    )
    
    return {
        "success": True,
        "port": settings.PHPMYADMIN_PORT,
        "url": f"http://localhost:{settings.PHPMYADMIN_PORT}",
        "message": f"phpMyAdmin launched automatically on port {settings.PHPMYADMIN_PORT} (Password-Free Access Ready)",
        "details": res
    }

@router.get("/quick-access")
async def get_quick_access():
    return {
        "phpmyadmin_url": f"http://localhost:{settings.PHPMYADMIN_PORT}",
        "public_port": settings.PHPMYADMIN_PORT,
        "host": "localhost",
        "default_user": "root",
        "password_policy": "No password needed (Auto Auth)",
        "connection_strings": {
            "mysql_cli": f"mysql -h 127.0.0.1 -P 3306 -u root",
            "python_sqlalchemy": "mysql+pymysql://root@localhost:3306/dbname",
            "node_mysql2": "mysql://root@localhost:3306/dbname",
            "php_pdo": "mysql:host=localhost;port=3306;dbname=test;charset=utf8mb4"
        }
    }
