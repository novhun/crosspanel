import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  Activity,
  Database,
  Rocket,
  Settings2,
  LayoutGrid,
  Play,
  Square,
  RotateCw,
  ArrowRight,
  ExternalLink,
  Link2,
  Wrench,
  Zap,
  Atom,
  Hexagon,
  Globe2,
  Github,
  Package,
  Cloud,
  Workflow,
  ShieldCheck,
  ChevronRight,
  Monitor,
  Apple,
  Terminal,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Panel, Pill, Btn } from "@/components/cp/ui";
import { Gauge } from "@/components/cp/Gauge";
import { SystemReports } from "@/components/cp/SystemReports";
import { meta } from "@/components/cp/meta";
import { cn } from "@/lib/utils";
import { useSystemStats } from "@/hooks/useSystemStats";
import { serviceApi } from "@/api/service.api";
import { databaseApi } from "@/api/database.api";
import { SkillIcon } from "@/components/cp/SkillIcon";

export const Route = createFileRoute("/")({
  head: () =>
    meta(
      "Dashboard",
      "CrossPanel system dashboard with live telemetry, service monitoring, and multi-OS DevOps controls."
    ),
  component: Dashboard,
});

const defaultServices = ["nginx", "php-fpm", "mariadb", "docker"];
const apps = [
  { name: "WordPress", skill: "wordpress", sub: "CMS", cls: "bg-secondary/40 hover:border-cyan/50" },
  { name: "FastAPI", skill: "fastapi", sub: "Python", cls: "bg-secondary/40 hover:border-emerald-500/50" },
  { name: "Node.js", skill: "nodejs", sub: "Runtime", cls: "bg-secondary/40 hover:border-green-500/50" },
  { name: "React", skill: "react", sub: "Frontend", cls: "bg-secondary/40 hover:border-cyan/50" },
];
const eco = [
  { t: "Git Auto-Deploy", d: "Connect GitHub/GitLab, Auto Build & Deploy", icon: Github, to: "/deployments" },
  { t: "App Library", d: "Laravel, Django, PostgreSQL, etc.", icon: Package, to: "/applications" },
  { t: "Network Tunnels", d: "Cloudflare Tunnels, Ngrok, HTTPS", icon: Cloud, to: "/tunnels" },
  { t: "DevOps Automation", d: "Jenkins Pipelines, Ansible Playbooks", icon: Workflow, to: "/automation" },
  { t: "Security & Firewall", d: "Smart Firewall, File Manager", icon: ShieldCheck, to: "/security" },
] as const;

function Dashboard() {
  const { stats, history, isLive } = useSystemStats(2500);
  const [os, setOs] = useState<string>("Linux");
  const [actingService, setActingService] = useState<string | null>(null);

  useEffect(() => {
    if (stats?.platform_system) {
      const detected = stats.platform_system.toLowerCase();
      if (detected.includes("windows")) setOs("Windows");
      else if (detected.includes("darwin") || detected.includes("mac")) setOs("macOS");
      else setOs("Linux");
    }
  }, [stats?.platform_system]);

  const last = history[history.length - 1] ?? { t: 0, cpu: 0, ram: 0, disk: 0 };

  const handleServiceAction = async (serviceName: string, action: "start" | "stop" | "restart") => {
    setActingService(serviceName);
    try {
      if (action === "start") await serviceApi.start(serviceName);
      else if (action === "stop") await serviceApi.stop(serviceName);
      else await serviceApi.restart(serviceName);
      toast.success(`${serviceName} ${action} command sent.`);
    } catch {
      toast.info(`${serviceName}: ${action} (preview simulated)`);
    } finally {
      setActingService(null);
    }
  };

  const handleLaunchPma = async () => {
    try {
      const res = await databaseApi.launchPhpMyAdmin();
      toast.success(res.message || "phpMyAdmin launched!");
      window.open(res.url, "_blank");
    } catch {
      window.open("http://localhost:888", "_blank");
      toast.info("Opening phpMyAdmin on port 888...");
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Panel
        title="System Monitor"
        icon={Activity}
        className="xl:col-span-7"
        action={
          <div className="flex items-center gap-4 text-xs">
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? "● Live Telemetry" : "● Offline / Demo"}
            </Pill>
            <span className="text-chart-1">● CPU</span>
            <span className="text-chart-2">● RAM</span>
            <span className="text-chart-3">● Disk</span>
          </div>
        }
      >
        <div className="grid items-center gap-4 lg:grid-cols-[auto_1fr]">
          <div className="flex justify-around gap-2">
            <Gauge value={Math.round(last.cpu)} label="CPU" color="var(--chart-1)" />
            <Gauge value={Math.round(last.ram)} label="RAM" color="var(--chart-2)" />
            <Gauge value={Math.round(last.disk)} label="Disk" color="var(--chart-3)" />
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={history}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" hide />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={30} />
                {(["cpu", "ram", "disk"] as const).map((k, i) => (
                  <Line
                    key={k}
                    dataKey={k}
                    stroke={`var(--chart-${i + 1})`}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        {stats && (
          <div className="mt-3 flex flex-wrap items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <div>Host: <span className="font-semibold text-foreground">{stats.hostname}</span></div>
            <div>OS: <span className="font-semibold text-foreground">{stats.os_name} {stats.os_version}</span></div>
            <div>RAM: <span className="font-semibold text-foreground">{stats.ram_used_gb} / {stats.ram_total_gb} GB</span></div>
            <div>Uptime: <span className="font-semibold text-foreground">{Math.round(stats.uptime_seconds / 3600)}h</span></div>
          </div>
        )}
      </Panel>

      <Panel
        title="Services Status"
        icon={Database}
        className="xl:col-span-5"
        action={
          <Link to="/service" className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="space-y-3">
          {defaultServices.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary font-bold text-success uppercase">
                {s[0]}
              </div>
              <div className="flex-1 font-medium capitalize">{s}</div>
              <Pill tone={isLive ? "success" : "muted"}>Active</Pill>
              <div className="flex gap-1.5">
                <button
                  disabled={actingService === s}
                  onClick={() => handleServiceAction(s, "start")}
                  className="rounded-md bg-primary p-2 transition hover:opacity-90 disabled:opacity-50"
                  title="Start service"
                >
                  <Play className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={actingService === s}
                  onClick={() => handleServiceAction(s, "stop")}
                  className="rounded-md bg-destructive p-2 transition hover:opacity-90 disabled:opacity-50"
                  title="Stop service"
                >
                  <Square className="h-3.5 w-3.5" />
                </button>
                <button
                  disabled={actingService === s}
                  onClick={() => handleServiceAction(s, "restart")}
                  className="rounded-md bg-primary/70 p-2 transition hover:opacity-90 disabled:opacity-50"
                  title="Restart service"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <SystemReports />

      <Panel
        title="One-Click Deployment"
        icon={Rocket}
        className="xl:col-span-5"
        action={
          <Link to="/applications" className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">
            View All <ArrowRight className="h-3 w-3" />
          </Link>
        }
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {apps.map((a) => (
            <button
              key={a.name}
              onClick={() => toast.success(`Initiating ${a.name} deploy wizard...`)}
              className={cn(
                "group flex flex-col items-center gap-2 rounded-xl border border-border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
                a.cls
              )}
            >
              <div className="grid size-12 place-items-center rounded-xl bg-background/50 p-1">
                <SkillIcon name={a.skill} size={40} />
              </div>
              <div className="font-display font-semibold text-sm group-hover:text-cyan transition-colors">{a.name}</div>
              <div className="text-xs text-muted-foreground">{a.sub}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Quick Database Access" icon={Database} className="xl:col-span-4">
        <Btn className="h-20 w-full flex-col text-lg" onClick={handleLaunchPma}>
          phpMyAdmin<span className="text-xs font-normal opacity-80">(Password-free Port 888)</span>
        </Btn>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Btn variant="ghost" onClick={() => window.open("http://localhost:888", "_blank")}>
            <ExternalLink className="h-4 w-4" />Direct Access
          </Btn>
          <Btn variant="ghost" onClick={() => toast.info("phpMyAdmin is preconfigured on Port 888")}>
            <Link2 className="h-4 w-4" />Port : 888
          </Btn>
        </div>
      </Panel>

      <Panel title="Target OS Setup" icon={Settings2} className="xl:col-span-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { n: "Linux", i: Terminal },
            { n: "macOS", i: Apple },
            { n: "Windows", i: Monitor },
          ].map((o) => (
            <button
              key={o.n}
              onClick={() => {
                setOs(o.n);
                toast.success(`Target OS set to ${o.n}`);
              }}
              className={cn(
                "flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-semibold transition",
                os === o.n ? "border-primary bg-primary/25 shadow-glow" : "border-border bg-secondary/50"
              )}
            >
              <o.i className="h-7 w-7" />
              {o.n}
            </button>
          ))}
        </div>
        <Btn className="mt-3 w-full" onClick={() => toast.success(`Configured environment for ${os}`)}>
          <Wrench className="h-4 w-4" />Configure Environment
        </Btn>
      </Panel>

      <Panel title="DevOps Ecosystem" icon={LayoutGrid} className="xl:col-span-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {eco.map((e) => (
            <Link
              key={e.t}
              to={e.to}
              className="group flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-4 hover:border-primary"
            >
              <div className="flex items-center gap-3">
                <e.icon className="h-8 w-8 text-cyan" />
                <span className="font-display font-semibold">{e.t}</span>
              </div>
              <div className="flex items-end justify-between gap-2 text-sm text-muted-foreground">
                {e.d}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground group-hover:shadow-glow">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
