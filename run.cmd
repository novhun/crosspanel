@echo off
cd /d "%~dp0"
echo ====================================================
echo Starting CrossPanel All-in-One DevOps Control Panel
echo ====================================================

start "CrossPanel Backend" cmd /k "backend\run.cmd"
start "CrossPanel Frontend" cmd /k "frontend\run.cmd"

echo CrossPanel is starting up!
echo Backend API Docs: http://localhost:8000/docs
echo Frontend Web UI:  http://localhost:5173
echo phpMyAdmin:       http://localhost:888
