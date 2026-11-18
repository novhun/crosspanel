#!/usr/bin/env bash
echo "===================================================="
echo "Starting CrossPanel All-in-One DevOps Control Panel"
echo "===================================================="

# Start Backend
(cd backend && source venv/bin/activate && export PYTHONPATH="." && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload) &
BACKEND_PID=$!

# Start Frontend
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo "CrossPanel is starting up!"
echo "Backend API Docs: http://localhost:8000/docs"
echo "Frontend Web UI:  http://localhost:5173"
echo "phpMyAdmin:       http://localhost:888"

trap "kill $BACKEND_PID $FRONTEND_PID" EXIT
wait
