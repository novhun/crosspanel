# CrossPanel (Multi-OS DevOps Control Panel)

> **All-in-One Multi-OS DevOps Workspace & Hosting Control Panel**  
> *Open-Source & Free Forever — Zero Pro Paywalls, Multi-OS Native Support (Linux, macOS, Windows)*

---

## 🚀 Overview

**CrossPanel** is an enterprise-grade, open-source control panel designed for modern developers and DevOps engineers. Unlike traditional panels locked to a single Linux distribution (like CloudPanel) or aggressive commercial upselling (like aaPanel Pro), CrossPanel gives you 100% freedom to deploy, orchestrate, and monitor workloads across **Linux (Ubuntu, Debian, RHEL)**, **macOS (Homebrew/pf)**, and **Windows (Services & Defender Firewall)**.

---

## ✨ Key Features

1. **System Monitor & Native Service Control**
   - Live telemetry for CPU, RAM, Disk, and Network I/O with historical area charts.
   - Core daemon management (Nginx, PHP-FPM, MariaDB/MySQL, Docker) with automated OS detection (systemd on Linux, brew services on macOS, Services on Windows).

2. **Docker-Based 1-Click App Deployment**
   - Pre-packaged templates for **WordPress (+ MariaDB)**, **FastAPI (Python)**, **Node.js**, **React**, **Laravel**, **PostgreSQL**, **Django**, and **Express.js**.
   - Custom Docker Compose runner with real-time container log streaming.

3. **Automatic, Password-Free Database Management**
   - 1-Click launcher for **phpMyAdmin** on Port **888** with automated session authentication.
   - Direct connection snippets for MySQL CLI, PHP PDO, Python SQLAlchemy, and Node.js.

4. **Git Auto-Deploy (Vercel-like Experience)**
   - Connect GitHub, GitLab, or self-hosted Git repositories.
   - Branch triggers (`main`, `production`, `preview`) with automatic pull and build execution.
   - Isolated environment variables separated between **Production** and **Preview Mode**.

5. **App Library & Custom Source URL**
   - Deploy directly from Docker Hub images (e.g. `ghost:alpine`), Git repositories, or Zip archives via URL.

6. **Network Tunnels & Ingress (NAT Bypass)**
   - Integrated **Cloudflare Tunnels** (`trycloudflare.com`) and **Ngrok** (`ngrok-free.app`).
   - Expose local services (e.g. port 8000, 3000) to external HTTPS without router port-forwarding or public IP requirements.

7. **DevOps Automation (Jenkins CI & Ansible IaC)**
   - **Jenkins Pipelines**: Monitor jobs and trigger remote builds directly with the "Build Now" button.
   - **Ansible Playbooks**: Multi-server infrastructure provisioning and configuration management in 1 click.

8. **Smart Firewall Protection**
   - Port open/close management that automatically commands **UFW** on Linux, **Windows Defender Firewall** on Windows, and **pf** on macOS.

9. **Advanced Web File Manager**
   - Web directory navigation, code editor with syntax support, zip compression/extraction, and CHMOD permission editor.

10. **Interactive Web Terminal**
    - Browser-based shell powered by WebSockets and xterm.js with ANSI color formatting and security toggle switch.

---

## 🛠 Project Structure

```
crosspanel/
├── backend/
│   ├── app/
│   │   ├── controllers/                 # API Endpoints
│   │   │   ├── system_controller.py     # Hardware metrics, firewall, target OS
│   │   │   ├── service_controller.py    # Native OS service controls
│   │   │   ├── deploy_controller.py     # Docker apps, Git auto-deploy, custom compose
│   │   │   ├── tunnel_controller.py     # Cloudflare & Ngrok ingress tunnels
│   │   │   ├── database_controller.py   # phpMyAdmin launcher, DB connection strings
│   │   │   ├── automation_controller.py # Jenkins pipelines & Ansible playbooks
│   │   │   ├── file_controller.py       # Advanced web file manager operations
│   │   │   └── terminal_controller.py   # WebSocket interactive terminal
│   │   ├── services/                    # Business Logic Layer
│   │   │   ├── docker_service.py        # Docker SDK & Compose automation
│   │   │   ├── git_service.py           # Git clone, pull, and build runner
│   │   │   ├── tunnel_service.py        # Cloudflare / Ngrok process manager
│   │   │   ├── jenkins_service.py       # Jenkins remote API client
│   │   │   ├── ansible_service.py       # Ansible playbook executor
│   │   │   ├── file_service.py          # File system, zip, and chmod manager
│   │   │   ├── terminal_service.py      # PTY/Shell WebSocket streamer
│   │   │   └── os_manager/              # Multi-OS Abstraction Layer
│   │   │       ├── base_os.py           # Abstract Base Class
│   │   │       ├── factory.py           # Unified OS Manager Factory
│   │   │       ├── linux/               # systemctl, ufw, procfs
│   │   │       ├── windows/             # PowerShell, netsh, Get-Service
│   │   │       └── mac/                 # brew services, pfctl
│   │   ├── core/                        # Configuration & Security settings
│   │   ├── db/                          # SQLite / aiosqlite async database
│   │   ├── models/                      # SQLAlchemy ORM models
│   │   ├── schemas/                     # Pydantic v2 validation models
│   │   └── main.py                      # FastAPI application entrypoint
│   ├── requirements.txt                 # Python dependencies
│   └── Dockerfile                       # Backend containerization
│
├── frontend/                            # Modern Single Page Application
│   ├── src/
│   │   ├── components/                  # Reusable UI & Layout (Sidebar, Topbar, Modals)
│   │   ├── hooks/                       # useSystemStats real-time polling hook
│   │   ├── pages/                       # Dashboard, Services, Docker, GitDeploy, PMA, etc.
│   │   ├── services/                    # Axios API client
│   │   ├── store/                       # State management
│   │   ├── types/                       # TypeScript interfaces
│   │   ├── App.tsx                      # Main layout and view router
│   │   └── main.tsx                     # React 18 DOM root
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── Dockerfile                       # Frontend containerization
│
├── docker-compose.yml                   # Unified stack orchestration
└── README.md                            # Documentation
```

---

## 🏃 Quick Start Guide

### Option 1: 1-Click Scripts (Recommended)

#### 🚀 Run Both (Backend + Frontend)
- **Windows**: Double-click `run.cmd` in the project root, or execute:
  ```cmd
  .\run.cmd
  ```
- **Linux / macOS**:
  ```bash
  chmod +x run.sh backend/run.sh frontend/run.sh
  ./run.sh
  ```

#### ⚙️ Run Backend Only
- **Windows**:
  ```cmd
  cd backend
  run.cmd
  ```
- **Linux / macOS**:
  ```bash
  cd backend
  ./run.sh
  ```
- Backend API: [http://localhost:8000](http://localhost:8000)
- Swagger Docs: [http://localhost:8000/docs](http://localhost:8000/docs)
- Frontend UI: [http://localhost:5173](http://localhost:5173)

---

### Option 2: Running Manually (Development Mode)

#### 1. Start the Backend API
```powershell
# In project root
cd backend
python -m venv venv
.\venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
pip install -r requirements.txt

# Run FastAPI with Uvicorn
$env:PYTHONPATH="."       # On Linux/macOS: export PYTHONPATH="."
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- API Docs will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

#### 2. Start the Frontend
```powershell
# Open a new terminal
cd frontend
npm install
npm run dev
```
- Web UI will be live at: [http://localhost:5173](http://localhost:5173)

---

### Option 2: Running with Docker Compose
```bash
docker compose up -d --build
```
- Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 📜 License
Distributed under the **MIT License**. Free forever for personal, team, and commercial use.
