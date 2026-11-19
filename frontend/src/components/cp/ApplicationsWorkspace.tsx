import { useState } from "react";
import { Atom, Boxes, Code2, Database, FileCode2, Globe2, Hexagon, Info, Link2, Package, Play, RotateCw, Search, Server, Square, Trash2, Workflow, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AppVersionActions } from "./AppVersionActions";
import { PageHeader, Pill, inputCls } from "./ui";

const apps = [
  { name: "WordPress", category: "CMS", icon: Globe2, tone: "text-cyan bg-cyan/10", description: "Publish websites, blogs and online stores.", versions: ["6.6", "6.5", "6.4"], runtime: "PHP · MariaDB", port: "80", featured: true },
  { name: "FastAPI", category: "Python", icon: Zap, tone: "text-success bg-success/10", description: "High-performance Python APIs with automatic documentation.", versions: ["0.115", "0.114", "0.113"], runtime: "Python · Uvicorn", port: "8000", featured: true },
  { name: "Node.js", category: "Runtime", icon: Hexagon, tone: "text-success bg-success/10", description: "JavaScript runtime for APIs and server applications.", versions: ["22 LTS", "20 LTS", "18 LTS"], runtime: "JavaScript · npm", port: "3000", featured: true },
  { name: "React", category: "Frontend", icon: Atom, tone: "text-cyan bg-cyan/10", description: "Build interactive interfaces and web applications.", versions: ["19", "18.3", "18.2"], runtime: "Node.js · Vite", port: "3000", featured: false },
  { name: "Laravel", category: "PHP", icon: Code2, tone: "text-destructive bg-destructive/10", description: "Full-stack PHP framework for modern web applications.", versions: ["11", "10", "9"], runtime: "PHP · Composer", port: "8000", featured: false },
  { name: "Django", category: "Python", icon: Code2, tone: "text-success bg-success/10", description: "Python web framework with a built-in administration area.", versions: ["5.1", "5.0", "4.2 LTS"], runtime: "Python · Gunicorn", port: "8000", featured: false },
  { name: "Express", category: "Node", icon: Server, tone: "text-warning bg-warning/10", description: "Lightweight routing and middleware for Node.js APIs.", versions: ["5", "4.21", "4.20"], runtime: "Node.js · npm", port: "3000", featured: false },
  { name: "PostgreSQL", category: "Database", icon: Database, tone: "text-cyan bg-cyan/10", description: "Relational database for reliable application storage.", versions: ["17", "16", "15"], runtime: "Database server", port: "5432", featured: false },
  { name: "Redis", category: "Cache", icon: Boxes, tone: "text-destructive bg-destructive/10", description: "In-memory caching, queues and session storage.", versions: ["7.4", "7.2", "6.2"], runtime: "In-memory store", port: "6379", featured: false },
  { name: "MongoDB", category: "Database", icon: Database, tone: "text-success bg-success/10", description: "Flexible document storage for application data.", versions: ["8", "7", "6"], runtime: "Document database", port: "27017", featured: false },
  { name: "Ghost", category: "CMS", icon: Globe2, tone: "text-warning bg-warning/10", description: "Independent publishing, newsletters and memberships.", versions: ["5", "4", "3"], runtime: "Node.js · MySQL", port: "2368", featured: false },
  { name: "n8n", category: "Automation", icon: Workflow, tone: "text-violet bg-violet/10", description: "Connect services with visual automation workflows.", versions: ["1.6", "1.5", "1.4"], runtime: "Node.js · SQLite", port: "5678", featured: false },
];
type App = (typeof apps)[number];
const initialInstalled = [
  { id: "wordpress-site", app: "WordPress", version: "6.6", port: "8080", running: true },
  { id: "fastapi-api", app: "FastAPI", version: "0.115", port: "8000", running: true },
];
const tabs = [{ name: "App Library", icon: Package }, { name: "Installed", icon: Boxes }, { name: "Custom Sources", icon: FileCode2 }] as const;
type Tab = (typeof tabs)[number]["name"];

export function ApplicationsWorkspace() {
  const [tab, setTab] = useState<Tab>("App Library");
  const [category, setCategory] = useState("All categories");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Featured");
  const [details, setDetails] = useState<App | null>(null);
  const [installed, setInstalled] = useState(initialInstalled);
  const [remove, setRemove] = useState<string | null>(null);
  const [source, setSource] = useState("Docker Hub");
  const [sourceValue, setSourceValue] = useState("");
  const [compose, setCompose] = useState('services:\n  web:\n    image: nginx:alpine\n    ports:\n      - "8080:80"');
  const preview = (action: string) => toast(`Demo ${action}`, { description: "Preview only — API not connected. No server changes made." });
  const matches = apps.filter((app) => (category === "All categories" || app.category === category) && `${app.name} ${app.category} ${app.description}`.toLowerCase().includes(search.toLowerCase().trim()));
  const visible = [...matches].sort((a, b) => sort === "Name A–Z" ? a.name.localeCompare(b.name) : Number(b.featured) - Number(a.featured));
  const reset = () => { setSearch(""); setCategory("All categories"); };

  return <>
    <PageHeader title="Applications" desc="Web apps, runtimes & services" action={<Pill tone="muted">Demo · Not connected</Pill>} />
    <div className="mb-6 grid grid-cols-3 divide-x divide-border border-y border-border py-4">
      {[{ label: "Library apps", value: apps.length, icon: Package, tone: "text-cyan" }, { label: "Installed previews", value: installed.length, icon: Boxes, tone: "text-success" }, { label: "Source types", value: 3, icon: Link2, tone: "text-warning" }].map(({ label, value, icon: Icon, tone }) => <div key={label} className="flex min-w-0 items-center gap-3 px-2 first:pl-0 sm:px-5"><Icon className={cn("hidden size-5 shrink-0 sm:block", tone)} /><div><div className="font-display text-2xl font-semibold">{value.toString().padStart(2, "0")}</div><div className="mt-1 text-xs text-muted-foreground">{label}</div></div></div>)}
    </div>
    <div className="mb-6 grid grid-cols-3 gap-1 border-b border-border sm:flex" role="tablist" aria-label="Applications views">
      {tabs.map(({ name, icon: Icon }) => <Button key={name} role="tab" aria-selected={tab === name} variant="ghost" className={cn("h-auto min-h-12 flex-col rounded-none border-b-2 border-transparent px-2 py-2 text-xs sm:flex-row sm:px-5 sm:text-sm", tab === name && "border-cyan bg-cyan/5 text-cyan")} onClick={() => setTab(name)}><Icon />{name}{name === "Installed" && <span className="hidden text-muted-foreground sm:inline">{installed.length}</span>}</Button>)}
    </div>

    {tab === "App Library" && <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-0 flex-[1_1_220px]"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input aria-label="Search applications" className={cn(inputCls, "pl-10")} placeholder="Search applications…" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <select aria-label="Application category" className={cn(inputCls, "w-auto flex-[1_1_150px] sm:flex-none")} value={category} onChange={(e) => setCategory(e.target.value)}>{["All categories", ...new Set(apps.map((app) => app.category))].map((c) => <option key={c}>{c}</option>)}</select>
        <select aria-label="Sort applications" className={cn(inputCls, "w-auto flex-[1_1_130px] sm:flex-none")} value={sort} onChange={(e) => setSort(e.target.value)}><option>Featured</option><option>Name A–Z</option></select>
      </div>
      <div className="mb-4 flex items-center justify-between"><h2 className="font-display text-lg font-semibold">App Library</h2><span className="text-xs text-muted-foreground">{visible.length} applications</span></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((app) => <article key={app.name} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-cyan/50 sm:p-5">
          <div className="flex items-center gap-3"><div className={cn("grid size-12 shrink-0 place-items-center rounded-lg", app.tone)}><app.icon className="size-6" /></div><div className="min-w-0"><h3 className="font-display font-semibold">{app.name}</h3><span className="text-xs text-muted-foreground">{app.category}</span></div><Button variant="ghost" size="icon" className="ml-auto shrink-0 text-muted-foreground" title={`${app.name} details`} aria-label={`${app.name} details`} onClick={() => setDetails(app)}><Info /></Button></div>
          <p className="mt-4 min-h-12 text-sm leading-6 text-muted-foreground">{app.description}</p>
          <div className="mb-4 mt-3 flex flex-wrap items-center gap-2 border-b border-border pb-4 text-xs"><span className="inline-flex items-center gap-1 text-muted-foreground"><Server className="size-3" />{app.runtime}</span>{app.featured && <span className="ml-auto text-warning">Popular</span>}</div>
          <AppVersionActions name={app.name} versions={app.versions} />
        </article>)}
      </div>
      {visible.length === 0 && <div className="py-16 text-center"><Search className="mx-auto mb-4 size-8 text-muted-foreground" /><h3 className="font-semibold">No applications found</h3><Button className="mt-4" variant="outline" onClick={reset}>Clear filters</Button></div>}
    </>}

    {tab === "Installed" && <section>
      <div className="mb-5 flex items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">Installed Applications</h2><Button variant="outline" size="sm" onClick={() => setTab("App Library")}><Package />Browse apps</Button></div>
      <div className="space-y-3">{installed.map((item) => <article key={item.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4"><div className="grid size-11 place-items-center rounded-lg bg-cyan/10 text-cyan"><Boxes className="size-5" /></div><div className="min-w-0 flex-1 basis-40"><h3 className="break-words font-semibold">{item.id}</h3><p className="mt-1 text-xs text-muted-foreground">{item.app} {item.version} · Port {item.port}</p></div><Pill tone={item.running ? "success" : "muted"}>{item.running ? "Running preview" : "Stopped preview"}</Pill><div className="flex gap-1"><Button variant="outline" size="icon" title={item.running ? "Stop preview" : "Start preview"} aria-label={`${item.running ? "Stop" : "Start"} ${item.id}`} onClick={() => { setInstalled((rows) => rows.map((row) => row.id === item.id ? { ...row, running: !row.running } : row)); preview(`${item.running ? "stop" : "start"}: ${item.id}`); }}>{item.running ? <Square /> : <Play />}</Button><Button variant="outline" size="icon" title="Restart preview" aria-label={`Restart ${item.id}`} onClick={() => { setInstalled((rows) => rows.map((row) => row.id === item.id ? { ...row, running: true } : row)); preview(`restart: ${item.id}`); }}><RotateCw /></Button><Button variant="ghost" size="icon" className="text-destructive" title="Remove preview" aria-label={`Remove ${item.id}`} onClick={() => setRemove(item.id)}><Trash2 /></Button></div></article>)}</div>
      {installed.length === 0 && <div className="py-16 text-center text-muted-foreground">No installed application previews</div>}
    </section>}

    {tab === "Custom Sources" && <div className="grid gap-8 xl:grid-cols-2">
      <section className="min-w-0"><h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold"><Link2 className="size-5 text-cyan" />Custom Source</h2><div className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-border p-1">{["Docker Hub", "Git Repo", "Zip Archive"].map((name) => <Button key={name} variant={source === name ? "secondary" : "ghost"} className="px-1 text-xs" onClick={() => { setSource(name); setSourceValue(""); }}>{name}</Button>)}</div><form onSubmit={(e) => { e.preventDefault(); preview(`source deployment from ${source}`); }}><label className="block space-y-2 text-sm"><span>{source === "Docker Hub" ? "Image & tag" : source === "Git Repo" ? "Repository URL" : "Archive URL"}</span><input required aria-label="Custom source" className={inputCls} placeholder={source === "Docker Hub" ? "nginx:alpine" : source === "Git Repo" ? "https://github.com/user/repo.git" : "https://example.com/app.zip"} value={sourceValue} onChange={(e) => setSourceValue(e.target.value)} /></label><Button disabled={!sourceValue.trim()} className="mt-5" type="submit"><Play />Preview deployment</Button></form></section>
      <section className="min-w-0"><h2 className="mb-5 flex items-center gap-2 font-display text-lg font-semibold"><FileCode2 className="size-5 text-warning" />Docker Compose</h2><label className="block space-y-2 text-sm"><span>Compose configuration</span><textarea aria-label="Compose configuration" rows={10} spellCheck={false} className={cn(inputCls, "h-auto py-3 font-mono text-xs leading-6")} value={compose} onChange={(e) => setCompose(e.target.value)} /></label><Button className="mt-5" disabled={!compose.trim()} onClick={() => preview("Compose stack")}><Play />Preview Compose</Button></section>
    </div>}

    <Dialog open={details !== null} onOpenChange={(open) => { if (!open) setDetails(null); }}><DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">{details && <><DialogHeader><DialogTitle>{details.name}</DialogTitle><DialogDescription>{details.description}</DialogDescription></DialogHeader><Pill tone="muted">Demo · Sample versions</Pill><dl className="grid grid-cols-2 gap-4 border-y border-border py-4 text-sm"><div><dt className="text-muted-foreground">Category</dt><dd className="mt-1">{details.category}</dd></div><div><dt className="text-muted-foreground">Runtime</dt><dd className="mt-1">{details.runtime}</dd></div><div><dt className="text-muted-foreground">Default port</dt><dd className="mt-1 font-mono">{details.port}</dd></div><div><dt className="text-muted-foreground">Available versions</dt><dd className="mt-1">{details.versions.length} sample versions</dd></div></dl><AppVersionActions key={details.name} name={details.name} versions={details.versions} /></>}</DialogContent></Dialog>
    <Dialog open={remove !== null} onOpenChange={(open) => { if (!open) setRemove(null); }}><DialogContent className="w-[calc(100%-2rem)] rounded-lg"><DialogHeader><DialogTitle>Remove application preview?</DialogTitle><DialogDescription>{remove} will be removed from this demo list only. No installed software or data will be deleted.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemove(null)}>Cancel</Button><Button variant="destructive" onClick={() => { setInstalled((rows) => rows.filter((row) => row.id !== remove)); preview(`remove: ${remove}`); setRemove(null); }}><Trash2 />Remove preview</Button></div></DialogContent></Dialog>
  </>;
}