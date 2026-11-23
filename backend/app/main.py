from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import init_db, AsyncSessionLocal
from app.services.auth_service import AuthService
from app.controllers import (
    system_controller,
    service_controller,
    deploy_controller,
    tunnel_controller,
    database_controller,
    automation_controller,
    file_controller,
    terminal_controller,
    docker_controller,
    auth_controller,
    user_controller
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database
    await init_db()
    async with AsyncSessionLocal() as session:
        await AuthService.ensure_default_admin(session)
    yield
    # Shutdown logic if any

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="CrossPanel All-in-One DevOps Control Panel API (Multi-OS: Linux, macOS, Windows)",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(system_controller.router, prefix=settings.API_PREFIX)
app.include_router(service_controller.router, prefix=settings.API_PREFIX)
app.include_router(deploy_controller.router, prefix=settings.API_PREFIX)
app.include_router(tunnel_controller.router, prefix=settings.API_PREFIX)
app.include_router(database_controller.router, prefix=settings.API_PREFIX)
app.include_router(automation_controller.router, prefix=settings.API_PREFIX)
app.include_router(file_controller.router, prefix=settings.API_PREFIX)
app.include_router(terminal_controller.router, prefix=settings.API_PREFIX)
app.include_router(docker_controller.router, prefix=settings.API_PREFIX)
app.include_router(auth_controller.router, prefix=settings.API_PREFIX)
app.include_router(user_controller.router, prefix=settings.API_PREFIX)

@app.get("/")
async def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "os": settings.HOST_OS,
        "target_os": settings.TARGET_OS,
        "docs_url": "/docs",
        "open_source": "Free Forever & Open-Source"
    }

@app.get("/healthz", tags=["Health"])
@app.get("/api/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "host_os": settings.HOST_OS
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
