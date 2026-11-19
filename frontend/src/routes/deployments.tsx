import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { Github, GitBranch, KeyRound, Rocket, Plus, Eye, EyeOff, Globe, RotateCcw, Upload, Webhook, Boxes, Search, CircleCheck, Loader2, CircleX, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Panel, PageHeader, Btn, Pill, Table, inputCls } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";
import { demoProjects, demoHistory, runtimes, deployMethods, projectStats, filterProjects, statusTone, versionsFor, type DeployStatus, type DeployMethod } from "@/components/cp/deploy-data";
import { cn } from "@/lib/utils";
import { projectSettingsStore } from "@/components/cp/project-settings-data";

export const Route = createFileRoute("/deployments")({
  head: () => meta("Deployments", "Deploy projects from Git, ZIP upload, or webhook with Node.js, Python, PHP, Go, Java, Ruby, static sites, and Docker."),
  component: Page,
});

const tabs = ["Projects", "New Deployment", "Environment", "History"] as const;
type Tab = (typeof tabs)[number];

const methodIcon: Record<DeployMethod, typeof GitBranch> = { "Git push": GitBranch, "Upload ZIP": Upload, Webhook };

function demo(action: string) {
  toast(`Demo: ${action}`, { description: "No build or deploy started — API not connected." });
}

function Page() {
  const [tab, setTab] = useState<Tab>("Projects");
  const stats = projectStats(demoProjects);
  return (
    <>
      <PageHeader title="Deployments" desc="Host and deploy projects from Git, ZIP upload, or webhook — with the runtime your app needs." action={<Pill tone="muted">Demo · Not connected</Pill>} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Projects", value: stats.total, icon: Boxes, cls: "text-cyan" },
          { label: "Ready", value: stats.ready, icon: CircleCheck, cls: "text-success" },
          { label: "Building", value: stats.building, icon: Loader2, cls: "text-warning" },
          { label: "Failed", value: stats.failed, icon: CircleX, cls: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="glass flex items-center gap-3 rounded-2xl p-4">
            <s.icon className={cn("h-6 w-6", s.cls)} />
            <div><p className="font-display text-xl font-bold">{s.value}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("rounded-lg border px-4 py-2 text-sm font-semibold transition", tab === t ? "border-primary/50 bg-primary/15 text-cyan" : "border-border bg-secondary/60 text-muted-foreground hover:bg-accent")}>{t}</button>
        ))}
      </div>

      {tab === "Projects" && <ProjectsTab />}
      {tab === "New Deployment" && <NewDeploymentTab />}
      {tab === "Environment" && <EnvironmentTab />}
      {tab === "History" && <HistoryTab />}
    </>
  );
}

function ProjectsTab() {
  const navigate = useNavigate();
  const settings = useSyncExternalStore(projectSettingsStore.subscribe, projectSettingsStore.getSnapshot, projectSettingsStore.getServerSnapshot);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"All" | DeployStatus>("All");
  const projects = filterProjects(demoProjects.map((project) => {
    const saved = settings[project.id];
    return saved ? { ...project, name: saved.name, domain: saved.domain, repo: saved.repo, branch: saved.branch, runtime: saved.runtime, version: saved.version } : project;
  }), query, status);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input aria-label="Search projects" placeholder="Search projects, domains, repos..." className={cn(inputCls, "pl-9")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="flex rounded-lg border border-border p-0.5 text-xs">
          {(["All", "Ready", "Building", "Failed"] as const).map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn("rounded-md px-3 py-1.5", status === s ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{s}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((p) => {
          const MethodIcon = methodIcon[p.method];
          return (
            <article key={p.id} className="glass min-w-0 rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-lg font-semibold">{p.name}</h3>
                <Pill tone={statusTone(p.status)}>{p.status}</Pill>
                <span className="ml-auto text-xs text-muted-foreground">{p.builds} builds</span>
              </div>
              <a className="mt-1 flex items-center gap-1.5 text-sm text-cyan" onClick={() => demo(`open ${p.domain}`)} role="link" tabIndex={0}><Globe className="h-3.5 w-3.5" />{p.domain}<ExternalLink className="h-3 w-3" /></a>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">{p.provider === "GitHub" ? <Github className="h-3.5 w-3.5" /> : <GitBranch className="h-3.5 w-3.5" />}{p.repo}</span>
                <Pill tone="muted">{p.branch}</Pill>
                <Pill tone="primary">{p.runtime} {p.version}</Pill>
                <span className="flex items-center gap-1"><MethodIcon className="h-3.5 w-3.5" />{p.method}</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Last deploy {p.lastDeploy}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
                <Btn className="px-3 py-1.5 text-xs" onClick={() => demo(`deploy ${p.name}`)}><Rocket className="h-3.5 w-3.5" />Deploy</Btn>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => demo(`rollback ${p.name}`)}><RotateCcw className="h-3.5 w-3.5" />Rollback</Btn>
                <Btn variant="ghost" className="px-3 py-1.5 text-xs" onClick={() => navigate({ to: "/deployments/$projectId/settings", params: { projectId: String(p.id) } })}>Settings</Btn>
              </div>
            </article>
          );
        })}
      </div>
      {projects.length === 0 && <p className="py-12 text-center text-muted-foreground">No projects match your filters.</p>}
    </>
  );
}

function NewDeploymentTab() {
  const [runtime, setRuntime] = useState(runtimes[0]?.name ?? "Node.js");
  const [version, setVersion] = useState(runtimes[0]?.versions[0] ?? "");
  const [method, setMethod] = useState<DeployMethod>("Git push");
  function submit(e: FormEvent) {
    e.preventDefault();
    demo("deployment project created");
  }
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Panel title="Create Deployment" icon={Rocket} className="lg:col-span-2">
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Project name</span><input required className={inputCls} placeholder="my-app" /></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Domain</span><input required className={inputCls} placeholder="app.example.com" /></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Git provider</span><select className={inputCls}><option>GitHub</option><option>GitLab</option></select></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Repository</span><input required className={inputCls} placeholder="owner/repository" /></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Branch</span><select className={inputCls}><option>main</option><option>production</option><option>develop</option></select></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Runtime</span><select aria-label="Runtime" className={inputCls} value={runtime} onChange={(e) => { setRuntime(e.target.value); setVersion(versionsFor(e.target.value)[0] ?? ""); }}>{runtimes.map((r) => <option key={r.name}>{r.name}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Version</span><select aria-label="Runtime version" className={inputCls} value={version} onChange={(e) => setVersion(e.target.value)}>{versionsFor(runtime).map((v) => <option key={v}>{v}</option>)}</select></label>
          <label className="block space-y-1.5 text-sm"><span className="text-muted-foreground">Build command</span><input className={cn(inputCls, "font-mono text-xs")} placeholder="npm run build" /></label>
          <label className="block space-y-1.5 text-sm sm:col-span-2"><span className="text-muted-foreground">Start command</span><input className={cn(inputCls, "font-mono text-xs")} placeholder="npm start" /></label>
          <div className="sm:col-span-2">
            <p className="mb-2 text-sm text-muted-foreground">Deploy method</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {deployMethods.map((m) => {
                const Icon = methodIcon[m.name];
                return (
                  <button type="button" key={m.name} onClick={() => setMethod(m.name)} className={cn("rounded-xl border p-3 text-left transition", method === m.name ? "border-primary/50 bg-primary/10" : "border-border bg-secondary/40 hover:bg-accent")}>
                    <span className="flex items-center gap-2 text-sm font-semibold"><Icon className="h-4 w-4 text-cyan" />{m.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{m.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <label className="flex items-center justify-between text-sm sm:col-span-2">Auto-deploy on push<input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" /></label>
          <Btn className="sm:col-span-2" type="submit"><Plus className="h-4 w-4" />Create Deployment</Btn>
        </form>
      </Panel>
      <Panel title="Supported Runtimes" icon={Boxes}>
        <div className="space-y-3">
          {runtimes.map((r) => (
            <div key={r.name} className="rounded-xl border border-border bg-secondary/40 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{r.name}</span>
                <span className="ml-auto flex flex-wrap gap-1">{r.versions.map((v) => <Pill key={v} tone="muted">{v}</Pill>)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function EnvironmentTab() {
  const [env, setEnv] = useState<"Production" | "Preview">("Production");
  const [show, setShow] = useState(false);
  const [vars, setVars] = useState([["DATABASE_URL", "postgres://api:****@db:5432/api"], ["API_KEY", "sk_live_8f2d...91a"], ["NODE_ENV", "production"]]);
  return (
    <Panel title="Environment Variables" icon={KeyRound} action={
      <div className="flex rounded-lg border border-border p-0.5 text-xs">{(["Production", "Preview"] as const).map((e) => <button key={e} onClick={() => setEnv(e)} className={cn("rounded-md px-3 py-1", env === e && "bg-primary text-primary-foreground")}>{e}</button>)}</div>
    }>
      <p className="mb-3 text-xs text-muted-foreground">Variables for the {env.toLowerCase()} environment. Values are demo placeholders — nothing is stored.</p>
      <div className="space-y-2">
        {vars.map(([k, v], i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
            <input aria-label="Variable name" className={cn(inputCls, "font-mono text-xs")} value={k} onChange={(e) => setVars((c) => c.map((row, j) => j === i ? [e.target.value, row[1] ?? ""] : row))} />
            <input aria-label="Variable value" className={cn(inputCls, "font-mono text-xs")} type={show ? "text" : "password"} value={v} onChange={(e) => setVars((c) => c.map((row, j) => j === i ? [row[0] ?? "", e.target.value] : row))} />
            <button aria-label="Toggle variable visibility" onClick={() => setShow(!show)} className="rounded-lg border border-border px-3">{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
        ))}
        <Btn variant="ghost" className="w-full" onClick={() => setVars((c) => [...c, ["", ""]])}><Plus className="h-4 w-4" />Add Variable</Btn>
      </div>
    </Panel>
  );
}

function HistoryTab() {
  return (
    <Panel title="Deployment History" icon={Rocket}>
      <Table head={["Commit", "Message", "Project", "Branch", "Status", "Duration", "Time"]} rows={demoHistory.map((h) => [
        <span className="font-mono text-cyan">{h.commit}</span>, h.message, h.project, <Pill tone="muted">{h.branch}</Pill>,
        <Pill tone={statusTone(h.status)}>{h.status}</Pill>, <span className="text-muted-foreground">{h.duration}</span>, <span className="text-muted-foreground">{h.time}</span>,
      ])} />
    </Panel>
  );
}
