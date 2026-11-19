import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, Database, Rocket, Settings2, LayoutGrid, Play, Square, RotateCw, ArrowRight, ExternalLink, Link2, Wrench, Zap, Atom, Hexagon, Globe2, Github, Package, Cloud, Workflow, ShieldCheck, ChevronRight, Monitor, Apple, Terminal } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { Panel, Pill, Btn } from "@/components/cp/ui";
import { Gauge } from "@/components/cp/Gauge";
import { SystemReports } from "@/components/cp/SystemReports";
import { meta } from "@/components/cp/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => meta("Dashboard", "CrossPanel system dashboard with disk usage, realtime traffic, network totals, disk IO and service monitoring."),
  component: Dashboard,
});

const services = ["Nginx", "PHP-FPM", "MariaDB", "Docker"];
const apps = [
  { name: "WordPress", sub: "CMS", icon: Globe2, cls: "bg-gradient-primary" },
  { name: "FastAPI", sub: "Python", icon: Zap, cls: "bg-gradient-success" },
  { name: "Node.js", sub: "Runtime", icon: Hexagon, cls: "bg-success/30" },
  { name: "React", sub: "Frontend", icon: Atom, cls: "bg-primary/30" },
];
const eco = [
  { t: "Git Auto-Deploy", d: "Connect GitHub/GitLab, Auto Build & Deploy", icon: Github, to: "/deployments" },
  { t: "App Library", d: "Laravel, Django, PostgreSQL, etc.", icon: Package, to: "/applications" },
  { t: "Network Tunnels", d: "Cloudflare Tunnels, Ngrok, HTTPS", icon: Cloud, to: "/tunnels" },
  { t: "DevOps Automation", d: "Jenkins Pipelines, Ansible Playbooks", icon: Workflow, to: "/automation" },
  { t: "Security & Firewall", d: "Smart Firewall, File Manager", icon: ShieldCheck, to: "/security" },
] as const;

const seed = Array.from({ length: 20 }, (_, i) => ({ t: i, cpu: 30 + ((i * 7) % 20), ram: 50 + ((i * 11) % 18), disk: 30 + ((i * 3) % 10) }));

function Dashboard() {
  const [data, setData] = useState(seed);
  const [os, setOs] = useState("Linux");
  useEffect(() => {
    const id = setInterval(() => setData((d) => [...d.slice(1), { t: (d[d.length - 1]?.t ?? 0) + 1, cpu: 20 + Math.random() * 35, ram: 48 + Math.random() * 22, disk: 25 + Math.random() * 15 }]), 2000);
    return () => clearInterval(id);
  }, []);
  const last = data[data.length - 1] ?? { t: 0, cpu: 0, ram: 0, disk: 0 };
  return (
    <div className="grid gap-5 xl:grid-cols-12">
      <Panel title="System Monitor" icon={Activity} className="xl:col-span-7" action={<div className="flex items-center gap-4 text-xs"><Pill>● Live</Pill><span className="text-chart-1">● CPU</span><span className="text-chart-2">● RAM</span><span className="text-chart-3">● Disk</span></div>}>
        <div className="grid items-center gap-4 lg:grid-cols-[auto_1fr]">
          <div className="flex justify-around gap-2">
            <Gauge value={Math.round(last.cpu)} label="CPU" color="var(--chart-1)" />
            <Gauge value={Math.round(last.ram)} label="RAM" color="var(--chart-2)" />
            <Gauge value={Math.round(last.disk)} label="Disk" color="var(--chart-3)" />
          </div>
          <div className="h-44">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="t" hide />
                <YAxis domain={[0, 100]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} width={30} />
                {(["cpu", "ram", "disk"] as const).map((k, i) => <Line key={k} dataKey={k} stroke={`var(--chart-${i + 1})`} strokeWidth={2} dot={false} isAnimationActive={false} />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      <Panel title="Services Status" icon={Database} className="xl:col-span-5" action={<Link to="/settings" className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">View All <ArrowRight className="h-3 w-3" /></Link>}>
        <div className="space-y-3">
          {services.map((s) => (
            <div key={s} className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary font-bold text-success">{s[0]}</div>
              <div className="flex-1 font-medium">{s}</div>
              <Pill>Running</Pill>
              <div className="flex gap-1.5">
                <button onClick={() => toast(`Start ${s}`)} className="rounded-md bg-primary p-2"><Play className="h-3.5 w-3.5" /></button>
                <button onClick={() => toast(`Stop ${s}`)} className="rounded-md bg-destructive p-2"><Square className="h-3.5 w-3.5" /></button>
                <button onClick={() => toast(`Restart ${s}`)} className="rounded-md bg-primary/70 p-2"><RotateCw className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <SystemReports />

      <Panel title="One-Click Deployment" icon={Rocket} className="xl:col-span-5" action={<Link to="/applications" className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs">View All <ArrowRight className="h-3 w-3" /></Link>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {apps.map((a) => (
            <button key={a.name} onClick={() => toast.success(`Deploying ${a.name}...`)} className={cn("flex flex-col items-center gap-2 rounded-xl border border-border p-4 transition hover:-translate-y-0.5", a.cls)}>
              <a.icon className="h-10 w-10" />
              <div className="font-display font-semibold">{a.name}</div>
              <div className="text-xs opacity-80">{a.sub}</div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Quick Database Access" icon={Database} className="xl:col-span-4">
        <Btn className="h-20 w-full flex-col text-lg" onClick={() => toast("Launching phpMyAdmin")}>phpMyAdmin<span className="text-xs font-normal opacity-80">(Password-free)</span></Btn>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Btn variant="ghost"><ExternalLink className="h-4 w-4" />Direct Access</Btn>
          <Btn variant="ghost"><Link2 className="h-4 w-4" />Port : 888</Btn>
        </div>
      </Panel>

      <Panel title="Target OS Setup" icon={Settings2} className="xl:col-span-3">
        <div className="grid grid-cols-3 gap-2">
          {[{ n: "Linux", i: Terminal }, { n: "macOS", i: Apple }, { n: "Windows", i: Monitor }].map((o) => (
            <button key={o.n} onClick={() => setOs(o.n)} className={cn("flex flex-col items-center gap-1 rounded-xl border p-3 text-sm font-semibold", os === o.n ? "border-primary bg-primary/25 shadow-glow" : "border-border bg-secondary/50")}>
              <o.i className="h-7 w-7" />{o.n}
            </button>
          ))}
        </div>
        <Btn className="mt-3 w-full" onClick={() => toast(`Configuring ${os}`)}><Wrench className="h-4 w-4" />Configure Environment</Btn>
      </Panel>

      <Panel title="DevOps Ecosystem" icon={LayoutGrid} className="xl:col-span-12">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {eco.map((e) => (
            <Link key={e.t} to={e.to} className="group flex flex-col gap-3 rounded-xl border border-border bg-secondary/50 p-4 hover:border-primary">
              <div className="flex items-center gap-3"><e.icon className="h-8 w-8 text-cyan" /><span className="font-display font-semibold">{e.t}</span></div>
              <div className="flex items-end justify-between gap-2 text-sm text-muted-foreground">{e.d}<span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground group-hover:shadow-glow"><ChevronRight className="h-4 w-4" /></span></div>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
