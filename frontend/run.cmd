@echo off
setlocal enabledelayedexpansion

title CrossPanel Frontend (Vite)
cd /d "%~dp0"

echo ===================================================
echo           CrossPanel Frontend (Vite UI)
echo ===================================================

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not found in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo [INFO] Installing frontend dependencies (npm install)...
    npm install --legacy-peer-deps
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Vite development server...
echo [INFO] Frontend URL: http://localhost:5173
echo ===================================================
echo.

npm run dev -- %*

if errorlevel 1 (
    echo.
    echo [ERROR] Frontend server stopped with error.
    pause
)
