import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Archive, Plus, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, inputCls } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/backups")({ head: () => meta("Backup & Restore", "Manage CrossPanel backup snapshots and preview restore operations."), component: Page });
type Backup = { id: number; name: string; scope: string; date: string; size: string };
function Page() {
  const [backups, setBackups] = useState<Backup[]>([
    { id: 1, name: "Full server snapshot", scope: "Full system", date: "2026-11-18 02:00 UTC", size: "2.4 GB" },
    { id: 2, name: "WordPress files", scope: "Website files", date: "2026-11-17 02:00 UTC", size: "640 MB" },
    { id: 3, name: "Production databases", scope: "Databases", date: "2026-11-16 02:00 UTC", size: "180 MB" },
  ]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("Full system");
  const [selected, setSelected] = useState<Backup | undefined>();
  const [action, setAction] = useState<"restore" | "delete">("restore");
  const [confirmed, setConfirmed] = useState(false);
  function create(event: FormEvent) { event.preventDefault(); setBackups((current) => [{ id: Date.now(), name: name.trim(), scope, date: new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC", size: "Demo snapshot" }, ...current]); setOpen(false); toast("Backup added to preview — no files copied"); }
  return <>
    <PageHeader title="Backup & Restore" desc="Snapshots & recovery" action={<Button onClick={() => { setName(""); setOpen(true); }}><Plus />Create Backup</Button>} />
    <div className="mb-6 flex flex-wrap gap-5 border-y border-border py-4 text-sm"><span><strong className="text-cyan">{backups.length}</strong> Snapshots</span><span>Storage: Local server</span><Pill tone="muted">Demo · Not connected</Pill></div>
    <div className="space-y-3">{backups.map((b) => <article key={b.id} className="min-w-0 rounded-lg border border-border bg-card p-5"><div className="flex flex-wrap items-start gap-3"><Archive className="h-5 w-5 shrink-0 text-cyan" /><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{b.name}</h2><p className="mt-1 text-xs text-muted-foreground">{b.date}</p></div><Pill tone="primary">{b.scope}</Pill></div><p className="my-4 text-sm text-muted-foreground">{b.size}</p><div className="flex gap-2 border-t border-border pt-3"><Button variant="outline" size="sm" onClick={() => { setSelected(b); setAction("restore"); setConfirmed(false); }}><RotateCcw />Restore</Button><Button variant="ghost" size="icon" className="ml-auto text-destructive" aria-label={`Delete ${b.name}`} title="Delete backup" onClick={() => { setSelected(b); setAction("delete"); }}><Trash2 /></Button></div></article>)}</div>
    {backups.length === 0 && <p className="py-12 text-center text-muted-foreground">No backup snapshots.</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Create Backup</DialogTitle><DialogDescription>Demo snapshot · No server data copied</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={create}><label className="block space-y-2 text-sm"><span>Backup name</span><input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="block space-y-2 text-sm"><span>Backup scope</span><select className={inputCls} value={scope} onChange={(e) => setScope(e.target.value)}>{["Full system", "Website files", "Databases", "Panel configuration"].map((s) => <option key={s}>{s}</option>)}</select></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Create Backup</Button></div></form></DialogContent></Dialog>
    <Dialog open={selected !== undefined} onOpenChange={(value) => { if (!value) setSelected(undefined); }}><DialogContent><DialogHeader><DialogTitle>{action === "restore" ? "Restore Backup?" : "Delete Backup?"}</DialogTitle><DialogDescription>{selected?.name} · {action === "restore" ? "Demo restore only — server data will not change." : "Remove this snapshot from the preview."}</DialogDescription></DialogHeader>{action === "restore" && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />Confirm restore preview</label>}<div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setSelected(undefined)}>Cancel</Button><Button variant={action === "delete" ? "destructive" : "default"} disabled={action === "restore" && !confirmed} onClick={() => { if (action === "delete") setBackups((current) => current.filter((b) => b.id !== selected?.id)); else toast(`Demo restore: ${selected?.name}`, { description: "No data restored — API not connected." }); setSelected(undefined); }}>{action === "restore" ? "Restore Backup" : "Delete Backup"}</Button></div></DialogContent></Dialog>
  </>;
}