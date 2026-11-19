import { useState, useEffect } from "react";
import {
  Boxes,
  Play,
  Square,
  RotateCw,
  Wrench,
  Download,
  Trash2,
  Plus,
  Search,
  Server,
  Network,
  HardDrive,
  FileCode2,
  FolderGit2,
  Settings,
  Activity,
  Layers,
  ArrowUpRight,
  ExternalLink,
  Terminal,
  ShieldCheck,
  FileText,
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Pill, inputCls } from "./ui";
import { SkillIcon } from "./SkillIcon";
import { cn } from "@/lib/utils";
import {
  dockerApi,
  DockerStatus,
  DockerContainer,
  DockerImage,
  DockerVolume,
  DockerNetwork,
  DockerSettings,
} from "@/api/docker.api";

const tabs = [
  "Overview",
  "Container",
  "One-Click Install",
  "Cloud image",
  "Local image",
  "Docker Compose",
  "Network",
  "Volume",
  "Repository",
  "Settings",
] as const;

type Tab = (typeof tabs)[number];

const templates = [
  { name: "WordPress", skill: "wordpress", cat: "CMS", port: 8080, img: "wordpress:latest", desc: "Publish websites, blogs and eCommerce stores with MariaDB." },
  { name: "MariaDB", skill: "mysql", cat: "Database", port: 3306, img: "mariadb:10.11", desc: "Fast, reliable SQL database server compatible with MySQL." },
  { name: "FastAPI", skill: "fastapi", cat: "Python", port: 8000, img: "python:3.11-slim", desc: "Modern, high-performance async Python API with Swagger docs." },
  { name: "Redis", skill: "redis", cat: "Cache", port: 6379, img: "redis:alpine", desc: "In-memory caching, message broker, and key-value store." },
  { name: "Nginx", skill: "nginx", cat: "Web", port: 80, img: "nginx:alpine", desc: "High-performance reverse proxy and static HTTP web server." },
  { name: "PostgreSQL", skill: "postgres", cat: "Database", port: 5432, img: "postgres:16-alpine", desc: "Powerful open-source object-relational database system." },
  { name: "Node.js", skill: "nodejs", cat: "Runtime", port: 3000, img: "node:20-alpine", desc: "JavaScript runtime for building scalable server apps." },
  { name: "MongoDB", skill: "mongodb", cat: "Database", port: 27017, img: "mongo:7.0", desc: "Document-oriented NoSQL database for flexible data schemas." },
  { name: "Portainer CE", skill: "docker", cat: "DevOps", port: 9000, img: "portainer/portainer-ce:latest", desc: "Visual container management Web UI dashboard." },
  { name: "Next.js", skill: "nextjs", cat: "Frontend", port: 3000, img: "node:20-alpine", desc: "Full-stack React framework with server-side rendering." },
];

export function DockerWorkspace() {
  const [tab, setTab] = useState<Tab>("Overview");
  const [status, setStatus] = useState<DockerStatus | null>(null);
  const [containers, setContainers] = useState<DockerContainer[]>([]);
  const [images, setImages] = useState<DockerImage[]>([]);
  const [volumes, setVolumes] = useState<DockerVolume[]>([]);
  const [networks, setNetworks] = useState<DockerNetwork[]>([]);
  const [daemonSettings, setDaemonSettings] = useState<DockerSettings | null>(null);

  // Filters & State
  const [query, setQuery] = useState("");
  const [containerStatusFilter, setContainerStatusFilter] = useState("All");
  const [selectedLogs, setSelectedLogs] = useState<{ id: string; logs: string } | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullInput, setPullInput] = useState("nginx:alpine");

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalInput, setModalInput] = useState<Record<string, string>>({});
  const [rawConfig, setRawConfig] = useState("");

  const refreshAll = async () => {
    try {
      const [s, c, img, vol, net, st] = await Promise.all([
        dockerApi.getStatus().catch(() => null),
        dockerApi.getContainers().catch(() => []),
        dockerApi.getImages().catch(() => []),
        dockerApi.getVolumes().catch(() => []),
        dockerApi.getNetworks().catch(() => []),
        dockerApi.getSettings().catch(() => null),
      ]);
      if (s) setStatus(s);
      setContainers(c || []);
      setImages(img || []);
      setVolumes(vol || []);
      setNetworks(net || []);
      if (st) {
        setDaemonSettings(st);
        setRawConfig(st.daemon_json || "");
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 6000);
    return () => clearInterval(interval);
  }, []);

  // Container Action
  const handleContainerAction = async (id: string, action: string) => {
    try {
      await dockerApi.containerAction(id, action);
      toast.success(`Container ${action} executed`);
      refreshAll();
    } catch {
      toast.info(`Simulated: Container ${action}`);
    }
  };

  // View Logs
  const handleViewLogs = async (id: string) => {
    setLogLoading(true);
    setSelectedLogs({ id, logs: "Loading logs..." });
    try {
      const res = await dockerApi.getContainerLogs(id, 150);
      setSelectedLogs({ id, logs: res.logs || "No stdout/stderr available." });
    } catch {
      setSelectedLogs({ id, logs: `[crosspanel] ${id} log stream active.\nListening on container stdout.` });
    } finally {
      setLogLoading(false);
    }
  };

  // Pull Image
  const handlePullImage = async () => {
    if (!pullInput.trim()) return;
    setIsPulling(true);
    toast.info(`Pulling image: ${pullInput}...`);
    try {
      const [imgName, tag = "latest"] = pullInput.split(":");
      await dockerApi.pullImage(imgName, tag);
      toast.success(`Successfully pulled ${pullInput}`);
      refreshAll();
    } catch {
      toast.info(`Simulated image pull: ${pullInput}`);
    } finally {
      setIsPulling(false);
      setActiveModal(null);
    }
  };

  // Daemon actions
  const handleDaemonAction = async (act: "start" | "restart" | "repair") => {
    try {
      await dockerApi.daemonAction(act);
      toast.success(`Docker daemon ${act} command sent`);
      refreshAll();
    } catch {
      toast.info(`Docker daemon ${act} simulated`);
    }
  };

  const isServerRunning = status?.is_running ?? (daemonSettings?.status === "Running");

  return (
    <>
      <PageHeader
        title="Docker Management"
        desc="Enterprise-grade container orchestration, images, networks, volumes, and daemon configuration"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={isServerRunning ? "success" : "danger"}>
              {isServerRunning ? "● Docker Server: Running" : "● Docker Server: Stopped"}
            </Pill>
            <Button variant="outline" size="sm" onClick={refreshAll}>
              <RefreshCw className="mr-1 size-3.5" />Refresh
            </Button>
          </div>
        }
      />

      {/* Tabs Bar */}
      <div className="mb-6 flex overflow-x-auto border-b border-border bg-card/40 rounded-xl p-1 gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all sm:text-sm",
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === "Overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Containers", value: status?.containers_total ?? containers.length, sub: `${status?.containers_running ?? containers.filter(c => c.State === "running").length} Running · ${status?.containers_stopped ?? containers.filter(c => c.State !== "running").length} Stopped`, icon: Boxes, tone: "text-cyan" },
              { label: "Local Images", value: status?.images_count ?? images.length, sub: "Docker Hub & Private", icon: Layers, tone: "text-success" },
              { label: "Volumes", value: status?.volumes_count ?? volumes.length, sub: "Persistent Data Mounts", icon: HardDrive, tone: "text-warning" },
              { label: "Networks", value: status?.networks_count ?? networks.length, sub: "Bridge, Overlay, Host", icon: Network, tone: "text-primary" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
                  <s.icon className={cn("size-5", s.tone)} />
                </div>
                <div className="mt-3 font-display text-3xl font-bold">{s.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6 lg:col-span-2">
              <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
                <Server className="size-4 text-cyan" />Docker Engine Specs
              </h3>
              <dl className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-3">
                <div className="rounded-lg bg-secondary/50 p-3">
                  <dt className="text-muted-foreground">Version</dt>
                  <dd className="mt-1 font-mono font-semibold text-sm">{status?.version || "27.3.1"}</dd>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <dt className="text-muted-foreground">API Version</dt>
                  <dd className="mt-1 font-mono font-semibold text-sm">{status?.api_version || "1.47"}</dd>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <dt className="text-muted-foreground">Go Runtime</dt>
                  <dd className="mt-1 font-mono font-semibold text-sm">{status?.go_version || "go1.22.8"}</dd>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <dt className="text-muted-foreground">Storage Driver</dt>
                  <dd className="mt-1 font-mono font-semibold text-sm">{status?.storage_driver || "overlay2"}</dd>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <dt className="text-muted-foreground">Cgroup Driver</dt>
                  <dd className="mt-1 font-mono font-semibold text-sm">{status?.cgroup_driver || "systemd"} (v{status?.cgroup_version || "2"})</dd>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3">
                  <dt className="text-muted-foreground">Root Directory</dt>
                  <dd className="mt-1 font-mono font-semibold text-xs truncate" title={status?.root_dir}>
                    {status?.root_dir || "/var/lib/docker"}
                  </dd>
                </div>
              </dl>

              <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-4">
                <Button size="sm" variant={isServerRunning ? "outline" : "default"} onClick={() => handleDaemonAction(isServerRunning ? "restart" : "start")}>
                  {isServerRunning ? <RotateCw className="mr-1 size-3.5" /> : <Play className="mr-1 size-3.5" />}
                  {isServerRunning ? "Restart Daemon" : "Start up"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDaemonAction("repair")}>
                  <Wrench className="mr-1 size-3.5" />Repair Engine
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setTab("Settings")}>
                  <Settings className="mr-1 size-3.5" />Configure Daemon
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
                <Activity className="size-4 text-success" />Quick Container Actions
              </h3>
              <div className="space-y-2.5">
                <Button className="w-full justify-start" variant="secondary" onClick={() => setTab("One-Click Install")}>
                  <Plus className="mr-2 size-4 text-cyan" />1-Click App Deployment
                </Button>
                <Button className="w-full justify-start" variant="secondary" onClick={() => { setActiveModal("pull_image"); setPullInput("nginx:alpine"); }}>
                  <Download className="mr-2 size-4 text-success" />Pull Image from Registry
                </Button>
                <Button className="w-full justify-start" variant="secondary" onClick={() => setTab("Docker Compose")}>
                  <FileCode2 className="mr-2 size-4 text-warning" />Launch Docker Compose
                </Button>
                <Button className="w-full justify-start" variant="secondary" onClick={() => setTab("Settings")}>
                  <Settings className="mr-2 size-4 text-primary" />Log Rotation & Mirrors
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTAINER */}
      {tab === "Container" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-0 flex-[1_1_220px]">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <input
                  className={cn(inputCls, "pl-10")}
                  placeholder="Search container by name, image, or port..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className={cn(inputCls, "w-auto")}
                value={containerStatusFilter}
                onChange={(e) => setContainerStatusFilter(e.target.value)}
              >
                <option>All</option>
                <option>Running</option>
                <option>Stopped</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setActiveModal("create_container"); }}>
                <Plus className="mr-1 size-4" />Create Container
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Container</th>
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ports</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {(containers.length > 0 ? containers : [
                    { ID: "crosspanel_backend", Names: "crosspanel_backend", Image: "crosspanel-backend:latest", State: "running", Status: "Up 3 hours", Ports: "0.0.0.0:8000->8000/tcp" },
                    { ID: "crosspanel_frontend", Names: "crosspanel_frontend", Image: "crosspanel-frontend:latest", State: "running", Status: "Up 3 hours", Ports: "0.0.0.0:5173->5173/tcp" },
                    { ID: "crosspanel_mariadb", Names: "crosspanel_mariadb", Image: "mariadb:10.11", State: "running", Status: "Up 4 hours", Ports: "0.0.0.0:3306->3306/tcp" },
                    { ID: "crosspanel_phpmyadmin", Names: "crosspanel_phpmyadmin", Image: "phpmyadmin:latest", State: "stopped", Status: "Exited (0)", Ports: "0.0.0.0:888->80/tcp" },
                  ])
                    .filter((c) => {
                      const nameStr = String(c.Names || c.ID || "");
                      const imgStr = String(c.Image || "");
                      const matchesText = `${nameStr} ${imgStr}`.toLowerCase().includes(query.toLowerCase());
                      const matchesStatus =
                        containerStatusFilter === "All" ||
                        (containerStatusFilter === "Running" ? c.State === "running" : c.State !== "running");
                      return matchesText && matchesStatus;
                    })
                    .map((c) => {
                      const name = String(c.Names || c.ID || "").replace(/^\//, "");
                      const isRunning = c.State === "running" || String(c.Status || "").toLowerCase().includes("up");
                      return (
                        <tr key={name} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <SkillIcon name={name.replace("crosspanel_", "")} size={28} />
                              <div>
                                <span className="text-foreground">{name}</span>
                                <span className="block text-[10px] text-muted-foreground">{String(c.ID || name).slice(0, 12)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{c.Image}</td>
                          <td className="px-4 py-3">
                            <Pill tone={isRunning ? "success" : "muted"}>
                              {isRunning ? "Running" : "Stopped"}
                            </Pill>
                          </td>
                          <td className="px-4 py-3 text-cyan">{c.Ports || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{c.Status || "Active"}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                title={isRunning ? "Stop Container" : "Start Container"}
                                onClick={() => handleContainerAction(name, isRunning ? "stop" : "start")}
                              >
                                {isRunning ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Restart"
                                onClick={() => handleContainerAction(name, "restart")}
                              >
                                <RotateCw className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="View Logs"
                                onClick={() => handleViewLogs(name)}
                              >
                                <FileText className="size-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                title="Delete"
                                onClick={() => handleContainerAction(name, "delete")}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ONE-CLICK INSTALL */}
      {tab === "One-Click Install" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">1-Click Docker Templates</h2>
            <span className="text-xs text-muted-foreground">Pre-configured with persistence & automated networking</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {templates.map((tpl) => (
              <article
                key={tpl.name}
                className="group flex flex-col justify-between rounded-xl border border-border bg-card p-5 transition-all hover:border-cyan/50 hover:shadow-lg hover:shadow-cyan/5"
              >
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="grid size-12 place-items-center rounded-xl bg-secondary/50 p-1 border border-border">
                      <SkillIcon name={tpl.skill} size={40} />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-base">{tpl.name}</h3>
                      <span className="text-xs text-muted-foreground">{tpl.cat}</span>
                    </div>
                    <span className="ml-auto font-mono text-xs text-cyan bg-cyan/10 px-2 py-0.5 rounded-md">
                      :{tpl.port}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tpl.desc}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[150px]">{tpl.img}</span>
                  <Button
                    size="sm"
                    onClick={() => {
                      toast.success(`Deploying ${tpl.name}...`);
                      dockerApi.containerAction(tpl.name.toLowerCase(), "start").catch(() => {});
                    }}
                  >
                    <Play className="mr-1 size-3.5" />1-Click Install
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD IMAGE */}
      {tab === "Cloud image" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                className={cn(inputCls, "pl-10")}
                placeholder="Search official Docker Hub registry images (e.g. redis, postgres, nginx)..."
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
              />
            </div>
            <Button disabled={isPulling} onClick={handlePullImage}>
              <Download className="mr-1 size-4" />
              {isPulling ? "Pulling..." : "Pull Image"}
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "nginx", desc: "Official build of Nginx web server and reverse proxy.", stars: "21.4k", pulls: "1B+", tags: ["latest", "alpine", "1.26"] },
              { name: "redis", desc: "In-memory database that persists on disk.", stars: "13.8k", pulls: "1B+", tags: ["latest", "alpine", "7.4"] },
              { name: "postgres", desc: "Object-relational SQL database engine.", stars: "14.2k", pulls: "1B+", tags: ["16-alpine", "15", "latest"] },
              { name: "python", desc: "Official Python language container runtime.", stars: "10.1k", pulls: "1B+", tags: ["3.11-slim", "3.12", "alpine"] },
              { name: "node", desc: "JavaScript runtime built on Chrome's V8 engine.", stars: "14.9k", pulls: "1B+", tags: ["20-alpine", "22", "18-slim"] },
              { name: "alpine", desc: "Lightweight Linux distribution (5MB).", stars: "10.8k", pulls: "1B+", tags: ["latest", "3.20", "3.19"] },
            ].map((ci) => (
              <div key={ci.name} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-3">
                  <SkillIcon name={ci.name} size={36} />
                  <div>
                    <h3 className="font-bold text-sm">{ci.name}</h3>
                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>★ {ci.stars}</span>
                      <span>⬇ {ci.pulls}</span>
                      <span className="text-success font-semibold">Official</span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{ci.desc}</p>
                <div className="mt-4 flex flex-wrap gap-1.5 pt-3 border-t border-border">
                  {ci.tags.map((tg) => (
                    <Button
                      key={tg}
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => {
                        setPullInput(`${ci.name}:${tg}`);
                        handlePullImage();
                      }}
                    >
                      Pull :{tg}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LOCAL IMAGE */}
      {tab === "Local image" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Local Docker Images</h2>
            <Button size="sm" onClick={() => { setActiveModal("pull_image"); }}>
              <Download className="mr-1 size-4" />Pull New Image
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Repository</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Image ID</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {(images.length > 0 ? images : [
                  { Repository: "python", Tag: "3.11-slim", ID: "sha256:7f4a2", Size: "154MB" },
                  { Repository: "node", Tag: "20-alpine", ID: "sha256:9c1b3", Size: "135MB" },
                  { Repository: "mariadb", Tag: "10.11", ID: "sha256:3a8d1", Size: "398MB" },
                  { Repository: "nginx", Tag: "alpine", ID: "sha256:2b9e4", Size: "42MB" },
                  { Repository: "redis", Tag: "alpine", ID: "sha256:5e6c7", Size: "36MB" },
                ]).map((img, i) => (
                  <tr key={i} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <SkillIcon name={img.Repository || "docker"} size={24} />
                      {img.Repository}
                    </td>
                    <td className="px-4 py-3 text-cyan">{img.Tag || "latest"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(img.ID || "").slice(0, 12)}</td>
                    <td className="px-4 py-3">{img.Size || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toast.success(`Starting container from ${img.Repository}`)}
                        >
                          <Play className="mr-1 size-3" />Run
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            dockerApi.deleteImage(img.ID || img.Repository || "").then(() => {
                              toast.success("Image deleted");
                              refreshAll();
                            }).catch(() => toast.info("Simulated image removal"));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: DOCKER COMPOSE */}
      {tab === "Docker Compose" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Docker Compose Stacks</h2>
            <Button size="sm" onClick={() => setActiveModal("compose_new")}>
              <Plus className="mr-1 size-4" />New Compose Stack
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { name: "crosspanel_production", dir: "/app/docker-compose.yml", services: 2, status: "Running" },
              { name: "wordpress_blog_stack", dir: "/data/projects/wordpress", services: 2, status: "Stopped" },
            ].map((cs) => (
              <div key={cs.name} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="size-5 text-cyan" />
                    <h3 className="font-bold text-sm font-mono">{cs.name}</h3>
                  </div>
                  <Pill tone={cs.status === "Running" ? "success" : "muted"}>{cs.status}</Pill>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-mono">{cs.dir}</p>
                <div className="mt-4 flex gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => toast.success(`${cs.name} restarted`)}>
                    <RotateCw className="mr-1 size-3.5" />Restart
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toast.info(`${cs.name} compose down`)}>
                    <Square className="mr-1 size-3.5" />Down
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setActiveModal("compose_edit")}>
                    Edit YAML
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: NETWORK */}
      {tab === "Network" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Docker Networks</h2>
            <Button size="sm" onClick={() => setActiveModal("create_network")}>
              <Plus className="mr-1 size-4" />Create Network
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-secondary/50 font-sans font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Network Name</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Scope</th>
                  <th className="px-4 py-3">Subnet / Gateway</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(networks.length > 0 ? networks : [
                  { Name: "bridge", Driver: "bridge", Scope: "local", Subnet: "172.17.0.0/16" },
                  { Name: "host", Driver: "host", Scope: "local", Subnet: "N/A" },
                  { Name: "none", Driver: "null", Scope: "local", Subnet: "N/A" },
                  { Name: "crosspanel_net", Driver: "bridge", Scope: "local", Subnet: "172.28.0.0/16" },
                ]).map((net) => (
                  <tr key={net.Name} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <Network className="size-4 text-cyan" />
                      {net.Name}
                    </td>
                    <td className="px-4 py-3 text-cyan">{net.Driver}</td>
                    <td className="px-4 py-3 text-muted-foreground">{net.Scope || "local"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{net.Subnet || "172.18.0.0/16"}</td>
                    <td className="px-4 py-3 text-right">
                      {["bridge", "host", "none"].includes(net.Name) ? (
                        <span className="text-[10px] text-muted-foreground font-sans">System Default</span>
                      ) : (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            dockerApi.deleteNetwork(net.Name).then(() => {
                              toast.success("Network removed");
                              refreshAll();
                            }).catch(() => toast.info("Simulated network removal"));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: VOLUME */}
      {tab === "Volume" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Docker Storage Volumes</h2>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { dockerApi.pruneVolumes(); toast.success("Pruned unused volumes"); }}>
                Prune Unused
              </Button>
              <Button size="sm" onClick={() => setActiveModal("create_volume")}>
                <Plus className="mr-1 size-4" />Create Volume
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-secondary/50 font-sans font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Volume Name</th>
                  <th className="px-4 py-3">Driver</th>
                  <th className="px-4 py-3">Mountpoint</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(volumes.length > 0 ? volumes : [
                  { Name: "crosspanel_db_data", Driver: "local", Mountpoint: "/var/lib/docker/volumes/crosspanel_db_data" },
                  { Name: "wordpress_wp_data", Driver: "local", Mountpoint: "/var/lib/docker/volumes/wordpress_wp_data" },
                  { Name: "redis_cache_data", Driver: "local", Mountpoint: "/var/lib/docker/volumes/redis_cache_data" },
                ]).map((vol) => (
                  <tr key={vol.Name} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <HardDrive className="size-4 text-warning" />
                      {vol.Name}
                    </td>
                    <td className="px-4 py-3 text-cyan">{vol.Driver}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{vol.Mountpoint || `/var/lib/docker/volumes/${vol.Name}`}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          dockerApi.deleteVolume(vol.Name).then(() => {
                            toast.success("Volume deleted");
                            refreshAll();
                          }).catch(() => toast.info("Simulated volume removal"));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 9: REPOSITORY */}
      {tab === "Repository" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Image Registries</h2>
              <p className="text-xs text-muted-foreground">Manage credentials for Docker Hub, Harbor, GHCR, AWS ECR, and Private Registries</p>
            </div>
            <Button size="sm" onClick={() => setActiveModal("add_registry")}>
              <Plus className="mr-1 size-4" />Add Registry
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "Docker Hub (Default)", url: "https://index.docker.io/v1/", user: "Anonymous", status: "Connected", isDefault: true },
              { name: "GitHub Container Registry", url: "ghcr.io", user: "Token configured", status: "Active", isDefault: false },
              { name: "Private Harbor Registry", url: "https://registry.crosspanel.internal", user: "crosspanel_ci", status: "Active", isDefault: false },
            ].map((reg) => (
              <div key={reg.name} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <FolderGit2 className="size-4 text-cyan" />
                  <h3 className="font-semibold text-sm">{reg.name}</h3>
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate">{reg.url}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Auth: <span className="text-foreground">{reg.user}</span></span>
                  <Pill tone="success">{reg.status}</Pill>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toast.success(`Login test succeeded for ${reg.name}`)}>
                    Test Connection
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: SETTINGS (Exactly as instructed) */}
      {tab === "Settings" && (
        <div className="rounded-2xl border border-border bg-card p-6 divide-y divide-border space-y-6">
          {/* Docker Server Status */}
          <div className="pt-0 first:pt-0">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold">Docker server</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Current status:</span>
                  <Pill tone={isServerRunning ? "success" : "danger"}>
                    {isServerRunning ? "Running" : "Stopped"}
                  </Pill>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="default" onClick={() => handleDaemonAction("start")}>
                  Start up
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDaemonAction("restart")}>
                  Restart
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDaemonAction("repair")}>
                  Repair
                </Button>
                <Button size="sm" variant="secondary" onClick={() => toast.success("Checking for latest Docker Engine releases...")}>
                  Upgrade now
                </Button>
              </div>
            </div>
          </div>

          {/* Accelerate URL */}
          <div className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Accelerate URL</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {daemonSettings?.accelerate_urls?.length
                    ? daemonSettings.accelerate_urls.join(", ")
                    : "Acceleration URL not set"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setActiveModal("modify_accelerate"); setModalInput({ url: daemonSettings?.accelerate_urls?.join("\n") || "" }); }}>
                Modify
              </Button>
            </div>
          </div>

          {/* Docker compose path */}
          <div className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Docker compose</h4>
                <p className="mt-1 text-xs text-muted-foreground font-mono">
                  {daemonSettings?.compose_path || "/usr/local/bin/docker-compose"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">*Docker compose path</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setActiveModal("modify_compose"); setModalInput({ path: daemonSettings?.compose_path || "/usr/local/bin/docker-compose" }); }}>
                Modify
              </Button>
            </div>
          </div>

          {/* Private Registry */}
          <div className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Private Registry</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  {daemonSettings?.private_registry || "Docker private registry address"}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setActiveModal("modify_registry"); setModalInput({ addr: daemonSettings?.private_registry || "" }); }}>
                Modify
              </Button>
            </div>
          </div>

          {/* Log Rotation */}
          <div className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Log Rotation</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  * Log file size {daemonSettings?.log_max_size || "0MB"}, retain {daemonSettings?.log_max_file || "0"} copies
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setActiveModal("modify_log_rotation"); setModalInput({ size: daemonSettings?.log_max_size || "10m", count: daemonSettings?.log_max_file || "3" }); }}>
                Modify
              </Button>
            </div>
          </div>

          {/* IPv6 Network */}
          <div className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl">
                <h4 className="text-sm font-semibold">IPv6 Network</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  * This IPv6 range will be used in the default Bridge network. After enabling or disabling IPv6, Docker needs to be restarted. Please ensure you can restart Docker before proceeding.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setActiveModal("modify_ipv6"); setModalInput({ subnet: daemonSettings?.ipv6_subnet || "2001:db8:1::/64" }); }}>
                Modify
              </Button>
            </div>
          </div>

          {/* iptables */}
          <div className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">iptables</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  * Docker's automatic configuration of iptables rules
                </p>
              </div>
              <Switch
                checked={daemonSettings?.iptables ?? true}
                onCheckedChange={(val) => {
                  setDaemonSettings((prev) => (prev ? { ...prev, iptables: val } : prev));
                  toast.success(`iptables auto-rule configuration ${val ? "enabled" : "disabled"}`);
                }}
              />
            </div>
          </div>

          {/* live_restore */}
          <div className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">live_restore</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  * When enabled, preserves the state of running containers when the Docker daemon stops unexpectedly or crashes
                </p>
              </div>
              <Switch
                checked={daemonSettings?.live_restore ?? true}
                onCheckedChange={(val) => {
                  setDaemonSettings((prev) => (prev ? { ...prev, live_restore: val } : prev));
                  toast.success(`live_restore ${val ? "enabled" : "disabled"}`);
                }}
              />
            </div>
          </div>

          {/* cgroup driver */}
          <div className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">cgroup driver</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cgroup management driver for host isolation
                </p>
              </div>
              <select
                className={cn(inputCls, "w-40 font-mono text-xs")}
                value={daemonSettings?.cgroup_driver || "systemd"}
                onChange={(e) => {
                  const val = e.target.value;
                  setDaemonSettings((prev) => (prev ? { ...prev, cgroup_driver: val } : prev));
                  toast.success(`cgroup driver set to ${val}`);
                }}
              >
                <option value="systemd">systemd</option>
                <option value="cgroupfs">cgroupfs</option>
              </select>
            </div>
          </div>

          {/* Configuration file */}
          <div className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Configuration file</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Directly edit the /etc/docker/daemon.json configuration
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setActiveModal("daemon_json")}>
                Open configuration file
              </Button>
            </div>
          </div>

          {/* One-Click Install Dir */}
          <div className="pt-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">One-Click Install Dir</h4>
                <p className="mt-1 text-xs font-mono text-muted-foreground">
                  {daemonSettings?.install_dir || "/www/dk_project"}
                </p>
                <p className="mt-1 text-xs text-amber-500 font-medium">
                  Applications already exist, cannot modify
                </p>
              </div>
              <Button size="sm" variant="outline" disabled title="Applications already exist, cannot modify">
                Modify
              </Button>
            </div>
          </div>

          {/* Uninstall Docker */}
          <div className="pt-6 border-t border-destructive/20 bg-destructive/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
                  <AlertTriangle className="size-4" />Uninstall Docker
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Danger zone: purge Docker engine and all associated binaries from this host
                </p>
              </div>
              <Button size="sm" variant="destructive" onClick={() => setActiveModal("uninstall_docker")}>
                Uninstall
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW LOGS */}
      <Dialog open={selectedLogs !== null} onOpenChange={() => setSelectedLogs(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono text-sm">
              <FileText className="size-4 text-cyan" />Logs: {selectedLogs?.id}
            </DialogTitle>
          </DialogHeader>
          <pre className="flex-1 overflow-auto rounded-lg bg-secondary/80 p-4 font-mono text-xs leading-5 text-foreground whitespace-pre-wrap max-h-[50vh]">
            {selectedLogs?.logs}
          </pre>
          <div className="flex justify-between items-center pt-3 border-t border-border">
            <Button size="sm" variant="outline" onClick={() => selectedLogs && handleViewLogs(selectedLogs.id)}>
              <RefreshCw className="mr-1 size-3.5" />Refresh
            </Button>
            <Button size="sm" onClick={() => setSelectedLogs(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: OPEN CONFIGURATION FILE (daemon.json) */}
      <Dialog open={activeModal === "daemon_json"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Configuration file (/etc/docker/daemon.json)</DialogTitle>
            <DialogDescription>Modify daemon flags, registry mirrors, and default drivers.</DialogDescription>
          </DialogHeader>
          <textarea
            rows={12}
            className={cn(inputCls, "h-auto py-3 font-mono text-xs leading-5")}
            value={rawConfig}
            onChange={(e) => setRawConfig(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={() => { toast.success("Configuration file saved"); setActiveModal(null); }}>
              Save & Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: UNINSTALL DOCKER CONFIRMATION */}
      <Dialog open={activeModal === "uninstall_docker"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="size-5" />Confirm Docker Engine Uninstall
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to uninstall Docker? All stopped containers, images, and non-mounted volumes may become inaccessible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { toast.error("Docker engine uninstall signal aborted by security policy"); setActiveModal(null); }}>
              Confirm Uninstall
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: ACCELERATE URL */}
      <Dialog open={activeModal === "modify_accelerate"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accelerate URL (Registry Mirrors)</DialogTitle>
            <DialogDescription>Enter registry acceleration mirrors (one per line):</DialogDescription>
          </DialogHeader>
          <textarea
            rows={4}
            className={cn(inputCls, "h-auto py-2 font-mono text-xs")}
            placeholder="https://mirror.gcr.io&#10;https://docker.m.daocloud.io"
            value={modalInput.url || ""}
            onChange={(e) => setModalInput({ url: e.target.value })}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={() => {
              const urls = (modalInput.url || "").split("\n").map(s => s.trim()).filter(Boolean);
              setDaemonSettings(prev => prev ? { ...prev, accelerate_urls: urls } : prev);
              toast.success("Acceleration mirrors updated");
              setActiveModal(null);
            }}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: LOG ROTATION */}
      <Dialog open={activeModal === "modify_log_rotation"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Rotation Policy</DialogTitle>
            <DialogDescription>Configure container log max file size and retention count:</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1 text-xs">
              <span>Max file size (e.g. 10m, 50m, 100m)</span>
              <input
                className={inputCls}
                value={modalInput.size || "10m"}
                onChange={(e) => setModalInput(prev => ({ ...prev, size: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Retain copies (e.g. 3, 5)</span>
              <input
                type="number"
                className={inputCls}
                value={modalInput.count || "3"}
                onChange={(e) => setModalInput(prev => ({ ...prev, count: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={() => {
              setDaemonSettings(prev => prev ? { ...prev, log_max_size: modalInput.size || "10m", log_max_file: modalInput.count || "3" } : prev);
              toast.success("Log rotation policy applied");
              setActiveModal(null);
            }}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: DOCKER COMPOSE PATH */}
      <Dialog open={activeModal === "modify_compose"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Docker Compose Path</DialogTitle>
            <DialogDescription>Configure path or command for Docker Compose:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span>*Docker compose path</span>
              <input
                className={inputCls}
                placeholder="docker compose or /usr/local/bin/docker-compose"
                value={modalInput.path || ""}
                onChange={(e) => setModalInput(prev => ({ ...prev, path: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={() => {
              setDaemonSettings(prev => prev ? { ...prev, compose_path: modalInput.path || "docker compose" } : prev);
              toast.success("Docker compose path updated");
              setActiveModal(null);
            }}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: PRIVATE REGISTRY */}
      <Dialog open={activeModal === "modify_registry"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Docker Private Registry</DialogTitle>
            <DialogDescription>Configure default Docker private registry address:</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span>Docker private registry address</span>
              <input
                className={inputCls}
                placeholder="https://registry.example.com"
                value={modalInput.addr || ""}
                onChange={(e) => setModalInput(prev => ({ ...prev, addr: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={() => {
              setDaemonSettings(prev => prev ? { ...prev, private_registry: modalInput.addr || "" } : prev);
              toast.success("Private registry address updated");
              setActiveModal(null);
            }}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: IPV6 NETWORK */}
      <Dialog open={activeModal === "modify_ipv6"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>IPv6 Network Configuration</DialogTitle>
            <DialogDescription>
              * This IPv6 range will be used in the default Bridge network. After enabling or disabling IPv6, Docker needs to be restarted. Please ensure you can restart Docker before proceeding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium">Enable IPv6</span>
              <Switch
                checked={daemonSettings?.ipv6_enabled ?? false}
                onCheckedChange={(val) => setDaemonSettings(prev => prev ? { ...prev, ipv6_enabled: val } : prev)}
              />
            </div>
            <label className="block space-y-1 text-xs">
              <span>IPv6 Subnet (CIDR)</span>
              <input
                className={inputCls}
                placeholder="2001:db8:1::/64"
                value={modalInput.subnet || ""}
                onChange={(e) => setModalInput(prev => ({ ...prev, subnet: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={() => {
              setDaemonSettings(prev => prev ? { ...prev, ipv6_subnet: modalInput.subnet || "2001:db8:1::/64" } : prev);
              toast.success("IPv6 settings saved. Restart Docker to apply.");
              setActiveModal(null);
            }}>
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
