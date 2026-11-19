import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PageHeader, Pill, inputCls } from "./ui";

export type DemoRow = { id: number; values: Record<string, string>; enabled: boolean };
type Field = { key: string; label: string; type?: string; options?: string[]; placeholder?: string };
export function DemoEditor({ title, description, singular, fields, initialRows, details, extraAction, validate, onRowsChange }: { title: string; description: string; singular: string; fields: Field[]; initialRows: DemoRow[]; details: (row: DemoRow) => ReactNode; extraAction?: (row: DemoRow) => ReactNode; validate?: (values: Record<string, string>) => string | undefined; onRowsChange?: (rows: DemoRow[]) => void }) {
  const [rows, setRows] = useState(initialRows);
  useEffect(() => { onRowsChange?.(rows); }, [rows, onRowsChange]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<number | undefined>();
  const [form, setForm] = useState<Record<string, string>>({});
  const [removing, setRemoving] = useState<DemoRow | undefined>();
  const [query, setQuery] = useState("");
  function save(event: FormEvent) {
    event.preventDefault();
    const error = validate?.(form);
    if (error) { toast.error(error); return; }
    setRows((current) => editing === undefined ? [...current, { id: Date.now(), values: form, enabled: true }] : current.map((r) => r.id === editing ? { ...r, values: form } : r));
    setOpen(false);
    toast(`${singular} saved in preview`);
  }
  return <>
    <PageHeader title={title} desc={description} action={<Button onClick={() => { setEditing(undefined); setForm(Object.fromEntries(fields.map((f) => [f.key, f.options?.[0] ?? ""]))); setOpen(true); }}><Plus />Add {singular}</Button>} />
    <div className="mb-5 flex flex-wrap items-center gap-3"><input aria-label={`Search ${title.toLowerCase()}`} placeholder={`Search ${title.toLowerCase()}...`} className={`${inputCls} max-w-md`} value={query} onChange={(e) => setQuery(e.target.value)} /><Pill tone="muted">Demo · Not connected</Pill></div>
    <div className="space-y-3">{rows.filter((r) => Object.values(r.values).join(" ").toLowerCase().includes(query.toLowerCase())).map((row) => <article key={row.id} className="min-w-0 rounded-lg border border-border bg-card p-5">
      {details(row)}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3"><Button size="sm" variant="outline" onClick={() => { setEditing(row.id); setForm(row.values); setOpen(true); }}><Pencil />Edit</Button><label className="mx-2 flex items-center gap-2 text-xs"><input type="checkbox" aria-label={`Enable ${row.values[fields[0]?.key ?? ""]}`} checked={row.enabled} onChange={(e) => setRows((current) => current.map((r) => r.id === row.id ? { ...r, enabled: e.target.checked } : r))} />Enabled</label>{extraAction?.(row)}<Button variant="ghost" size="icon" aria-label={`Delete ${row.values[fields[0]?.key ?? ""]}`} title={`Delete ${singular}`} className="ml-auto text-destructive" onClick={() => setRemoving(row)}><Trash2 /></Button></div>
    </article>)}</div>
    {rows.filter((r) => Object.values(r.values).join(" ").toLowerCase().includes(query.toLowerCase())).length === 0 && <p className="py-12 text-center text-muted-foreground">No matching records.</p>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing === undefined ? "Add" : "Edit"} {singular}</DialogTitle><DialogDescription>Demo configuration</DialogDescription></DialogHeader><form onSubmit={save} className="space-y-4">{fields.map((f) => <label key={f.key} className="block space-y-2 text-sm"><span>{f.label}</span>{f.options ? <select className={inputCls} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}>{f.options.map((v) => <option key={v}>{v}</option>)}</select> : f.type === "textarea" ? <textarea required placeholder={f.placeholder} className={`${inputCls} h-36 py-3 font-mono`} value={form[f.key] ?? ""} onChange={e => setForm({ ...form, [f.key]: e.target.value })} /> : <input required type={f.type ?? "text"} placeholder={f.placeholder} className={inputCls} value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}</label>)}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit">Save {singular}</Button></div></form></DialogContent></Dialog>
    <Dialog open={removing !== undefined} onOpenChange={(value) => { if (!value) setRemoving(undefined); }}><DialogContent><DialogHeader><DialogTitle>Delete {singular}?</DialogTitle><DialogDescription className="break-all">{removing?.values[fields[0]?.key ?? ""]}</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(undefined)}>Cancel</Button><Button variant="destructive" onClick={() => { setRows((current) => current.filter((r) => r.id !== removing?.id)); setRemoving(undefined); }}>Delete {singular}</Button></div></DialogContent></Dialog>
  </>;
}