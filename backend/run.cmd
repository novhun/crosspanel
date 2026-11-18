@echo off
setlocal enabledelayedexpansion

:: Set console title
title CrossPanel Backend Server

:: Always change directory to the script's directory (backend)
cd /d "%~dp0"

echo ===================================================
echo           CrossPanel Backend Service (FastAPI)
echo ===================================================

:: Check if virtual environment exists
if not exist "venv\Scripts\python.exe" (
    echo [INFO] Virtual environment not found. Checking for Python...
    
    where python >nul 2>&1
    if errorlevel 1 (
        where py >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Python is not installed or not found in PATH.
            echo Please install Python 3.10+ from https://www.python.org/
            pause
            exit /b 1
        ) else (
            set "PY_CMD=py -3"
        )
    ) else (
        set "PY_CMD=python"
    )

    echo [INFO] Creating Python virtual environment in .\venv ...
    !PY_CMD! -m venv venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )

    echo [INFO] Upgrading pip...
    venv\Scripts\python.exe -m pip install --upgrade pip

    echo [INFO] Installing dependencies from requirements.txt...
    venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
)

:: Check if uvicorn is installed in venv
if not exist "venv\Scripts\uvicorn.exe" (
    echo [INFO] Installing missing dependencies from requirements.txt...
    venv\Scripts\python.exe -m pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Dependency installation failed.
        pause
        exit /b 1
    )
)

:: Configuration (Allow overriding via environment or arguments)
if "%HOST%"=="" set HOST=0.0.0.0
if "%PORT%"=="" set PORT=8000

:: Ensure PYTHONPATH includes current backend directory
set PYTHONPATH=.

echo [INFO] Starting FastAPI server...
echo [INFO] Host: %HOST%
echo [INFO] Port: %PORT%
echo [INFO] API Documentation: http://localhost:%PORT%/docs
echo [INFO] Alternative Docs:   http://localhost:%PORT%/redoc
echo ===================================================
echo Press Ctrl+C to stop the server.
echo ===================================================
echo.

venv\Scripts\python.exe -m uvicorn app.main:app --host %HOST% --port %PORT% --reload %*

if errorlevel 1 (
    echo.
    echo [ERROR] Server exited with error code %errorlevel%.
    pause
)
