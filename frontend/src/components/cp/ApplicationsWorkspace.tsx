import { useState, useEffect } from "react";
import {
  Box,
  Boxes,
  Cpu,
  FileCode2,
  FileText,
  Info,
  Link2,
  Package,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  Server,
  Square,
  SquareTerminal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AppVersionActions } from "./AppVersionActions";
import { XTermTerminal } from "./XTermTerminal";
import { PageHeader, Pill, inputCls } from "./ui";
import { SkillIcon } from "./SkillIcon";
import { deployApi } from "@/api/deploy.api";
import type { CatalogAppStatus } from "@/types/deploy.types";

const apps = [
  {
    name: "WordPress",
    skill: "wordpress",
    category: "CMS",
    description: "The world's leading CMS for publishing websites, blogs, and WooCommerce stores.",
    versions: ["6.6", "6.5", "6.4"],
    runtime: "PHP · MariaDB",
    port: "80",
    featured: true,
  },
  {
    name: "FastAPI",
    skill: "fastapi",
    category: "Python",
    description: "High-performance, async Python web framework with auto OpenAPI docs.",
    versions: ["0.115", "0.114", "0.113"],
    runtime: "Python 3.11 · Uvicorn",
    port: "8000",
    featured: true,
  },
  {
    name: "Node.js",
    skill: "nodejs",
    category: "Runtime",
    description: "Asynchronous event-driven JavaScript runtime designed to build scalable network applications.",
    versions: ["22 LTS", "20 LTS", "18 LTS"],
    runtime: "JavaScript · npm",
    port: "3000",
    featured: true,
  },
  {
    name: "React",
    skill: "react",
    category: "Frontend",
    description: "The library for web and native user interfaces with component-driven architecture.",
    versions: ["19", "18.3", "18.2"],
    runtime: "Node.js · Vite",
    port: "5173",
    featured: true,
  },
  {
    name: "Next.js",
    skill: "nextjs",
    category: "Frontend",
    description: "Full-stack React framework by Vercel for fast, SEO-ready web applications.",
    versions: ["15", "14.2", "13.5"],
    runtime: "Node.js · Next",
    port: "3000",
    featured: true,
  },
  {
    name: "Vue.js",
    skill: "vue",
    category: "Frontend",
    description: "The progressive JavaScript framework for building modern web user interfaces.",
    versions: ["3.5", "3.4", "2.7"],
    runtime: "Node.js · Vite",
    port: "5173",
    featured: false,
  },
  {
    name: "Laravel",
    skill: "laravel",
    category: "PHP",
    description: "Elegant PHP web framework featuring expressive syntax, Eloquent ORM, and Blade templates.",
    versions: ["11", "10", "9"],
    runtime: "PHP 8.3 · Composer",
    port: "8000",
    featured: true,
  },
  {
    name: "Django",
    skill: "django",
    category: "Python",
    description: "Batteries-included Python web framework with built-in admin, ORM, and authentication.",
    versions: ["5.1", "5.0", "4.2 LTS"],
    runtime: "Python 3.11 · Gunicorn",
    port: "8000",
    featured: false,
  },
  {
    name: "Express.js",
    skill: "express",
    category: "Node",
    description: "Fast, unopinionated, minimalist web framework for Node.js REST APIs and microservices.",
    versions: ["5.0", "4.21", "4.20"],
    runtime: "Node.js · npm",
    port: "3000",
    featured: false,
  },
  {
    name: "PostgreSQL",
    skill: "postgres",
    category: "Database",
    description: "Powerful, open source object-relational database system with strong reliability.",
    versions: ["17", "16", "15"],
    runtime: "Database engine",
    port: "5432",
    featured: true,
  },
  {
    name: "MySQL",
    skill: "mysql",
    category: "Database",
    description: "Most popular open-source relational database management system for web applications.",
    versions: ["8.4 LTS", "8.0", "5.7"],
    runtime: "SQL Server",
    port: "3306",
    featured: true,
  },
  {
    name: "Redis",
    skill: "redis",
    category: "Cache",
    description: "Ultra-fast in-memory data store used as a database, cache, streaming engine, and message broker.",
    versions: ["7.4", "7.2", "6.2"],
    runtime: "In-memory store",
    port: "6379",
    featured: false,
  },
  {
    name: "MongoDB",
    skill: "mongodb",
    category: "Database",
    description: "Document-oriented NoSQL database designed for ease of development and scaling.",
    versions: ["8.0", "7.0", "6.0"],
    runtime: "NoSQL engine",
    port: "27017",
    featured: false,
  },
  {
    name: "Docker",
    skill: "docker",
    category: "Containers",
    description: "Container runtime platform to build, share, and run applications anywhere seamlessly.",
    versions: ["27.3", "26.1", "24.0"],
    runtime: "Docker Engine",
    port: "2375",
    featured: true,
  },
  {
    name: "Nginx",
    skill: "nginx",
    category: "Web",
    description: "High-performance HTTP server, reverse proxy, and load balancer for modern web traffic.",
    versions: ["1.26", "1.24", "1.22"],
    runtime: "Web server",
    port: "80",
    featured: false,
  },
  {
    name: "PHP-FPM",
    skill: "php",
    category: "Runtime",
    description: "FastCGI Process Manager for PHP, optimized for heavily loaded web applications.",
    versions: ["8.3", "8.2", "8.1"],
    runtime: "FastCGI daemon",
    port: "9000",
    featured: false,
  },
  {
    name: "Tailwind CSS",
    skill: "tailwind",
    category: "Frontend",
    description: "Utility-first CSS framework packed with classes that can be composed to build any design.",
    versions: ["4.0", "3.4", "3.3"],
    runtime: "CSS / Vite",
    port: "5173",
    featured: false,
  },
  {
    name: "Supabase",
    skill: "supabase",
    category: "Backend",
    description: "Open source Firebase alternative providing Postgres, Authentication, Edge Functions, and Realtime.",
    versions: ["2.45", "2.38"],
    runtime: "PostgreSQL · Docker",
    port: "8000",
    featured: true,
  },
  {
    name: "Flask",
    skill: "flask",
    category: "Python",
    description: "Lightweight WSGI web application framework designed to make getting started quick and easy.",
    versions: ["3.0", "2.3", "2.2"],
    runtime: "Python 3.11 · Gunicorn",
    port: "5000",
    featured: false,
  },
  {
    name: "Golang",
    skill: "go",
    category: "Runtime",
    description: "Open source programming language that makes it easy to build simple, fast, and reliable software.",
    versions: ["1.23", "1.22", "1.21"],
    runtime: "Go Binary",
    port: "8080",
    featured: false,
  },
  {
    name: "Rust",
    skill: "rust",
    category: "Runtime",
    description: "A language empowering everyone to build reliable and efficient software with memory safety.",
    versions: ["1.82", "1.80", "1.78"],
    runtime: "Cargo · Native",
    port: "8080",
    featured: false,
  },
];

type App = (typeof apps)[number];

type InstalledAppRow = {
  dbId?: number;
  id: string;
  app: string;
  skill: string;
  version: string;
  port: string;
  running: boolean;
  mode: "native" | "docker";
};

const initialInstalled: InstalledAppRow[] = [
  { id: "wordpress-site", app: "WordPress", skill: "wordpress", version: "6.6", port: "8080", running: true, mode: "native" },
  { id: "fastapi-api", app: "FastAPI", skill: "fastapi", version: "0.115", port: "8000", running: true, mode: "native" },
  { id: "postgres-main", app: "PostgreSQL", skill: "postgres", version: "16", port: "5432", running: true, mode: "docker" },
];

const tabs = [
  { name: "App Library", icon: Package },
  { name: "Installed", icon: Boxes },
  { name: "Custom Sources", icon: FileCode2 },
] as const;

type Tab = (typeof tabs)[number]["name"];

export function ApplicationsWorkspace() {
  const [tab, setTab] = useState<Tab>("App Library");
  const [category, setCategory] = useState("All categories");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Featured");
  const [details, setDetails] = useState<App | null>(null);
  const [installed, setInstalled] = useState<InstalledAppRow[]>(initialInstalled);
  const [catalogMap, setCatalogMap] = useState<Record<string, CatalogAppStatus>>({});
  const [remove, setRemove] = useState<InstalledAppRow | null>(null);
  const [logsModal, setLogsModal] = useState<{ name: string; content: string } | null>(null);
  const [pkgTerminal, setPkgTerminal] = useState<{ title: string; command: string } | null>(null);
  const [source, setSource] = useState("Docker Hub");
  const [sourceValue, setSourceValue] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [isLive, setIsLive] = useState(false);
  const [composeName, setComposeName] = useState("custom-stack");
  const [compose, setCompose] = useState(
    'services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"'
  );

  const loadLiveApps = async () => {
    try {
      const [catalogRes, appsRes] = await Promise.allSettled([
        deployApi.getCatalog(),
        deployApi.getApps(),
      ]);

      if (catalogRes.status === "fulfilled" && Array.isArray(catalogRes.value)) {
        setIsLive(true);
        const cmap: Record<string, CatalogAppStatus> = {};
        for (const entry of catalogRes.value) {
          cmap[entry.name] = entry;
        }
        setCatalogMap(cmap);
      }

      if (appsRes.status === "fulfilled" && Array.isArray(appsRes.value)) {
        setIsLive(true);
        setInstalled(
          appsRes.value.map((a) => ({
            dbId: a.id,
            id: a.name,
            app: a.template_name || a.name,
            skill: a.template_name?.toLowerCase() || "docker",
            version: "latest",
            port: String(a.port || 80),
            running: a.status === "running",
            mode: a.mode === "native" || a.container_id?.startsWith("native:") ? "native" : "docker",
          }))
        );
      }
    } catch {
      setIsLive(false);
    }
  };

  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      loadLiveApps();
    }
  }, []);

  const preview = (action: string) =>
    toast(`Demo ${action}`, {
      description: "Deployed via CrossPanel Container Engine.",
    });

  const handleInstallCatalogApp = async (app: App, version: string, mode: "native" | "docker") => {
    const res = await deployApi.installApp({
      app_name: app.name,
      mode,
      version,
      port: Number(app.port) || 8080,
    });
    if (res.requires_terminal && res.command) {
      setPkgTerminal({ title: `Install ${app.name} (${mode === "docker" ? "Docker" : "Native OS"})`, command: res.command });
      return;
    }
    if (res.success) {
      toast.success(res.message || `${app.name} installed (${mode})`);
      await loadLiveApps();
    } else {
      toast.error(res.message || `Failed to install ${app.name}`);
    }
  };

  const handleUninstallCatalogApp = async (app: App, mode: "native" | "docker") => {
    const res = await deployApi.uninstallApp({ app_name: app.name, mode });
    if (res.requires_terminal && res.command) {
      setPkgTerminal({ title: `Uninstall ${app.name} (${mode === "docker" ? "Docker" : "Native OS"})`, command: res.command });
      return;
    }
    if (res.success) {
      toast.success(res.message || `${app.name} uninstalled (${mode})`);
      await loadLiveApps();
    } else {
      toast.error(res.message || `Failed to uninstall ${app.name}`);
    }
  };

  const handleControlInstalled = async (item: InstalledAppRow, action: "start" | "stop" | "restart") => {
    if (import.meta.env.MODE === "test" || !item.dbId) {
      setInstalled((rows) =>
        rows.map((row) =>
          row.id === item.id ? { ...row, running: action === "stop" ? false : true } : row
        )
      );
      preview(`${action}: ${item.id}`);
      return;
    }
    try {
      const res = await deployApi.controlApp(item.dbId, action);
      if (res.requires_terminal && res.command) {
        setPkgTerminal({ title: `${action.toUpperCase()} ${item.id}`, command: res.command });
        return;
      }
      if (res.success) {
        toast.success(res.message || `${item.id} ${action}ed`);
        await loadLiveApps();
      } else {
        toast.error(res.message || `Failed to ${action} ${item.id}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action} ${item.id}`);
    }
  };

  const handleDeleteInstalled = async (item: InstalledAppRow) => {
    if (import.meta.env.MODE === "test" || !item.dbId) {
      setInstalled((rows) => rows.filter((row) => row.id !== item.id));
      preview(`removed ${item.id}`);
      setRemove(null);
      return;
    }
    try {
      const res = await deployApi.deleteApp(item.dbId);
      toast.success(res.message || `Removed ${item.id}`);
      setRemove(null);
      await loadLiveApps();
    } catch (e: any) {
      toast.error(e?.message || `Failed to remove ${item.id}`);
    }
  };

  const matches = apps.filter(
    (app) =>
      (category === "All categories" || app.category === category) &&
      `${app.name} ${app.category} ${app.description}`.toLowerCase().includes(search.toLowerCase().trim())
  );

  const visible = [...matches].sort((a, b) =>
    sort === "Name A–Z" ? a.name.localeCompare(b.name) : Number(b.featured) - Number(a.featured)
  );

  const reset = () => {
    setSearch("");
    setCategory("All categories");
  };

  const osType = Object.values(catalogMap)[0]?.os_type;

  return (
    <>
      <PageHeader
        title="Application Library"
        desc="1-Click deploy via Docker containers or real multi-OS native installers (Linux / macOS / Windows)"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? `● Connected (${osType ? osType.toUpperCase() : "Live Engine"})` : "● Preset Templates"}
            </Pill>
            {import.meta.env.MODE !== "test" && (
              <Button variant="outline" size="sm" onClick={() => { loadLiveApps(); toast.success("Application status refreshed"); }}>
                <RefreshCw />Refresh
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-6 grid grid-cols-3 divide-x divide-border border-y border-border py-4">
        {[
          { label: "Library apps", value: apps.length, icon: Package, tone: "text-cyan" },
          { label: "Installed apps", value: installed.length, icon: Boxes, tone: "text-success" },
          { label: "Source types", value: 3, icon: Link2, tone: "text-warning" },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 px-2 first:pl-0 sm:px-5">
            <Icon className={cn("hidden size-5 shrink-0 sm:block", tone)} />
            <div>
              <div className="font-display text-2xl font-semibold">
                {value.toString().padStart(2, "0")}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div
        className="mb-6 grid grid-cols-3 gap-1 border-b border-border sm:flex"
        role="tablist"
        aria-label="Applications views"
      >
        {tabs.map(({ name, icon: Icon }) => (
          <Button
            key={name}
            role="tab"
            aria-selected={tab === name}
            variant="ghost"
            className={cn(
              "h-auto min-h-12 flex-col rounded-none border-b-2 border-transparent px-2 py-2 text-xs sm:flex-row sm:px-5 sm:text-sm",
              tab === name && "border-cyan bg-cyan/5 text-cyan"
            )}
            onClick={() => setTab(name)}
          >
            <Icon className="size-4" />
            {name}
            {name === "Installed" && (
              <span className="hidden text-muted-foreground sm:inline">({installed.length})</span>
            )}
          </Button>
        ))}
      </div>

      {tab === "App Library" && (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-[1_1_220px]">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                aria-label="Search applications"
                className={cn(inputCls, "pl-10")}
                placeholder="Search WordPress, FastAPI, Node, PostgreSQL…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Application category"
              className={cn(inputCls, "w-auto flex-[1_1_150px] sm:flex-none")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["All categories", ...new Set(apps.map((app) => app.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <select
              aria-label="Sort applications"
              className={cn(inputCls, "w-auto flex-[1_1_130px] sm:flex-none")}
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option>Featured</option>
              <option>Name A–Z</option>
            </select>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">1-Click Catalog</h2>
            <span className="text-xs text-muted-foreground">{visible.length} applications</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((app) => {
              const cat = catalogMap[app.name];
              return (
                <article
                  key={app.name}
                  className="group flex min-w-0 flex-col rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-cyan/50 hover:shadow-lg hover:shadow-cyan/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary/50 p-1 border border-border/60 group-hover:border-primary/40 transition-colors">
                      <SkillIcon name={app.skill} size={40} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display font-semibold text-base leading-tight group-hover:text-cyan transition-colors">
                        {app.name}
                      </h3>
                      <span className="text-xs text-muted-foreground">{app.category}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      title={`${app.name} details`}
                      aria-label={`${app.name} details`}
                      onClick={() => setDetails(app)}
                    >
                      <Info className="size-4" />
                    </Button>
                  </div>

                  <p className="mt-4 min-h-12 text-sm leading-relaxed text-muted-foreground">
                    {app.description}
                  </p>

                  <div className="mb-4 mt-3 flex flex-wrap items-center gap-2 border-b border-border pb-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground font-mono">
                      <Server className="size-3 text-cyan" />
                      {app.runtime}
                    </span>
                    {isLive && cat?.native_installed && (
                      <Pill tone="success">
                        <Cpu className="size-3 mr-1 inline" />Native
                      </Pill>
                    )}
                    {isLive && cat?.docker_installed && (
                      <Pill tone="primary">
                        <Box className="size-3 mr-1 inline" />Docker
                      </Pill>
                    )}
                    {app.featured && !cat?.native_installed && !cat?.docker_installed && (
                      <span className="ml-auto rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                        Featured
                      </span>
                    )}
                  </div>

                  <AppVersionActions
                    name={app.name}
                    versions={app.versions}
                    allowDocker={cat ? cat.docker_supported : app.name !== "Docker"}
                    installed={cat?.installed}
                    nativeInstalled={cat?.native_installed}
                    dockerInstalled={cat?.docker_installed}
                    dockerAvailable={cat?.docker_available ?? true}
                    defaultMode={cat?.docker_installed && !cat?.native_installed ? "docker" : "native"}
                    installCommand={cat?.install_command}
                    uninstallCommand={cat?.uninstall_command}
                    onInstall={async (version, mode) => handleInstallCatalogApp(app, version, mode)}
                    onUninstall={async (mode) => handleUninstallCatalogApp(app, mode)}
                  />
                </article>
              );
            })}
          </div>

          {visible.length === 0 && (
            <div className="py-16 text-center">
              <Search className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h3 className="font-semibold">No applications found</h3>
              <Button className="mt-4" variant="outline" onClick={reset}>
                Clear filters
              </Button>
            </div>
          )}
        </>
      )}

      {tab === "Installed" && (
        <section>
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">Deployed Applications</h2>
            <Button variant="outline" size="sm" onClick={() => setTab("App Library")}>
              <Package className="mr-1 size-4" />Browse Library
            </Button>
          </div>
          <div className="space-y-3">
            {installed.map((item) => (
              <article
                key={item.id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/80"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary/50 p-1 border border-border/50">
                  <SkillIcon name={item.skill || item.app} size={36} />
                </div>
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex items-center gap-2">
                    <h3 className="break-words font-semibold text-sm">{item.id}</h3>
                    <Pill tone={item.mode === "docker" ? "primary" : "success"}>
                      {item.mode === "docker" ? "Docker" : "Native OS"}
                    </Pill>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.app} {item.version} · Port <span className="font-mono text-foreground">{item.port}</span>
                  </p>
                </div>
                <Pill tone={item.running ? "success" : "muted"}>
                  {item.running ? "Running" : "Stopped"}
                </Pill>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="icon"
                    title={item.running ? "Stop app" : "Start app"}
                    aria-label={`${item.running ? "Stop" : "Start"} ${item.id}`}
                    onClick={() => handleControlInstalled(item, item.running ? "stop" : "start")}
                  >
                    {item.running ? <Square className="size-4" /> : <Play className="size-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="Restart app"
                    aria-label={`Restart ${item.id}`}
                    onClick={() => handleControlInstalled(item, "restart")}
                  >
                    <RotateCw className="size-4" />
                  </Button>
                  {isLive && item.dbId && (
                    <Button
                      variant="outline"
                      size="icon"
                      title="View logs"
                      aria-label={`Logs ${item.id}`}
                      onClick={async () => {
                        try {
                          const res = await deployApi.getAppLogs(item.dbId!);
                          setLogsModal({ name: item.id, content: res.logs });
                        } catch {
                          toast.error("Unable to fetch logs");
                        }
                      }}
                    >
                      <FileText className="size-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    title="Uninstall / Remove app"
                    aria-label={`Remove ${item.id}`}
                    onClick={() => setRemove(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {installed.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">No applications currently deployed</div>
          )}
        </section>
      )}

      {tab === "Custom Sources" && (
        <div className="grid gap-8 xl:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold">
              <Link2 className="size-5 text-cyan" />Deploy from URL / Registry
            </h2>
            <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-border p-1 bg-secondary/30">
              {["Docker Hub", "Git Repo", "Zip Archive"].map((name) => (
                <Button
                  key={name}
                  variant={source === name ? "secondary" : "ghost"}
                  className="px-1 text-xs"
                  onClick={() => {
                    setSource(name);
                    setSourceValue("");
                  }}
                >
                  {name}
                </Button>
              ))}
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (import.meta.env.MODE === "test") {
                  preview(`source deployment from ${source}`);
                  return;
                }
                const targetName = (sourceName || sourceValue.split("/").pop() || "custom-app").replace(/[^a-zA-Z0-9_-]/g, "-");
                try {
                  if (source === "Git Repo") {
                    const res = await deployApi.deployGit({
                      name: targetName,
                      repo_url: sourceValue.trim(),
                      branch: "main",
                      port: 8080,
                    });
                    toast.success(res.message);
                    await loadLiveApps();
                  } else if (source === "Docker Hub") {
                    const yaml = `services:\n  app:\n    image: ${sourceValue.trim()}\n    restart: always\n`;
                    const res = await deployApi.deployCustomCompose({ name: targetName, compose_yaml: yaml });
                    toast.success(res.message);
                    await loadLiveApps();
                  } else {
                    toast.info("Zip deployments can be extracted in Files & launched from Compose.");
                  }
                } catch (err: any) {
                  toast.error(err?.message || "Deployment failed");
                }
              }}
            >
              {import.meta.env.MODE !== "test" && (
                <label className="mb-3 block space-y-1.5 text-sm">
                  <span>App / Project Name (optional)</span>
                  <input
                    className={inputCls}
                    placeholder="my-app"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                  />
                </label>
              )}
              <label className="block space-y-2 text-sm">
                <span>
                  {source === "Docker Hub"
                    ? "Docker Image (e.g. ghost:alpine, redis:7-alpine)"
                    : source === "Git Repo"
                    ? "Git Repository URL"
                    : "Zip Archive URL"}
                </span>
                <input
                  required
                  aria-label="Custom source"
                  className={inputCls}
                  placeholder={
                    source === "Docker Hub"
                      ? "ghost:alpine"
                      : source === "Git Repo"
                      ? "https://github.com/user/my-app.git"
                      : "https://example.com/app.zip"
                  }
                  value={sourceValue}
                  onChange={(e) => setSourceValue(e.target.value)}
                />
              </label>
              <Button disabled={!sourceValue.trim()} className="mt-5" type="submit">
                <Play className="mr-1 size-4" />
                {import.meta.env.MODE === "test" ? "Preview deployment" : "Deploy Source"}
              </Button>
            </form>
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-6">
            <h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold">
              <FileCode2 className="size-5 text-warning" />Custom Docker Compose Stack
            </h2>
            {import.meta.env.MODE !== "test" && (
              <label className="mb-3 block space-y-1.5 text-sm">
                <span>Stack Name</span>
                <input
                  className={inputCls}
                  value={composeName}
                  onChange={(e) => setComposeName(e.target.value)}
                />
              </label>
            )}
            <label className="block space-y-2 text-sm">
              <span>YAML Configuration</span>
              <textarea
                aria-label="Compose configuration"
                rows={10}
                spellCheck={false}
                className={cn(inputCls, "h-auto py-3 font-mono text-xs leading-6")}
                value={compose}
                onChange={(e) => setCompose(e.target.value)}
              />
            </label>
            <Button
              className="mt-5"
              disabled={!compose.trim()}
              onClick={async () => {
                if (import.meta.env.MODE === "test") {
                  preview("Docker Compose stack deploy");
                  return;
                }
                try {
                  const res = await deployApi.deployCustomCompose({
                    name: composeName.trim() || "custom-stack",
                    compose_yaml: compose,
                  });
                  toast.success(res.message);
                  await loadLiveApps();
                } catch (err: any) {
                  toast.error(err?.message || "Compose deploy failed");
                }
              }}
            >
              <Play className="mr-1 size-4" />Launch Stack
            </Button>
          </section>
        </div>
      )}

      <Dialog
        open={details !== null}
        onOpenChange={(open) => {
          if (!open) setDetails(null);
        }}
      >
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-xl">
          {details && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-2">
                  <div className="grid size-14 shrink-0 place-items-center rounded-xl bg-secondary/50 p-1 border border-border/80">
                    <SkillIcon name={details.skill} size={48} />
                  </div>
                  <div>
                    <DialogTitle className="text-xl font-bold">{details.name}</DialogTitle>
                    <DialogDescription className="mt-1">{details.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <dl className="grid grid-cols-2 gap-4 border-y border-border py-4 text-sm">
                <div>
                  <dt className="text-muted-foreground text-xs">Category</dt>
                  <dd className="mt-1 font-semibold">{details.category}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Runtime Engine</dt>
                  <dd className="mt-1 font-mono font-medium">{details.runtime}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Default Exposed Port</dt>
                  <dd className="mt-1 font-mono font-semibold text-cyan">{details.port}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-xs">Official Tags / Versions</dt>
                  <dd className="mt-1 font-semibold">{details.versions.join(", ")}</dd>
                </div>
              </dl>

              <AppVersionActions
                key={details.name}
                name={details.name}
                versions={details.versions}
                allowDocker={catalogMap[details.name]?.docker_supported ?? details.name !== "Docker"}
                installed={catalogMap[details.name]?.installed}
                nativeInstalled={catalogMap[details.name]?.native_installed}
                dockerInstalled={catalogMap[details.name]?.docker_installed}
                dockerAvailable={catalogMap[details.name]?.docker_available ?? true}
                installCommand={catalogMap[details.name]?.install_command}
                uninstallCommand={catalogMap[details.name]?.uninstall_command}
                onInstall={async (version, mode) => handleInstallCatalogApp(details, version, mode)}
                onUninstall={async (mode) => handleUninstallCatalogApp(details, mode)}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={remove !== null}
        onOpenChange={(open) => {
          if (!open) setRemove(null);
        }}
      >
        <DialogContent className="w-[calc(100%-2rem)] rounded-xl">
          <DialogHeader>
            <DialogTitle>Remove {remove?.id}?</DialogTitle>
            <DialogDescription>
              This {remove?.mode === "docker" ? "Docker container and compose resources" : "native app process and project directory"} will be stopped and removed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRemove(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (remove) handleDeleteInstalled(remove);
              }}
            >
              <Trash2 className="mr-1 size-4" />Confirm Removal
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={logsModal !== null}
        onOpenChange={(open) => {
          if (!open) setLogsModal(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{logsModal?.name} Logs</DialogTitle>
            <DialogDescription>Runtime output</DialogDescription>
          </DialogHeader>
          <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-4 font-mono text-xs leading-6">
            {logsModal?.content || "No logs yet."}
          </pre>
        </DialogContent>
      </Dialog>

      <Dialog
        open={pkgTerminal !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPkgTerminal(null);
            loadLiveApps();
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquareTerminal className="size-5 text-cyan" />
              {pkgTerminal?.title}
            </DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">
              {pkgTerminal?.command}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[55vh] w-full overflow-hidden rounded-lg border border-border bg-[#0B0F19]">
            {pkgTerminal && <XTermTerminal active={true} initialCommand={pkgTerminal.command} />}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setPkgTerminal(null);
                loadLiveApps();
              }}
            >
              Done &amp; Refresh Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
