import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Settings2, GitBranch, Globe, KeyRound, Server, Save, RotateCcw, Plus, Trash2, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";
import { Btn, Pill, inputCls } from "./ui";
import { runtimes, versionsFor, statusTone, type DeployProject } from "./deploy-data";
import { defaultProjectSettings, projectSettingsStore, validateProjectSettings, type ProjectSettings } from "./project-settings-data";
import { cn } from "@/lib/utils";

const sections = [{ name: "General", icon: Settings2 }, { name: "Build & Deploy", icon: GitBranch }, { name: "Domains", icon: Globe }, { name: "Environment", icon: KeyRound }, { name: "Hosting", icon: Server }] as const;
type Section = (typeof sections)[number]["name"];

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-2 text-sm"><span className="text-muted-foreground">{label}</span>{children}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex items-center justify-between gap-4 border-b border-border py-4 text-sm"><span>{label}</span><input className="h-4 w-4 shrink-0 accent-primary" type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /></label>;
}

export function ProjectSettingsWorkspace({ project }: { project: DeployProject }) {
  const store = useSyncExternalStore(projectSettingsStore.subscribe, projectSettingsStore.getSnapshot, projectSettingsStore.getServerSnapshot);
  const baseline = store[project.id] ?? defaultProjectSettings(project);
  const [draft, setDraft] = useState<ProjectSettings>(() => structuredClone(baseline));
  const [section, setSection] = useState<Section>("General");
  const [environment, setEnvironment] = useState<"Production" | "Preview">("Production");
  const [showValues, setShowValues] = useState(false);
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  function update<K extends keyof ProjectSettings>(key: K, value: ProjectSettings[K]) { setDraft((current) => ({ ...current, [key]: value })); setError(undefined); }
  function text(key: keyof Pick<ProjectSettings, "name" | "domain" | "repo" | "branch" | "rootDirectory" | "installCommand" | "buildCommand" | "startCommand" | "outputDirectory" | "port" | "healthPath">, label: string, mono = false) {
    return <Field label={label}><input className={cn(inputCls, mono && "font-mono")} value={draft[key]} onChange={(e) => update(key, e.target.value)} /></Field>;
  }
  function save() {
    const message = validateProjectSettings(draft);
    if (message) { setError(message); return; }
    projectSettingsStore.save(project.id, draft);
    toast.success("Project settings preview saved", { description: "Demo only — no hosting, builds or domains changed." });
  }
  return <>
    <Link to="/deployments" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All projects</Link>
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
      <div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><Pill tone="primary">Project settings</Pill><Pill tone={statusTone(project.status)}>{project.status}</Pill></div><h1 className="break-words font-display text-2xl font-bold">{baseline.name}</h1><p className="mt-2 break-all text-sm text-muted-foreground">{baseline.domain} <span className="px-2">·</span> {baseline.runtime} {baseline.version}</p></div>
      <Pill tone="muted">Demo · Not connected</Pill>
    </header>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
      <nav aria-label="Project settings sections" className="flex flex-wrap content-start gap-2 lg:flex-col">
        {sections.map(({ name, icon: Icon }) => <Btn key={name} variant="ghost" aria-pressed={section === name} className={cn("justify-start border-transparent px-3 lg:w-full", section === name ? "border-primary/30 bg-primary/15 text-cyan" : "bg-transparent text-muted-foreground")} onClick={() => { setSection(name); setShowValues(false); }}><Icon className="h-4 w-4 shrink-0" />{name}</Btn>)}
      </nav>
      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2"><h2 className="font-display text-xl font-semibold">{section}</h2><span className={cn("flex items-center gap-1.5 text-xs", dirty ? "text-warning" : "text-muted-foreground")}>{dirty ? "Unsaved changes" : <><Check className="h-3.5 w-3.5" />No pending changes</>}</span></div>
        {section === "General" && <div className="grid gap-5 sm:grid-cols-2">{text("name", "Project name")}{text("rootDirectory", "Root directory", true)}<Field label="Deployment method"><input className={inputCls} value={project.method} readOnly /></Field><Field label="Git provider"><input className={inputCls} value={project.provider} readOnly /></Field>{text("repo", "Repository", true)}{text("branch", "Production branch", true)}</div>}
        {section === "Build & Deploy" && <><div className="grid gap-5 sm:grid-cols-2"><Field label="Runtime"><select className={inputCls} value={draft.runtime} onChange={(e) => setDraft((current) => ({ ...current, runtime: e.target.value, version: versionsFor(e.target.value)[0] ?? "" }))}>{runtimes.map((runtime) => <option key={runtime.name}>{runtime.name}</option>)}</select></Field><Field label="Runtime version"><select className={inputCls} value={draft.version} onChange={(e) => update("version", e.target.value)}>{versionsFor(draft.runtime).map((version) => <option key={version}>{version}</option>)}</select></Field>{text("installCommand", "Install command", true)}{text("buildCommand", "Build command", true)}{text("startCommand", "Start command", true)}{text("outputDirectory", "Output directory", true)}</div><div className="mt-4"><Toggle label="Auto-deploy on push" checked={draft.autoDeploy} onChange={(value) => update("autoDeploy", value)} /></div></>}
        {section === "Domains" && <><div className="max-w-xl">{text("domain", "Primary domain")}<div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Globe className="h-4 w-4" /><span className="break-all">{draft.domain}</span><Pill tone="muted">DNS preview</Pill></div></div><div className="mt-5"><Toggle label="HTTPS certificate" checked={draft.https} onChange={(value) => update("https", value)} /><Toggle label="Redirect HTTP to HTTPS" checked={draft.redirectHttps} onChange={(value) => update("redirectHttps", value)} /></div></>}
        {section === "Environment" && <><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-2">{(["Production", "Preview"] as const).map((name) => <Btn key={name} variant="ghost" aria-pressed={environment === name} className={cn("px-3", environment === name && "border-primary/40 text-cyan")} onClick={() => { setEnvironment(name); setShowValues(false); }}>{name}</Btn>)}</div><Btn variant="ghost" aria-label={showValues ? "Hide variable values" : "Show variable values"} title={showValues ? "Hide variable values" : "Show variable values"} onClick={() => setShowValues(!showValues)}>{showValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Btn></div>
          <p className="mb-4 text-xs text-muted-foreground">Demo values only · Do not enter real secrets.</p>
          <div className="space-y-3">{draft.variables.filter((variable) => variable.environment === environment).map((variable) => <div key={variable.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"><input aria-label="Variable name" placeholder="VARIABLE_NAME" className={cn(inputCls, "font-mono")} value={variable.name} onChange={(e) => update("variables", draft.variables.map((v) => v.id === variable.id ? { ...v, name: e.target.value } : v))} /><input aria-label="Variable value" placeholder="Demo value" className={cn(inputCls, "col-start-1 row-start-2 font-mono sm:col-start-2 sm:row-start-1")} type={showValues ? "text" : "password"} value={variable.value} onChange={(e) => update("variables", draft.variables.map((v) => v.id === variable.id ? { ...v, value: e.target.value } : v))} /><Btn variant="ghost" className="col-start-2 row-start-1 sm:col-start-3" aria-label={`Delete ${variable.name || "variable"}`} title="Delete variable" onClick={() => update("variables", draft.variables.filter((v) => v.id !== variable.id))}><Trash2 className="h-4 w-4 text-destructive" /></Btn></div>)}</div>
          {!draft.variables.some((v) => v.environment === environment) && <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">No {environment.toLowerCase()} variables.</p>}
          <Btn variant="ghost" className="mt-4" onClick={() => update("variables", [...draft.variables, { id: crypto.randomUUID(), name: "", value: "", environment }])}><Plus className="h-4 w-4" />Add Variable</Btn></>}
        {section === "Hosting" && <div className="grid gap-5 sm:grid-cols-2">{text("port", "Application port", true)}{text("healthPath", "Health check path", true)}<Field label="CPU allocation"><select className={inputCls} value={draft.cpu} onChange={(e) => update("cpu", e.target.value)}>{["0.5", "1", "2", "4"].map((value) => <option key={value} value={value}>{value} vCPU</option>)}</select></Field><Field label="Memory"><select className={inputCls} value={draft.memory} onChange={(e) => update("memory", e.target.value)}>{["512", "1024", "2048", "4096"].map((value) => <option key={value} value={value}>{value} MB</option>)}</select></Field><Field label="Instances"><select className={inputCls} value={draft.instances} onChange={(e) => update("instances", e.target.value)}>{["1", "2", "3", "4"].map((value) => <option key={value}>{value}</option>)}</select></Field><Field label="Restart policy"><select className={inputCls} value={draft.restart} onChange={(e) => update("restart", e.target.value)}>{["On failure", "Always", "Never"].map((value) => <option key={value}>{value}</option>)}</select></Field></div>}
        <footer className="mt-8 border-t border-border pt-5">{error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}<div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Preview only · No server changes</p><div className="flex gap-2"><Btn variant="ghost" disabled={!dirty} onClick={() => { setDraft(structuredClone(baseline)); setError(undefined); }}><RotateCcw className="h-4 w-4" />Discard</Btn><Btn disabled={!dirty} onClick={save}><Save className="h-4 w-4" />Save preview</Btn></div></div></footer>
      </div>
    </div>
  </>;
}