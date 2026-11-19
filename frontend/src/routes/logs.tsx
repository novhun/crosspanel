import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Server, ServerCog, Globe, Search, RotateCw, Download, Copy, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, inputCls } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { meta } from "@/components/cp/meta";
import { filterLogs, logSources, sampleLogs, type LogCategory, type LogEntry } from "@/components/cp/log-data";

export const Route = createFileRoute("/logs")({
  head: () => meta("Logs", "Browse CrossPanel system, service and website log previews with source filters and detailed events."),
  component: LogsPage,
});
const categories = [{ name: "System", icon: Server }, { name: "Service", icon: ServerCog }, { name: "Website", icon: Globe }] as const;
const tone = { Info: "primary", Warning: "warning", Error: "danger" } as const;
function LogsPage() {
  const [category, setCategory] = useState<LogCategory>("System");
  const [source, setSource] = useState("All");
  const [level, setLevel] = useState("All");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState(sampleLogs);
  const [selected, setSelected] = useState<LogEntry>();
  const visible = filterLogs(entries, category, source, level, query).slice().reverse();
  const scoped = entries.filter(entry => entry.category === category && (source === "All" || entry.source === source));
  const text = visible.map(entry => `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.source}: ${entry.message}`).join("\n");
  function refresh() {
    const nextSource = source === "All" ? logSources[category][0] : source;
    if (!nextSource) return;
    setEntries(current => [...current, { id: Math.max(...current.map(entry => entry.id)) + 1, time: new Date().toLocaleTimeString("en-GB", { timeZone: "UTC" }), category, source: nextSource, level: "Info", message: "Sample log refresh completed", detail: "Demo event only. No system, service or website was contacted." }]);
    toast("Sample logs refreshed", { description: "Demo only — API not connected" });
  }
  function download() {
    const url = URL.createObjectURL(new Blob([`CrossPanel DEMO logs — not collected from a server\n${text}\n`], { type: "text/plain" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crosspanel-demo-${category.toLowerCase()}-logs.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  return <>
    <PageHeader title="Logs" desc="System, services & website events" action={<Pill tone="muted">Demo · Not connected</Pill>} />
    <div className="flex flex-wrap gap-2 border-b border-border pb-4" role="tablist" aria-label="Log categories">
      {categories.map(item => <Button key={item.name} role="tab" aria-selected={category === item.name} variant={category === item.name ? "default" : "outline"} onClick={() => { setCategory(item.name); setSource("All"); }}><item.icon />{item.name}</Button>)}
    </div>
    <div className="my-5 flex flex-wrap gap-x-6 gap-y-3 text-sm">
      <span><strong className="text-cyan">{scoped.length}</strong> Events</span>
      <span><strong className="text-warning">{scoped.filter(entry => entry.level === "Warning").length}</strong> Warnings</span>
      <span><strong className="text-destructive">{scoped.filter(entry => entry.level === "Error").length}</strong> Errors</span>
    </div>
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_2fr_auto]">
      <label className="space-y-1.5 text-xs text-muted-foreground"><span>{category === "Website" ? "Project website" : `${category} source`}</span><select className={inputCls} aria-label="Log source" value={source} onChange={event => setSource(event.target.value)}><option value="All">All sources</option>{logSources[category].map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="space-y-1.5 text-xs text-muted-foreground"><span>Level</span><select className={inputCls} aria-label="Log level" value={level} onChange={event => setLevel(event.target.value)}>{["All", "Info", "Warning", "Error"].map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="space-y-1.5 text-xs text-muted-foreground"><span>Search</span><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4" /><input className={`${inputCls} pl-9`} aria-label="Search logs" placeholder="Search events..." value={query} onChange={event => setQuery(event.target.value)} /></div></label>
      <div className="flex items-end gap-2"><Button variant="outline" size="icon" aria-label="Refresh sample logs" title="Refresh sample logs" onClick={refresh}><RotateCw /></Button><Button variant="outline" size="icon" aria-label="Download sample logs" title="Download sample logs" disabled={!visible.length} onClick={download}><Download /></Button></div>
    </div>
    <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><h2 className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4 text-cyan" />{category} Logs</h2><span className="text-xs text-muted-foreground">{visible.length} events · Newest first</span></div>
      <div className="divide-y divide-border">
        {visible.map(entry => <div key={entry.id} className="flex items-start gap-3 p-4 hover:bg-accent/30">
          <div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><span className="font-mono text-xs text-muted-foreground">{entry.time}</span><Pill tone={tone[entry.level]}>{entry.level}</Pill><span className="break-all text-xs text-muted-foreground">{entry.source}</span></div><p className="break-words font-mono text-xs leading-6 sm:text-sm">{entry.message}</p></div>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label={`View event ${entry.id}`} title="View event" onClick={() => setSelected(entry)}><ChevronRight /></Button>
        </div>)}
        {!visible.length && <div className="py-16 text-center"><FileText className="mx-auto mb-3 h-6 w-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No matching log events.</p><Button className="mt-3" variant="ghost" onClick={() => { setQuery(""); setSource("All"); setLevel("All"); }}>Reset filters</Button></div>}
      </div>
    </section>
    <Dialog open={selected !== undefined} onOpenChange={open => { if (!open) setSelected(undefined); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>Log Event</DialogTitle><DialogDescription>Sample {selected?.category.toLowerCase()} output · Not connected</DialogDescription></DialogHeader>{selected && <><div className="flex flex-wrap items-center gap-2"><Pill tone={tone[selected.level]}>{selected.level}</Pill><span className="break-all text-xs text-muted-foreground">{selected.source} · {selected.time}</span></div><p className="break-words text-sm font-semibold">{selected.message}</p><pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-secondary p-4 font-mono text-xs leading-6">{selected.detail}</pre><Button variant="outline" onClick={async () => { try { await navigator.clipboard.writeText(`${selected.message}\n${selected.detail}`); toast("Sample event copied"); } catch { toast.error("Could not copy this event"); } }}><Copy />Copy Event</Button></>}</DialogContent></Dialog>
  </>;
}