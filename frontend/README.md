# CrossPanel Frontend

Modern, high-performance web control panel interface for **CrossPanel** (Multi-OS DevOps Hosting & Infrastructure Control Panel).

Built with **React 19**, **TanStack Start**, **TanStack Router**, **TanStack Query**, **Tailwind CSS**, and **Radix UI**.

---

## 🏗️ Architecture & Directory Structure

```
frontend/
├── public/                 # Static assets (favicons, icons)
├── src/
│   ├── api/                # Typed API client connecting to FastAPI Backend
│   │   ├── client.ts       # Base HTTP client (fetch wrapper with baseURL & timeout)
│   │   ├── system.api.ts   # System stats, telemetry, firewall rules
│   │   ├── service.api.ts  # Native & Docker services management
│   │   ├── deploy.api.ts   # Docker 1-click apps & Git deployments
│   │   ├── tunnel.api.ts   # Cloudflare & Ngrok tunnels
│   │   ├── database.api.ts # Database engines & phpMyAdmin launcher
│   │   └── index.ts        # Barrel export
│   │
│   ├── types/              # Strong TypeScript interfaces matching backend models
│   │   ├── api.types.ts    # Generic API responses & errors
│   │   ├── system.types.ts # SystemStatus, HardwareDiagnostics, FirewallRule
│   │   ├── service.types.ts# ManagedService, ServiceAction
│   │   ├── deploy.types.ts # DeployedApp, DeployTemplate, GitDeployPayload
│   │   ├── tunnel.types.ts # TunnelRecord, TunnelCreatePayload
│   │   ├── database.types.ts # DatabaseStatus, PhpMyAdminLaunchResult
│   │   └── index.ts
│   │
│   ├── hooks/              # Custom React & TanStack Query hooks
│   │   ├── useSystemStats.ts # Real-time polling hook for live CPU, RAM, Disk
│   │   ├── useServices.ts    # Query & mutation hook for OS services
│   │   ├── useTunnels.ts     # Query & mutation hook for network tunnels
│   │   ├── useDatabase.ts    # Query & mutation hook for database & PMA
│   │   └── use-mobile.tsx    # Responsive viewport detection
│   │
│   ├── components/
│   │   ├── cp/             # CrossPanel core feature views & workspaces
│   │   │   ├── AppShell.tsx            # Main layout & navigation container
│   │   │   ├── ServiceWorkspace.tsx    # Native OS / Docker service manager
│   │   │   ├── DatabasesWorkspace.tsx  # DB engines, backups, phpMyAdmin
│   │   │   ├── TunnelsWorkspace.tsx    # Cloudflare / Ngrok tunnel manager
│   │   │   ├── FilesWorkspace.tsx      # Web file manager
│   │   │   ├── AutomationWorkspace.tsx # CI/CD & Ansible
│   │   │   └── ...
│   │   └── ui/             # Radix UI & Shadcn primitives (button, dialog, tabs...)
│   │
│   ├── routes/             # TanStack Router file-based pages
│   │   ├── __root.tsx      # Root layout, theme provider & global query client
│   │   ├── index.tsx       # System Dashboard with live hardware telemetry
│   │   ├── service.tsx     # Services dashboard
│   │   ├── applications.tsx# 1-Click App Library
│   │   ├── deployments.tsx # Git Auto-Deploy
│   │   ├── databases.tsx   # Database management & PMA
│   │   ├── tunnels.tsx     # Ingress Tunnels
│   │   ├── files.tsx       # Web File Manager
│   │   ├── terminal.tsx    # Web Terminal
│   │   ├── automation.tsx  # DevOps automation (Jenkins / Ansible)
│   │   └── security.tsx    # Smart Firewall
│   │
│   ├── lib/                # Utility helpers (cn, formatting)
│   ├── styles.css          # Tailwind CSS root stylesheet
│   └── router.tsx          # TanStack Router configuration
│
├── Dockerfile              # Production container build (Nginx + static build)
├── run.cmd                 # 1-Click launcher for Windows
├── run.sh                  # 1-Click launcher for Linux / macOS
├── package.json
└── vite.config.ts          # Vite configuration with /api reverse proxy
```

---

## 🚀 Getting Started

### 1. Quick Launch
- **Windows**:
  ```cmd
  run.cmd
  ```
- **Linux / macOS**:
  ```bash
  chmod +x run.sh
  ./run.sh
  ```

### 2. Manual Commands
```bash
# Install dependencies
npm install --legacy-peer-deps

# Start Vite dev server (proxies /api to http://127.0.0.1:8000)
npm run dev

# Build for production
npm run build
```
