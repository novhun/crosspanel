@echo off
echo ====================================================
echo Starting CrossPanel All-in-One DevOps Control Panel
echo ====================================================

start "CrossPanel Backend" cmd /k "cd backend && .\venv\Scripts\activate && set PYTHONPATH=. && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
start "CrossPanel Frontend" cmd /k "cd frontend && npm run dev"

echo CrossPanel is starting up!
echo Backend API Docs: http://localhost:8000/docs
echo Frontend Web UI:  http://localhost:5173
echo phpMyAdmin:       http://localhost:888
