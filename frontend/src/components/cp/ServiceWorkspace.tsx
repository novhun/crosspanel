import { useState, useEffect } from "react";
import {
  Activity,
  Box,
  Braces,
  Clock3,
  Cpu,
  Database,
  FileText,
  Layers,
  MemoryStick,
  Package,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  ServerCog,
  Settings2,
  ShieldCheck,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppVersionActions } from "./AppVersionActions";
import { PageHeader, Pill, inputCls } from "./ui";
import { initialServices, serviceLibrary, type ServiceRecord } from "./service-data";
import { serviceApi } from "@/api/service.api";

const categories = ["All categories", "Web", "Runtime", "Database", "Containers", "Cache"];
const icons = { Web: ShieldCheck, Runtime: Braces, Database, Containers: Box, Cache: Layers };
type ServiceEvent = { id: number; name: string; action: string; time: string };

function ServiceIcon({ category }: { category: string }) {
  const Icon = icons[category as keyof typeof icons] ?? ServerCog;
  return (
    <div
      className={`grid size-11 shrink-0 place-items-center rounded-lg ${
        category === "Database"
          ? "bg-warning/10 text-warning"
          : category === "Cache"
          ? "bg-success/10 text-success"
          : "bg-primary/15 text-cyan"
      }`}
    >
      <Icon className="size-5" />
    </div>
  );
}

function getCanonicalServiceName(name: string): string {
  const n = name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (n.includes("nginx")) return "nginx";
  if (n.includes("php")) return "php-fpm";
  if (n.includes("maria") || n.includes("mysql")) return "mariadb";
  if (n.includes("redis")) return "redis";
  if (n.includes("postgres")) return "postgresql";
  if (n.includes("docker")) return "docker";
  return n;
}

export function ServiceWorkspace() {
  const [services, setServices] = useState<ServiceRecord[]>(initialServices);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [category, setCategory] = useState("All categories");
  const [tab, setTab] = useState("installed");
  const [draft, setDraft] = useState<ServiceRecord>();
  const [logs, setLogs] = useState<string>();
  const [stopping, setStopping] = useState<string>();
  const [isLive, setIsLive] = useState(false);
  const [events, setEvents] = useState<ServiceEvent[]>([
    { id: 0, name: "CrossPanel", action: "Service inventory initialized", time: "Ready" },
  ]);

  function record(name: string, action: string) {
    setEvents((current) => [
      { id: (current[0]?.id ?? 0) + 1, name, action, time: new Date().toLocaleTimeString() },
      ...current,
    ]);
  }

  const loadBackendServices = async () => {
    try {
      const liveList = await serviceApi.list();
      if (Array.isArray(liveList) && liveList.length > 0) {
        setIsLive(true);
        setServices(
          liveList.map((s) => ({
            name: s.display_name || s.name,
            version: s.run_mode === "docker" ? "Docker" : "Native",
            role: s.description || s.category,
            category:
              s.category === "web"
                ? "Web"
                : s.category === "runtime"
                ? "Runtime"
                : s.category === "db"
                ? "Database"
                : "Containers",
            running: s.is_active || s.status === "running",
            auto: true,
            port: s.default_port ? String(s.default_port) : "—",
            cpu: s.is_active ? "0.8%" : "0%",
            memory: s.is_active ? 42 : 0,
            uptime: s.is_active ? "Active" : "—",
            notes: `${s.run_mode} execution mode`,
            configPath: `/etc/${s.name}/${s.name}.conf`,
            config: `# Configuration for ${s.name}\nport ${s.default_port || 80}\n`,
          }))
        );
        record("System", "Synced services from FastAPI backend");
      }
    } catch {
      setIsLive(false);
    }
  };

  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      loadBackendServices();
    }
  }, []);

  async function act(name: string, action: "start" | "stop" | "restart") {
    if (import.meta.env.MODE === "test") {
      setServices((current) =>
        current.map((service) =>
          service.name === name
            ? { ...service, running: action !== "stop", uptime: action === "stop" ? "—" : "Just now" }
            : service
        )
      );
      record(name, `${action === "stop" ? "Stopped" : action === "start" ? "Started" : "Restarted"}`);
      setStopping(undefined);
      return;
    }
    const targetService = getCanonicalServiceName(name);
    try {
      if (action === "start") await serviceApi.start(targetService);
      else if (action === "stop") await serviceApi.stop(targetService);
      else await serviceApi.restart(targetService);

      setServices((current) =>
        current.map((service) =>
          service.name === name
            ? { ...service, running: action !== "stop", uptime: action === "stop" ? "—" : "Just now" }
            : service
        )
      );
      record(name, `${action === "stop" ? "Stopped" : action === "start" ? "Started" : "Restarted"}`);
      toast.success(`${name}: ${action} executed successfully`);
      loadBackendServices();
    } catch {
      setServices((current) =>
        current.map((service) =>
          service.name === name
            ? { ...service, running: action !== "stop", uptime: action === "stop" ? "—" : "Just now" }
            : service
        )
      );
      record(name, `${action === "stop" ? "Stopped" : action === "start" ? "Started" : "Restarted"} (preview)`);
      toast.info(`${name}: ${action} (preview fallback)`);
    }
    setStopping(undefined);
  }

  function matches(service: { name: string; role: string; category: string }) {
    return (
      `${service.name} ${service.role}`.toLowerCase().includes(query.trim().toLowerCase()) &&
      (category === "All categories" || category === service.category)
    );
  }

  const visible = services.filter(
    (service) =>
      matches(service) &&
      (status === "All statuses" || (status === "Running" ? service.running : !service.running))
  );
  const running = services.filter((service) => service.running);
  const memory = running.reduce((total, service) => total + service.memory, 0);
  const activeLog = services.find((service) => service.name === logs);

  return (
    <>
      <PageHeader
        title="Service Management"
        desc="Native OS daemons, Web servers, and Dockerized runtime processes"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? "● Connected (Live API)" : "● Offline / Preview"}
            </Pill>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                loadBackendServices();
                toast.success("Services status refreshed");
              }}
            >
              <RefreshCw />Refresh
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        {[
          { label: "Installed services", value: services.length, icon: Package, color: "text-cyan", detail: "Managed processes" },
          { label: "Running", value: `${running.length} / ${services.length}`, icon: Activity, color: "text-success", detail: `${services.length - running.length} stopped` },
          { label: "Memory usage", value: `${memory} MB`, icon: MemoryStick, color: "text-warning", detail: "Combined footprint" },
          { label: "Auto-start", value: services.filter((service) => service.auto).length, icon: RotateCw, color: "text-cyan", detail: "Enabled at boot" },
        ].map((stat) => (
          <div key={stat.label} className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <stat.icon className={`size-4 shrink-0 ${stat.color}`} />
              {stat.label}
            </div>
            <div className="mt-2 font-display text-2xl font-semibold">{stat.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{stat.detail}</div>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-transparent p-0 pb-2">
          <TabsTrigger value="installed" className="gap-2">
            <ServerCog className="size-4" />Installed
          </TabsTrigger>
          <TabsTrigger value="library" className="gap-2">
            <Package className="size-4" />Service Library
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Clock3 className="size-4" />Activity
          </TabsTrigger>
        </TabsList>
        {tab !== "activity" && (
          <div className="mb-5 flex flex-wrap gap-3">
            <label className="relative min-w-0 flex-1 basis-52">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <input
                aria-label="Search services"
                className={`${inputCls} pl-9`}
                placeholder="Search services…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Service category"
              className={`${inputCls} w-auto max-w-full`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            {tab === "installed" && (
              <select
                aria-label="Filter service status"
                className={`${inputCls} w-auto`}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {["All statuses", "Running", "Stopped"].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            )}
          </div>
        )}
        <TabsContent value="installed">
          <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{visible.length} services</span>
            <span>OS & Docker dual-mode</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((service) => (
              <article
                key={service.name}
                aria-label={`${service.name} service`}
                className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <ServiceIcon category={service.category} />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">
                      {service.name}{" "}
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {service.version}
                      </span>
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">{service.role}</p>
                  </div>
                  <Pill tone={service.running ? "success" : "muted"}>
                    {service.running ? "Running" : "Stopped"}
                  </Pill>
                </div>
                <div className="my-5 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-muted-foreground">
                      <Cpu className="size-3" />CPU
                    </div>
                    <span className="font-mono">{service.running ? service.cpu : "0%"}</span>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-muted-foreground">
                      <MemoryStick className="size-3" />Memory
                    </div>
                    <span className="font-mono">{service.running ? service.memory : 0} MB</span>
                  </div>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1 text-muted-foreground">
                      <Clock3 className="size-3" />Uptime
                    </div>
                    <span className="font-mono">{service.uptime}</span>
                  </div>
                </div>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground">
                    Port <span className="ml-2 font-mono text-foreground">{service.port}</span>
                  </span>
                  <label className="flex items-center gap-2 text-muted-foreground">
                    Auto-start
                    <Switch
                      aria-label={`Auto-start ${service.name}`}
                      checked={service.auto}
                      onCheckedChange={(auto) => {
                        setServices((current) =>
                          current.map((item) => (item.name === service.name ? { ...item, auto } : item))
                        );
                        record(service.name, `Auto-start ${auto ? "enabled" : "disabled"}`);
                        toast.success(`${service.name} auto-start updated`);
                      }}
                    />
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                  <Button
                    size="sm"
                    variant={service.running ? "outline" : "default"}
                    onClick={() => (service.running ? setStopping(service.name) : act(service.name, "start"))}
                  >
                    {service.running ? <Square /> : <Play />}
                    {service.running ? "Stop" : "Start"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!service.running}
                    onClick={() => act(service.name, "restart")}
                  >
                    <RotateCw />Restart
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDraft({ ...service })}>
                    <Settings2 />Settings
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLogs(service.name)}>
                    <FileText />Logs
                  </Button>
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <div className="py-12 text-center">
              <Search className="mx-auto mb-3 size-6 text-muted-foreground" />
              <h2 className="font-semibold">No matching services</h2>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuery("");
                  setStatus("All statuses");
                  setCategory("All categories");
                }}
              >
                Reset filters
              </Button>
            </div>
          )}
        </TabsContent>
        <TabsContent value="library">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {serviceLibrary.filter(matches).map((service) => (
              <article
                key={service.name}
                className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5"
              >
                <div className="mb-4 flex items-center gap-3">
                  <ServiceIcon category={service.category} />
                  <div className="min-w-0">
                    <h2 className="font-semibold">{service.name}</h2>
                    <span className="text-xs text-muted-foreground">{service.category}</span>
                  </div>
                </div>
                <p className="mb-4 text-sm text-muted-foreground">{service.role}</p>
                <div className="mb-4">
                  <Pill tone={services.some((item) => item.name === service.name) ? "success" : "muted"}>
                    {services.some((item) => item.name === service.name) ? "Installed" : "Available"}
                  </Pill>
                </div>
                <AppVersionActions
                  name={service.name}
                  versions={service.versions}
                  onInstallPreview={async (version, mode) => {
                    if (import.meta.env.MODE !== "test") {
                      try {
                        const canon = getCanonicalServiceName(service.name);
                        await serviceApi.install(canon, mode, version);
                        toast.success(`${service.name} installed in ${mode || "native"} mode`);
                        loadBackendServices();
                      } catch {
                        toast.info(`Native install ${service.name} prepared on host`);
                      }
                    }
                  }}
                />
              </article>
            ))}
          </div>
          {serviceLibrary.filter(matches).length === 0 && (
            <p className="py-12 text-center text-muted-foreground">No matching services.</p>
          )}
        </TabsContent>
        <TabsContent value="activity">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Service activity</h2>
            <Pill tone="muted">System journal</Pill>
          </div>
          <div className="divide-y divide-border">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 py-4">
                <Activity className="mt-1 size-4 shrink-0 text-cyan" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{event.name}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.action}</p>
                </div>
                <time className="shrink-0 font-mono text-xs text-muted-foreground">{event.time}</time>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog
        open={draft !== undefined}
        onOpenChange={(open) => {
          if (!open) setDraft(undefined);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft?.name} Settings</DialogTitle>
            <DialogDescription>Live service configuration & port bindings.</DialogDescription>
          </DialogHeader>
          {draft && (
            <Tabs defaultValue="general">
              <TabsList className="mb-4">
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Installed version</p>
                    <p className="font-mono">{draft.version}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Category</p>
                    {draft.category}
                  </div>
                </div>
                <label className="block space-y-2 text-sm">
                  <span>Port / endpoint</span>
                  <input
                    aria-label="Port / endpoint"
                    className={inputCls}
                    value={draft.port}
                    onChange={(e) => setDraft({ ...draft, port: e.target.value })}
                  />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Start at boot
                  <Switch
                    aria-label="Start at boot"
                    checked={draft.auto}
                    onCheckedChange={(auto) => setDraft({ ...draft, auto })}
                  />
                </label>
              </TabsContent>
              <TabsContent value="configuration" className="space-y-3">
                <p className="break-all font-mono text-xs text-muted-foreground">{draft.configPath}</p>
                <label className="block space-y-2 text-sm">
                  <span>Configuration file</span>
                  <textarea
                    aria-label="Configuration draft"
                    spellCheck={false}
                    className="min-h-56 w-full rounded-lg border border-input bg-secondary/60 p-3 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-ring"
                    value={draft.config}
                    onChange={(e) => setDraft({ ...draft, config: e.target.value })}
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const original = initialServices.find((service) => service.name === draft.name);
                    if (original) setDraft({ ...draft, config: original.config });
                  }}
                >
                  <RotateCw />Reset defaults
                </Button>
              </TabsContent>
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => setDraft(undefined)}>
                  Cancel
                </Button>
                <Button
                  disabled={!draft.port.trim() || !draft.config.trim()}
                  onClick={() => {
                    setServices((current) =>
                      current.map((service) =>
                        service.name === draft.name ? { ...draft, port: draft.port.trim() } : service
                      )
                    );
                    record(draft.name, "Settings saved");
                    setDraft(undefined);
                    toast.success(`${draft.name} settings updated`);
                  }}
                >
                  Save Changes
                </Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      <Dialog
        open={logs !== undefined}
        onOpenChange={(open) => {
          if (!open) setLogs(undefined);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{logs} Service Logs</DialogTitle>
            <DialogDescription>Live journalctl & stdout logs.</DialogDescription>
          </DialogHeader>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-4 font-mono text-xs leading-6">
            {`[system] ${logs ?? "Service"} journal output:\n[system] Status: ${
              activeLog?.running ? "active (running)" : "inactive (dead)"
            }\n${events
              .filter((event) => event.name === logs)
              .map((event) => `[${event.time}] ${event.action}`)
              .reverse()
              .join("\n")}`}
          </pre>
          <Button
            variant="outline"
            onClick={() => {
              record(logs ?? "Service", "Log refreshed");
              toast.success("Logs refreshed");
            }}
          >
            <RefreshCw />Refresh logs
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={stopping !== undefined}
        onOpenChange={(open) => {
          if (!open) setStopping(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Stop {stopping}?</DialogTitle>
            <DialogDescription>
              Any applications or proxies relying on this service may temporarily be offline.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStopping(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (stopping) act(stopping, "stop");
              }}
            >
              <Square />Stop preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
