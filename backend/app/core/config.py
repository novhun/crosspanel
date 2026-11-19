import os
import platform
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "CrossPanel"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    SECRET_KEY: str = "crosspanel-secret-dev-key-change-in-prod"
    DEBUG: bool = False
    
    # Storage
    DATA_DIR: str = os.path.abspath("./data")
    PROJECTS_DIR: str = os.path.abspath("./data/projects")
    PLAYBOOKS_DIR: str = os.path.abspath("./data/playbooks")
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite+aiosqlite:///{os.path.abspath('./data/crosspanel.db')}"
        if os.path.exists(os.path.abspath("./data"))
        else "sqlite+aiosqlite:///./crosspanel.db"
    )
    
    # OS detection: 'windows', 'linux', 'mac', or 'auto'
    HOST_OS: str = (
        "windows"
        if platform.system().lower() == "windows"
        else ("mac" if platform.system().lower() == "darwin" else "linux")
    )
    TARGET_OS: str = "auto"
    
    # Security & Features
    TERMINAL_ENABLED: bool = True
    PHPMYADMIN_PORT: int = 888
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
os.makedirs(settings.DATA_DIR, exist_ok=True)
os.makedirs(settings.PROJECTS_DIR, exist_ok=True)
os.makedirs(settings.PLAYBOOKS_DIR, exist_ok=True)
