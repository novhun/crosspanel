@echo off
setlocal enabledelayedexpansion

title CrossPanel Launcher
cd /d "%~dp0"

if /i "%1"=="backend" goto run_backend
if /i "%1"=="api" goto run_backend
if /i "%1"=="frontend" goto run_frontend
if /i "%1"=="ui" goto run_frontend
if /i "%1"=="docker" goto run_docker
if /i "%1"=="all" goto run_both

:menu
cls
echo ===================================================
echo               CrossPanel Launcher
echo ===================================================
echo.
echo  [1] Start Full Stack (Backend + Frontend in separate windows)
echo  [2] Start Backend Only (FastAPI API on port 8000)
echo  [3] Start Frontend Only (Vite Web UI on port 5173)
echo  [4] Run with Docker Compose
echo  [5] Exit
echo.
set /p choice="Select an option [1-5] (default is 1): "

if "%choice%"=="" set choice=1
if "%choice%"=="1" goto run_both
if "%choice%"=="2" goto run_backend
if "%choice%"=="3" goto run_frontend
if "%choice%"=="4" goto run_docker
if "%choice%"=="5" exit /b 0

echo Invalid choice. Please try again.
pause
goto menu

:run_both
echo [INFO] Starting Backend in new window...
start "CrossPanel - Backend API" cmd /c "cd /d ""%~dp0backend"" && call run.cmd"

echo [INFO] Starting Frontend in new window...
start "CrossPanel - Frontend UI" cmd /c "cd /d ""%~dp0frontend"" && call run.cmd"

echo.
echo ===================================================
echo  CrossPanel services are starting up!
echo ===================================================
echo  * Backend API:    http://localhost:8000
echo  * Swagger Docs:   http://localhost:8000/docs
echo  * Frontend UI:    http://localhost:5173
echo ===================================================
echo Keep the opened windows running. Close them to stop services.
timeout /t 5 >nul
exit /b 0

:run_backend
cd /d "%~dp0backend"
call run.cmd
exit /b 0

:run_frontend
cd /d "%~dp0frontend"
call run.cmd
exit /b 0

:run_docker
where docker >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not in PATH.
    pause
    exit /b 1
)
echo [INFO] Starting CrossPanel via Docker Compose...
docker compose up --build
exit /b 0
