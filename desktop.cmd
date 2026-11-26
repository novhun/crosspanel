@echo off
setlocal enabledelayedexpansion

title CrossPanel Desktop Application
cd /d "%~dp0"

:: Locate Python executable (prefer backend venv)
if exist "%~dp0backend\venv\Scripts\python.exe" (
    set "PYTHON=%~dp0backend\venv\Scripts\python.exe"
) else (
    where python >nul 2>&1
    if not errorlevel 1 (
        set "PYTHON=python"
    ) else (
        where py >nul 2>&1
        if not errorlevel 1 (
            set "PYTHON=py -3"
        ) else (
            echo [ERROR] Python was not found in PATH.
            echo Please install Python 3.10+ and try again.
            pause
            exit /b 1
        )
    )
)

:: Ensure pywebview is available
"%PYTHON%" -c "import webview" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing required pywebview package...
    "%PYTHON%" -m pip install pywebview
)

"%PYTHON%" "%~dp0desktop.py" %*

if errorlevel 1 (
    echo.
    echo [ERROR] CrossPanel Desktop stopped unexpectedly.
    pause
)
