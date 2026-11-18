crosspanel/                              # ថតគម្រោងគោល (Root Directory)
│
├── backend/                             # ផ្នែក API (Python FastAPI)
│   ├── app/
│   │   ├── controllers/                 # [API Routes] ទទួល HTTP Requests ពី Frontend
│   │   │   ├── system_controller.py     # ឧ. @app.get("/api/system/status")
│   │   │   ├── service_controller.py    # ឧ. @app.post("/api/service/start")
│   │   │   ├── deploy_controller.py     # ឧ. @app.post("/api/deploy/git")
│   │   │   └── tunnel_controller.py     # ឧ. @app.post("/api/tunnel/create")
│   │   │
│   │   ├── services/                    # [Business Logic] កន្លែងសរសេរកូដមុខងារស្នូល
│   │   │   ├── docker_service.py        # កូដបញ្ជា Docker Containers
│   │   │   ├── git_service.py           # កូដទាញយកកូដពី GitHub/GitLab
│   │   │   ├── jenkins_service.py       # កូដបញ្ជា Jenkins CI/CD
│   │   │   │
│   │   │   └── os_manager/              # [OS Layer] កូដបញ្ជាប្រព័ន្ធប្រតិបត្តិការ
│   │   │       ├── base_os.py           # Abstract Class (កំណត់ស្តង់ដារកូដ)
│   │   │       ├── factory.py           # អ្នកចាត់ចែង (Detect OS -> ហៅ Folder ឱ្យត្រូវ)
│   │   │       │
│   │   │       ├── linux/               # សម្រាប់ប្រព័ន្ធ Linux
│   │   │       │   ├── system.py        # កូដទាញយក CPU/RAM
│   │   │       │   └── commands.py      # កូដបញ្ជា Service (systemctl, bash)
│   │   │       │
│   │   │       ├── windows/             # សម្រាប់ប្រព័ន្ធ Windows
│   │   │       │   ├── system.py        # កូដទាញយក CPU/RAM
│   │   │       │   └── commands.py      # កូដបញ្ជា Service (PowerShell)
│   │   │       │
│   │   │       └── mac/                 # សម្រាប់ប្រព័ន្ធ macOS
│   │   │           ├── system.py        # កូដទាញយក CPU/RAM
│   │   │           └── commands.py      # កូដបញ្ជា Service (brew services)
│   │   │
│   │   ├── core/                        # [System Settings] Config, Security, JWT
│   │   │   └── config.py
│   │   ├── db/                          # [Database Setup] តភ្ជាប់ SQLite / PostgreSQL
│   │   │   └── database.py
│   │   ├── models/                      # [ORM Models] តារាង (Tables) ក្នុង Database
│   │   │   └── settings.py
│   │   ├── schemas/                     # [Pydantic Models] កំណត់ប្រភេទ Input/Output
│   │   │   └── server_stats.py
│   │   └── main.py                      # [Entry Point] ឯកសារចម្បងសម្រាប់ Run FastAPI
│   │
│   ├── requirements.txt                 # បញ្ជី Library របស់ Python
│   └── Dockerfile                       # សម្រាប់ Build Backend Image ដាក់ក្នុង Docker
│
├── frontend/                            # ផ្នែក UI (React 19 + TypeScript + Vite + Tailwind)
│   ├── public/                          # ឯកសារ Static (Favicon, Logos)
│   ├── src/
│   │   ├── assets/                      # រូបភាព និង CSS បន្ថែម
│   │   │
│   │   ├── types/                       # [TypeScript Types] Interfaces កំណត់ទម្រង់ទិន្នន័យ
│   │   │   ├── system.types.ts          # ឧ. interface SystemStatus { cpu: number; ... }
│   │   │   ├── deploy.types.ts
│   │   │   └── api.types.ts
│   │   │
│   │   ├── components/                  # [UI Components] កូដ UI ដែលប្រើចុះឡើង
│   │   │   ├── common/                  # Button.tsx, Loader.tsx, Modal.tsx
│   │   │   └── layout/                  # Sidebar.tsx, Topbar.tsx
│   │   │
│   │   ├── hooks/                       # [Custom Hooks] សម្រាប់គ្រប់គ្រង Logic ក្នុង React
│   │   │   └── useSystemStats.ts
│   │   │
│   │   ├── pages/                       # [Views] ផ្ទាំងទំព័រនីមួយៗ
│   │   │   ├── Dashboard.tsx
│   │   │   ├── GitDeploy.tsx
│   │   │   ├── Tunnels.tsx
│   │   │   └── TerminalView.tsx
│   │   │
│   │   ├── services/                    # [API Clients] ហៅទិន្នន័យពី FastAPI
│   │   │   └── api.ts                   # Axios ជាមួយ TypeScript Types
│   │   │
│   │   ├── store/                       # [State Management] គ្រប់គ្រង State ក្នុង App (Zustand/Redux)
│   │   │   └── useAppStore.ts
│   │   │
│   │   ├── App.tsx                      # ឯកសារកំណត់ Routes
│   │   ├── main.tsx                     # ឯកសារចម្បងសម្រាប់ Render React
│   │   └── vite-env.d.ts                # ប្រកាស Type សម្រាប់ Vite (Environment Variables)
│   │
│   ├── index.html                       # ឯកសារ HTML ដើម
│   ├── package.json                     # បញ្ជី Library របស់ Node.js
│   ├── tsconfig.json                    # ការកំណត់ TypeScript សម្រាប់ React
│   ├── tsconfig.node.json               # ការកំណត់ TypeScript សម្រាប់ Vite Config
│   ├── vite.config.ts                   # កំណត់ Vite (បញ្ច្រាស API ទៅកាន់ Backend)
│   ├── tailwind.config.js               # ការកំណត់ Tailwind CSS
│   └── Dockerfile                       # សម្រាប់ Build Frontend Image
│
├── .gitignore                           # កំណត់ File មិនឱ្យ Push ចូល Git
├── docker-compose.yml                   # សម្រាប់ Run DB, Backend, និង Frontend ក្នុងពេលតែមួយ
└── README.md                            # ឯកសារណែនាំពីរបៀបដំឡើង (Setup Guide)