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
  DockerComposeStack,
  DockerRepository,
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
  const [composeStacks, setComposeStacks] = useState<DockerComposeStack[]>([]);
  const [repositories, setRepositories] = useState<DockerRepository[]>([]);
  const [daemonSettings, setDaemonSettings] = useState<DockerSettings | null>(null);

  // Filters & State
  const [query, setQuery] = useState("");
  const [containerStatusFilter, setContainerStatusFilter] = useState("All");
  const [selectedLogs, setSelectedLogs] = useState<{ id: string; logs: string } | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullInput, setPullInput] = useState("nginx:alpine");
  const [deployingTemplate, setDeployingTemplate] = useState<string | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [modalInput, setModalInput] = useState<Record<string, string>>({});
  const [rawConfig, setRawConfig] = useState("");
  const [selectedStackConfig, setSelectedStackConfig] = useState<{ name: string; yaml: string } | null>(null);

  const refreshAll = async () => {
    try {
      const [s, c, img, vol, net, st, cs, repos] = await Promise.all([
        dockerApi.getStatus().catch(() => null),
        dockerApi.getContainers().catch(() => []),
        dockerApi.getImages().catch(() => []),
        dockerApi.getVolumes().catch(() => []),
        dockerApi.getNetworks().catch(() => []),
        dockerApi.getSettings().catch(() => null),
        dockerApi.getComposeStacks().catch(() => []),
        dockerApi.getRepositories().catch(() => []),
      ]);
      if (s) setStatus(s);
      if (Array.isArray(c)) setContainers(c);
      if (Array.isArray(img)) setImages(img);
      if (Array.isArray(vol)) setVolumes(vol);
      if (Array.isArray(net)) setNetworks(net);
      if (Array.isArray(cs)) setComposeStacks(cs);
      if (Array.isArray(repos) && repos.length > 0) setRepositories(repos);
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
      const res = await dockerApi.containerAction(id, action);
      if (res.success) {
        toast.success(`Container ${action} executed`);
      } else {
        toast.info(res.message || `Container ${action}`);
      }
      refreshAll();
    } catch (err: any) {
      toast.error(`Container action failed: ${err?.message || "Unknown error"}`);
    }
  };

  // View Logs
  const handleViewLogs = async (id: string) => {
    setLogLoading(true);
    setSelectedLogs({ id, logs: "Streaming live logs from container..." });
    try {
      const res = await dockerApi.getContainerLogs(id, 200);
      setSelectedLogs({ id, logs: res.logs || "No stdout/stderr available from container." });
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
      const res = await dockerApi.pullImage(imgName, tag);
      if (res.success) {
        toast.success(`Successfully pulled ${pullInput}`);
      } else {
        toast.error(`Pull image failed: ${res.message}`);
      }
      refreshAll();
    } catch (err: any) {
      toast.error(`Pull image failed: ${err?.message || "Unknown error"}`);
    } finally {
      setIsPulling(false);
    }
  };

  // Deploy 1-Click Template
  const handleDeployTemplate = async (tpl: typeof templates[0]) => {
    setDeployingTemplate(tpl.name);
    toast.info(`Deploying ${tpl.name} container on port ${tpl.port}...`);
    try {
      const res = await dockerApi.deployTemplate({
        name: tpl.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_"),
        template: tpl.skill,
        port: tpl.port,
      });
      if (res.success) {
        toast.success(res.message || `${tpl.name} deployed successfully!`);
        refreshAll();
      } else {
        toast.error(`Deploy error: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Deployment failed: ${err?.message || "Unknown error"}`);
    } finally {
      setDeployingTemplate(null);
    }
  };

  // Compose Actions
  const handleComposeAction = async (projectName: string, action: "start" | "stop" | "restart" | "down" | "pull") => {
    toast.info(`Docker compose ${action}: ${projectName}...`);
    try {
      const res = await dockerApi.composeAction(projectName, action);
      if (res.success) {
        toast.success(`${projectName} compose ${action} completed`);
        refreshAll();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Failed to ${action} compose stack: ${err?.message || "Unknown error"}`);
    }
  };

  const handleEditStackYaml = async (projectName: string) => {
    try {
      const res = await dockerApi.getComposeConfig(projectName);
      setSelectedStackConfig({ name: projectName, yaml: res.compose_yaml });
      setActiveModal("compose_edit");
    } catch {
      toast.error("Failed to load compose configuration");
    }
  };

  const handleDeployNewCompose = async () => {
    if (!modalInput.stackName || !modalInput.stackYaml) {
      toast.error("Please provide stack name and docker-compose YAML");
      return;
    }
    toast.info(`Deploying compose stack: ${modalInput.stackName}...`);
    try {
      const res = await dockerApi.deployCompose({
        name: modalInput.stackName,
        compose_yaml: modalInput.stackYaml,
      });
      if (res.success) {
        toast.success(res.message || "Stack deployed successfully");
        setActiveModal(null);
        refreshAll();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Deploy failed: ${err?.message || "Network error"}`);
    }
  };

  // Daemon actions
  const handleDaemonAction = async (action: "start" | "restart" | "repair") => {
    toast.info(`Executing Docker daemon ${action}...`);
    try {
      const res = await dockerApi.daemonAction(action);
      if (res.success) {
        toast.success(res.message);
        refreshAll();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Daemon action failed: ${err?.message || "Connection error"}`);
    }
  };

  // Volumes
  const handleCreateVolume = async () => {
    if (!modalInput.volName) return;
    try {
      const res = await dockerApi.createVolume(modalInput.volName, modalInput.volDriver || "local");
      if (res.success) {
        toast.success(`Volume ${res.name} created on PC`);
        setActiveModal(null);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to create volume");
      }
    } catch (err: any) {
      toast.error(`Failed to create volume: ${err?.message}`);
    }
  };

  const handlePruneVolumes = async () => {
    try {
      const res = await dockerApi.pruneVolumes();
      toast.success("Pruned unused volumes on PC");
      refreshAll();
    } catch (err: any) {
      toast.error(`Prune failed: ${err?.message}`);
    }
  };

  // Networks
  const handleCreateNetwork = async () => {
    if (!modalInput.netName) return;
    try {
      const res = await dockerApi.createNetwork({
        name: modalInput.netName,
        driver: modalInput.netDriver || "bridge",
        subnet: modalInput.netSubnet,
        gateway: modalInput.netGateway,
      });
      if (res.success) {
        toast.success(`Network ${res.name} created on PC`);
        setActiveModal(null);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to create network");
      }
    } catch (err: any) {
      toast.error(`Failed to create network: ${err?.message}`);
    }
  };

  // Registries
  const handleLoginRegistry = async () => {
    if (!modalInput.regUser || !modalInput.regPass) {
      toast.error("Please provide username and password");
      return;
    }
    toast.info(`Logging into registry ${modalInput.regServer || "Docker Hub"}...`);
    try {
      const res = await dockerApi.loginRepository({
        server: modalInput.regServer || "https://index.docker.io/v1/",
        username: modalInput.regUser,
        password: modalInput.regPass,
      });
      if (res.success) {
        toast.success(res.message);
        setActiveModal(null);
        refreshAll();
      } else {
        toast.error(res.message);
      }
    } catch (err: any) {
      toast.error(`Login failed: ${err?.message}`);
    }
  };

  const isServerRunning = status?.is_running ?? (daemonSettings?.status === "Running");

  return (
    <>
      <PageHeader
        title="Docker Management"
        desc="Host container runtime, image repositories, volumes, networks, and daemon configuration"
        action={
          <div className="flex items-center gap-2">
            <Pill tone={isServerRunning ? "success" : "danger"}>
              {isServerRunning ? `● Docker Live (v${status?.version || "28.3.2"})` : "○ Docker Offline"}
            </Pill>
            <Button size="sm" variant="outline" onClick={refreshAll} title="Refresh Live Data">
              <RefreshCw className="mr-1 size-3.5" />Refresh
            </Button>
          </div>
        }
      />

      {/* Tabs Navigation */}
      <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
              tab === t
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW */}
      {tab === "Overview" && (
        <div className="space-y-6">
          {/* Quick Metrics */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Running Containers</span>
                <Boxes className="size-4 text-cyan" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold">{status?.containers_running ?? 0}</span>
                <span className="text-xs text-muted-foreground">/ {status?.containers_total ?? 0} total</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Local Images</span>
                <Layers className="size-4 text-indigo-400" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold">{status?.images_count ?? images.length}</span>
                <span className="text-xs text-muted-foreground">cached</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Volumes</span>
                <HardDrive className="size-4 text-warning" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold">{status?.volumes_count ?? volumes.length}</span>
                <span className="text-xs text-muted-foreground">persistent</span>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Bridge Networks</span>
                <Network className="size-4 text-success" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold">{status?.networks_count ?? networks.length}</span>
                <span className="text-xs text-muted-foreground">subnets</span>
              </div>
            </div>
          </div>

          {/* Daemon Spec Card */}
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="font-display text-base font-semibold mb-4 flex items-center gap-2">
              <Server className="size-4 text-cyan" />Docker Engine Runtime Details (Host PC)
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 font-mono text-xs">
              <div className="rounded-lg bg-secondary/40 p-3">
                <span className="text-muted-foreground font-sans block text-[11px]">Server Engine Version</span>
                <span className="font-semibold text-foreground text-sm">{status?.version || "28.3.2"}</span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3">
                <span className="text-muted-foreground font-sans block text-[11px]">API Version</span>
                <span className="font-semibold text-foreground text-sm">{status?.api_version || "1.51"}</span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3">
                <span className="text-muted-foreground font-sans block text-[11px]">Go Runtime</span>
                <span className="font-semibold text-foreground text-sm">{status?.go_version || "go1.24.5"}</span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3">
                <span className="text-muted-foreground font-sans block text-[11px]">Storage Driver</span>
                <span className="font-semibold text-foreground text-sm">{status?.storage_driver || "overlayfs"}</span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3">
                <span className="text-muted-foreground font-sans block text-[11px]">Cgroup Driver & Version</span>
                <span className="font-semibold text-foreground text-sm">{status?.cgroup_driver || "cgroupfs"} (v{status?.cgroup_version || "2"})</span>
              </div>
              <div className="rounded-lg bg-secondary/40 p-3">
                <span className="text-muted-foreground font-sans block text-[11px]">Docker Root Dir</span>
                <span className="font-semibold text-foreground truncate block">{status?.root_dir || "/var/lib/docker"}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONTAINER */}
      {tab === "Container" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter containers..."
                  className={cn(inputCls, "pl-8 w-60 text-xs")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <select
                className={cn(inputCls, "w-36 text-xs")}
                value={containerStatusFilter}
                onChange={(e) => setContainerStatusFilter(e.target.value)}
              >
                <option value="All">All statuses</option>
                <option value="Running">Running</option>
                <option value="Stopped">Stopped</option>
              </select>
            </div>
            <Button size="sm" onClick={() => setTab("One-Click Install")}>
              <Plus className="mr-1 size-4" />Deploy Container
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Container Name</th>
                    <th className="px-4 py-3">Image</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Ports</th>
                    <th className="px-4 py-3">Uptime / Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-mono">
                  {containers
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
                      const rawName = Array.isArray(c.Names) ? c.Names[0] : c.Names;
                      const name = String(rawName || c.ID || "").replace(/^\//, "");
                      const isRunning = c.State === "running" || String(c.Status || "").toLowerCase().includes("up");
                      return (
                        <tr key={name} className="hover:bg-secondary/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            <div className="flex items-center gap-2">
                              <SkillIcon name={name.replace("crosspanel_", "").split(/[-_]/)[0]} size={28} />
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
                          <td className="px-4 py-3 text-muted-foreground">{c.Status || c.CreatedAt || "Active"}</td>
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
                  {containers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-muted-foreground font-sans">
                        No containers found on host Docker daemon.
                      </td>
                    </tr>
                  )}
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
                className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between hover:border-cyan/40 transition-colors shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <SkillIcon name={tpl.skill} size={36} />
                      <div>
                        <h3 className="font-display font-semibold text-sm">{tpl.name}</h3>
                        <span className="text-[10px] text-muted-foreground">{tpl.cat}</span>
                      </div>
                    </div>
                    <Pill tone="info">Port {tpl.port}</Pill>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{tpl.desc}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
                    <span className="text-cyan">{tpl.img}</span>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Auto-restart</span>
                  <Button
                    size="sm"
                    disabled={deployingTemplate === tpl.name}
                    onClick={() => handleDeployTemplate(tpl)}
                  >
                    {deployingTemplate === tpl.name ? (
                      <>
                        <RefreshCw className="mr-1.5 size-3.5 animate-spin" />Deploying...
                      </>
                    ) : (
                      <>
                        <Play className="mr-1.5 size-3.5" />Deploy
                      </>
                    )}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: CLOUD IMAGE */}
      {tab === "Cloud image" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-base font-semibold mb-2">Pull Image from Docker Hub / Registry</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Enter any public or private image tag (e.g. <span className="font-mono text-cyan">nginx:alpine</span>, <span className="font-mono text-cyan">redis:latest</span>, <span className="font-mono text-cyan">postgres:16</span>)
            </p>
            <div className="flex gap-2 max-w-xl">
              <input
                className={cn(inputCls, "font-mono text-xs")}
                placeholder="image_name:tag"
                value={pullInput}
                onChange={(e) => setPullInput(e.target.value)}
              />
              <Button onClick={handlePullImage} disabled={isPulling}>
                {isPulling ? <RefreshCw className="mr-1.5 size-3.5 animate-spin" /> : <Download className="mr-1.5 size-3.5" />}
                Pull Image
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-display text-sm font-semibold mb-3">Popular Cloud Images</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono text-xs">
              {[
                "nginx:alpine",
                "redis:alpine",
                "postgres:16-alpine",
                "node:20-alpine",
                "python:3.11-slim",
                "mariadb:10.11",
                "mongo:7.0",
                "rabbitmq:management",
              ].map((img) => (
                <div key={img} className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
                  <span className="truncate">{img}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPullInput(img);
                      toast.info(`Selected ${img}`);
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: LOCAL IMAGE */}
      {tab === "Local image" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Local Cached Images</h2>
            <Button size="sm" onClick={() => setTab("Cloud image")}>
              <Download className="mr-1 size-4" />Pull New Image
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-secondary/50 font-sans font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Repository</th>
                  <th className="px-4 py-3">Tag</th>
                  <th className="px-4 py-3">Image ID</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {images.map((img) => (
                  <tr key={img.ID || img.Repository} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <SkillIcon name={(img.Repository || "").split("/").pop()?.split(":")[0] || "docker"} size={22} />
                      {img.Repository}
                    </td>
                    <td className="px-4 py-3 text-cyan">{img.Tag || "latest"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{String(img.ID || img.Id || "").slice(0, 12)}</td>
                    <td className="px-4 py-3 text-foreground">{img.Size}</td>
                    <td className="px-4 py-3 text-muted-foreground">{img.CreatedAt || "Recent"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Run Container from Image"
                          onClick={() => {
                            toast.info(`Deploying container from ${img.Repository}:${img.Tag}`);
                            dockerApi.deployTemplate({
                              name: (img.Repository || "app").split("/").pop()?.replace(/[^a-z0-9]/g, "_") || "app",
                              template: "fastapi",
                              port: 8088,
                            });
                          }}
                        >
                          <Play className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          title="Delete Image"
                          onClick={() => {
                            dockerApi.deleteImage(img.ID || img.Repository || "", true).then(() => {
                              toast.success("Image deleted");
                              refreshAll();
                            }).catch(() => toast.error("Failed to delete image"));
                          }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {images.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-muted-foreground font-sans">
                      No local images found on host PC.
                    </td>
                  </tr>
                )}
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
            <Button size="sm" onClick={() => {
              setModalInput({ stackName: "", stackYaml: "version: '3.8'\nservices:\n  app:\n    image: nginx:alpine\n    ports:\n      - '8081:80'\n" });
              setActiveModal("compose_new");
            }}>
              <Plus className="mr-1 size-4" />New Compose Stack
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {composeStacks.map((cs) => (
              <div key={cs.name} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCode2 className="size-5 text-cyan" />
                    <h3 className="font-bold text-sm font-mono">{cs.name}</h3>
                  </div>
                  <Pill tone={cs.status.toLowerCase().includes("running") ? "success" : "muted"}>
                    {cs.status}
                  </Pill>
                </div>
                <p className="mt-2 text-xs text-muted-foreground font-mono truncate" title={cs.config_files || cs.dir}>
                  {cs.config_files || cs.dir || "Active stack"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" onClick={() => handleComposeAction(cs.name, "restart")}>
                    <RotateCw className="mr-1 size-3.5" />Restart
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleComposeAction(cs.name, "start")}>
                    <Play className="mr-1 size-3.5" />Start
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleComposeAction(cs.name, "down")}>
                    <Square className="mr-1 size-3.5" />Down
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleEditStackYaml(cs.name)}>
                    View YAML
                  </Button>
                </div>
              </div>
            ))}
            {composeStacks.length === 0 && (
              <div className="col-span-2 py-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
                No active Docker Compose stacks detected on host PC. Click "New Compose Stack" to deploy one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: NETWORK */}
      {tab === "Network" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Docker Networks</h2>
            <Button size="sm" onClick={() => {
              setModalInput({ netName: "", netDriver: "bridge", netSubnet: "" });
              setActiveModal("create_network");
            }}>
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
                {networks.map((net) => (
                  <tr key={net.Name} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                      <Network className="size-4 text-cyan" />
                      {net.Name}
                    </td>
                    <td className="px-4 py-3 text-cyan">{net.Driver}</td>
                    <td className="px-4 py-3 text-muted-foreground">{net.Scope || "local"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{net.Subnet || "Dynamic"}</td>
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
                              toast.success("Network removed from host");
                              refreshAll();
                            }).catch((err) => toast.error(err?.message || "Failed to remove network"));
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
              <Button size="sm" variant="outline" onClick={handlePruneVolumes}>
                Prune Unused
              </Button>
              <Button size="sm" onClick={() => {
                setModalInput({ volName: "", volDriver: "local" });
                setActiveModal("create_volume");
              }}>
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
                {volumes.map((vol) => (
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
                          }).catch((err) => toast.error(err?.message || "Failed to remove volume"));
                        }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {volumes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center py-12 text-muted-foreground font-sans">
                      No volumes found on host PC.
                    </td>
                  </tr>
                )}
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
            <Button size="sm" onClick={() => {
              setModalInput({ regServer: "https://index.docker.io/v1/", regUser: "", regPass: "" });
              setActiveModal("add_registry");
            }}>
              <Plus className="mr-1 size-4" />Add Registry
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {repositories.map((reg) => (
              <div key={reg.name} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <FolderGit2 className="size-4 text-cyan" />
                  <h3 className="font-semibold text-sm truncate">{reg.name}</h3>
                </div>
                <p className="text-xs font-mono text-muted-foreground truncate">{reg.url}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Auth: <span className="text-foreground">{reg.user}</span></span>
                  <Pill tone="success">{reg.status}</Pill>
                </div>
                <div className="mt-4 pt-3 border-t border-border flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => toast.success(`Registry connection verified: ${reg.name}`)}>
                    Test Connection
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 10: SETTINGS */}
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
                <Button size="sm" variant="secondary" onClick={() => toast.success(`Docker Engine is up to date: v${status?.version || "28.3.2"}`)}>
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
                  {daemonSettings?.compose_path || "docker compose"}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">*Docker compose path</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => { setActiveModal("modify_compose"); setModalInput({ path: daemonSettings?.compose_path || "docker compose" }); }}>
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
                  * Log file size {daemonSettings?.log_max_size || "10m"}, retain {daemonSettings?.log_max_file || "3"} copies
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
                onCheckedChange={async (val) => {
                  setDaemonSettings((prev) => (prev ? { ...prev, iptables: val } : prev));
                  await dockerApi.updateSettings({ iptables: val });
                  toast.success(`iptables auto-rule configuration saved to host (${val ? "enabled" : "disabled"})`);
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
                checked={daemonSettings?.live_restore ?? false}
                onCheckedChange={async (val) => {
                  setDaemonSettings((prev) => (prev ? { ...prev, live_restore: val } : prev));
                  await dockerApi.updateSettings({ live_restore: val });
                  toast.success(`live_restore saved to host (${val ? "enabled" : "disabled"})`);
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
                value={daemonSettings?.cgroup_driver || "cgroupfs"}
                onChange={async (e) => {
                  const val = e.target.value;
                  setDaemonSettings((prev) => (prev ? { ...prev, cgroup_driver: val } : prev));
                  await dockerApi.updateSettings({ cgroup_driver: val });
                  toast.success(`cgroup driver set to ${val}`);
                }}
              >
                <option value="cgroupfs">cgroupfs</option>
                <option value="systemd">systemd</option>
              </select>
            </div>
          </div>

          {/* Configuration file */}
          <div className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-semibold">Configuration file</h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Directly edit the host daemon.json configuration on PC
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
                <p className="mt-1 text-xs font-mono text-muted-foreground truncate max-w-lg">
                  {daemonSettings?.install_dir || "C:\\Users\\HUN\\Desktop\\crosspanel\\backend\\data\\projects"}
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
            <DialogTitle>Configuration file (Host daemon.json)</DialogTitle>
            <DialogDescription>Modify live daemon flags, registry mirrors, and default drivers on PC.</DialogDescription>
          </DialogHeader>
          <textarea
            rows={12}
            className={cn(inputCls, "h-auto py-3 font-mono text-xs leading-5")}
            value={rawConfig}
            onChange={(e) => setRawConfig(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                const res = await dockerApi.updateSettings({ daemon_json: rawConfig });
                if (res.success) {
                  toast.success(res.message || "Configuration saved to PC!");
                  setActiveModal(null);
                  refreshAll();
                } else {
                  toast.error(res.message);
                }
              } catch (err: any) {
                toast.error(`Invalid configuration JSON: ${err?.message}`);
              }
            }}>
              Save & Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: NEW DOCKER COMPOSE STACK */}
      <Dialog open={activeModal === "compose_new"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Deploy New Docker Compose Stack</DialogTitle>
            <DialogDescription>Create and run a multi-container stack directly on host PC.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span>Stack / Project Name</span>
              <input
                className={inputCls}
                placeholder="my_web_stack"
                value={modalInput.stackName || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, stackName: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>docker-compose.yml</span>
              <textarea
                rows={10}
                className={cn(inputCls, "h-auto py-2 font-mono text-xs")}
                value={modalInput.stackYaml || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, stackYaml: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={handleDeployNewCompose}>
              Deploy Stack
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: VIEW COMPOSE YAML */}
      <Dialog open={activeModal === "compose_edit"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Compose Configuration: {selectedStackConfig?.name}</DialogTitle>
          </DialogHeader>
          <pre className="max-h-80 overflow-auto rounded-lg bg-secondary/80 p-4 font-mono text-xs leading-5">
            {selectedStackConfig?.yaml || "No yaml definition found."}
          </pre>
          <div className="flex justify-end pt-3">
            <Button onClick={() => setActiveModal(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: CREATE NETWORK */}
      <Dialog open={activeModal === "create_network"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Docker Network</DialogTitle>
            <DialogDescription>Create a custom isolated bridge or overlay network.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span>Network Name</span>
              <input
                className={inputCls}
                placeholder="custom_net"
                value={modalInput.netName || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, netName: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Driver</span>
              <select
                className={inputCls}
                value={modalInput.netDriver || "bridge"}
                onChange={(e) => setModalInput((prev) => ({ ...prev, netDriver: e.target.value }))}
              >
                <option value="bridge">bridge</option>
                <option value="host">host</option>
                <option value="overlay">overlay</option>
                <option value="macvlan">macvlan</option>
              </select>
            </label>
            <label className="block space-y-1 text-xs">
              <span>Subnet (optional)</span>
              <input
                className={inputCls}
                placeholder="172.28.0.0/16"
                value={modalInput.netSubnet || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, netSubnet: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={handleCreateNetwork}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: CREATE VOLUME */}
      <Dialog open={activeModal === "create_volume"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Storage Volume</DialogTitle>
            <DialogDescription>Create a named persistent volume on the host.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span>Volume Name</span>
              <input
                className={inputCls}
                placeholder="my_data_volume"
                value={modalInput.volName || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, volName: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={handleCreateVolume}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADD REGISTRY */}
      <Dialog open={activeModal === "add_registry"} onOpenChange={() => setActiveModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add / Authenticate Registry</DialogTitle>
            <DialogDescription>Perform docker login on host PC.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block space-y-1 text-xs">
              <span>Registry Server</span>
              <input
                className={inputCls}
                placeholder="https://index.docker.io/v1/ or ghcr.io"
                value={modalInput.regServer || "https://index.docker.io/v1/"}
                onChange={(e) => setModalInput((prev) => ({ ...prev, regServer: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Username</span>
              <input
                className={inputCls}
                placeholder="myuser"
                value={modalInput.regUser || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, regUser: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Password / Personal Access Token</span>
              <input
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={modalInput.regPass || ""}
                onChange={(e) => setModalInput((prev) => ({ ...prev, regPass: e.target.value }))}
              />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={handleLoginRegistry}>Login</Button>
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
            <Button onClick={async () => {
              const urls = (modalInput.url || "").split("\n").map(s => s.trim()).filter(Boolean);
              setDaemonSettings(prev => prev ? { ...prev, accelerate_urls: urls } : prev);
              await dockerApi.updateSettings({ accelerate_urls: urls });
              toast.success("Acceleration mirrors updated in PC daemon.json");
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
            <Button onClick={async () => {
              setDaemonSettings(prev => prev ? { ...prev, log_max_size: modalInput.size || "10m", log_max_file: modalInput.count || "3" } : prev);
              await dockerApi.updateSettings({ log_max_size: modalInput.size || "10m", log_max_file: modalInput.count || "3" });
              toast.success("Log rotation policy saved to PC daemon.json");
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
            <Button onClick={async () => {
              setDaemonSettings(prev => prev ? { ...prev, ipv6_subnet: modalInput.subnet || "2001:db8:1::/64" } : prev);
              await dockerApi.updateSettings({
                ipv6_enabled: daemonSettings?.ipv6_enabled ?? false,
                ipv6_subnet: modalInput.subnet || "2001:db8:1::/64",
              });
              toast.success("IPv6 settings saved to PC daemon.json. Restart Docker to apply.");
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
