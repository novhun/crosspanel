@echo off
setlocal enabledelayedexpansion

title CrossPanel Full-Stack Build System
cd /d "%~dp0"

set "TARGET=%~1"
if "%TARGET%"=="" set "TARGET=all"

if /i "%TARGET%"=="help" goto :show_help
if /i "%TARGET%"=="--help" goto :show_help
if /i "%TARGET%"=="-h" goto :show_help

echo ====================================================
echo        CrossPanel Full-Stack Build System           
echo ====================================================

if /i "%TARGET%"=="all" goto :build_all
if /i "%TARGET%"=="frontend" goto :build_frontend
if /i "%TARGET%"=="backend" goto :build_backend
if /i "%TARGET%"=="docker" goto :build_docker
if /i "%TARGET%"=="desktop" goto :build_desktop
if /i "%TARGET%"=="clean" goto :clean_artifacts

echo [ERROR] Unknown build target: %TARGET%
goto :show_help

:build_all
call :build_backend
call :build_frontend
echo.
echo ====================================================
echo [SUCCESS] Full stack build completed successfully!
echo  * Run web panel:     run.cmd
echo  * Run desktop app:   desktop.cmd
echo  * Docker compose:    docker compose up -d
echo ====================================================
exit /b 0

:build_frontend
echo.
echo [INFO] Building Frontend...
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH. Please install Node.js 18+.
    exit /b 1
)

cd /d "%~dp0frontend"
if not exist "node_modules\" (
    echo [INFO] Installing frontend dependencies (npm install --legacy-peer-deps)...
    call npm install --legacy-peer-deps
)

echo [INFO] Compiling production assets with Vite / TanStack Start...
call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed.
    cd /d "%~dp0"
    exit /b 1
)
echo [SUCCESS] Frontend build completed.
cd /d "%~dp0"
if /i "%TARGET%"=="frontend" exit /b 0
exit /b 0

:build_backend
echo.
echo [INFO] Configuring Backend environment...
cd /d "%~dp0backend"

:: Detect Python
if exist "venv\Scripts\python.exe" (
    set "PY_CMD=venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if not errorlevel 1 (
        set "PY_CMD=python"
    ) else (
        where py >nul 2>&1
        if not errorlevel 1 (
            set "PY_CMD=py -3"
        ) else (
            echo [ERROR] Python was not found in PATH. Please install Python 3.10+.
            cd /d "%~dp0"
            exit /b 1
        )
    )
    echo [INFO] Creating Python virtual environment in .\venv...
    !PY_CMD! -m venv venv
    set "PY_CMD=venv\Scripts\python.exe"
)

echo [INFO] Upgrading pip and installing requirements...
"%PY_CMD%" -m pip install --upgrade pip
"%PY_CMD%" -m pip install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Backend dependencies installation failed.
    cd /d "%~dp0"
    exit /b 1
)
echo [SUCCESS] Backend configured successfully.
cd /d "%~dp0"
if /i "%TARGET%"=="backend" exit /b 0
exit /b 0

:build_docker
echo.
echo [INFO] Building Docker containers...
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker was not found in PATH.
    exit /b 1
)
call docker compose build
if errorlevel 1 (
    echo [ERROR] Docker build failed.
    exit /b 1
)
echo [SUCCESS] Docker images built successfully.
exit /b 0

:build_desktop
echo.
echo [INFO] Installing desktop window dependencies (pywebview)...
cd /d "%~dp0backend"
if exist "venv\Scripts\python.exe" (
    venv\Scripts\python.exe -m pip install pywebview
) else (
    call :build_backend
    venv\Scripts\python.exe -m pip install pywebview
)
echo [SUCCESS] Desktop pywebview package installed.
cd /d "%~dp0"
exit /b 0

:clean_artifacts
echo.
echo [INFO] Cleaning build artifacts...
if exist "%~dp0frontend\.output" rd /s /q "%~dp0frontend\.output"
if exist "%~dp0frontend\dist" rd /s /q "%~dp0frontend\dist"
echo [SUCCESS] Clean completed.
exit /b 0

:show_help
echo.
echo Usage: build.cmd [target]
echo.
echo Targets:
echo   all          Build frontend and configure backend (Default)
echo   frontend     Install dependencies and build production frontend (.output)
echo   backend      Set up Python virtualenv and install requirements
echo   docker       Build production Docker images with docker compose
echo   desktop      Install optional pywebview dependencies for desktop window
echo   clean        Remove build artifacts (.output, dist)
echo   help         Display this help message
echo.
exit /b 0
