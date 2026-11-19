import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Users, Plus, Pencil, Trash2, LayoutDashboard, HardDrive, Globe, Database, Search } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Pill, inputCls } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { meta } from "@/components/cp/meta";
import { accountResources, availableResources, canAddSubAccount, initialSubAccounts, PRO_SUB_ACCOUNT_LIMIT, quotaError, type SubAccount } from "@/components/cp/sub-account-data";

export const Route = createFileRoute("/sub-accounts")({
  head: () => meta("Sub Accounts", "CrossPanel Pro sub-account previews with up to 100 users, resource quotas and separate allocated-resource user areas."),
  component: SubAccountsPage,
});
const blank: SubAccount = { id: 0, name: "", email: "", enabled: true, disk: 10, traffic: 50, sites: 2, databases: 2, usedDisk: 0, usedTraffic: 0, resources: [] };
function SubAccountsPage() {
  const [accounts, setAccounts] = useState(initialSubAccounts);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [form, setForm] = useState<SubAccount>();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<SubAccount>();
  const [area, setArea] = useState<SubAccount>();
  const visible = accounts.filter(a => `${a.name} ${a.email}`.toLowerCase().includes(query.toLowerCase()) && (status === "All" || a.enabled === (status === "Active")));
  function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.id && !canAddSubAccount(accounts.length)) { setError("Pro supports a maximum of 100 sub-accounts."); return; }
    const validation = quotaError(form);
    if (validation) { setError(validation); return; }
    if (accounts.some(a => a.id !== form.id && a.email.toLowerCase() === form.email.trim().toLowerCase())) { setError("This email already has a sub-account."); return; }
    const saved = { ...form, name: form.name.trim(), email: form.email.trim() };
    setAccounts(current => form.id ? current.map(a => a.id === form.id ? saved : a) : [...current, { ...saved, id: Date.now() }]);
    setForm(undefined);
    toast("Sub-account saved in preview", { description: "Demo only — no login, access permissions or real quotas were created." });
  }
  return <>
    <PageHeader title="Sub Accounts" desc="Multiple users · Resource quotas · Separate user areas" action={<Button disabled={!canAddSubAccount(accounts.length)} onClick={() => { setError(""); setForm({ ...blank }); }}><Plus />Add Sub Account</Button>} />
    <div className="mb-6 flex flex-wrap items-center gap-3 border-y border-border py-4"><Pill tone="primary">Pro edition · Preview</Pill><span className="text-sm"><strong className="font-mono text-cyan">{accounts.length} / {PRO_SUB_ACCOUNT_LIMIT}</strong> sub-accounts</span><span className="text-xs text-muted-foreground">Each account manages its allocated resources independently.</span><Pill tone="muted">Demo · Not connected</Pill></div>
    <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">{[{ label: "Available accounts", value: PRO_SUB_ACCOUNT_LIMIT - accounts.length }, { label: "Active accounts", value: accounts.filter(a => a.enabled).length }, { label: "Allocated disk", value: `${accounts.reduce((sum, a) => sum + a.disk, 0)} GB` }, { label: "Monthly traffic quota", value: `${accounts.reduce((sum, a) => sum + a.traffic, 0)} GB` }].map(item => <article key={item.label} className="rounded-lg border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 font-mono text-xl font-semibold text-cyan">{item.value}</p></article>)}</div>
    <div className="mb-5 flex flex-wrap gap-3"><label className="relative w-full max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className={`${inputCls} pl-9`} aria-label="Search sub accounts" placeholder="Search name or email..." value={query} onChange={e => setQuery(e.target.value)} /></label><select className={`${inputCls} w-auto`} aria-label="Sub account status" value={status} onChange={e => setStatus(e.target.value)}>{["All", "Active", "Suspended"].map(s => <option key={s}>{s}</option>)}</select></div>
    <div className="space-y-4">{visible.map(account => <article key={account.id} className="rounded-lg border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-3"><Users className="h-5 w-5 text-cyan" /><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold">{account.name}</h2><p className="break-all text-xs text-muted-foreground">{account.email}</p></div><Pill tone={account.enabled ? "success" : "muted"}>{account.enabled ? "Active" : "Suspended"}</Pill><Switch aria-label={`Enable ${account.name}`} checked={account.enabled} onCheckedChange={value => setAccounts(current => current.map(a => a.id === account.id ? { ...a, enabled: value } : a))} /></div>
      <div className="my-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[{ name: "Disk", used: account.usedDisk, quota: account.disk, icon: HardDrive }, { name: "Monthly traffic", used: account.usedTraffic, quota: account.traffic, icon: Globe }].map(metric => <div key={metric.name}><p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><metric.icon className="h-3.5 w-3.5" />{metric.name}</p><p className="font-mono text-sm">{metric.used} / {metric.quota} GB</p><progress className="mt-2 h-1.5 w-full [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-cyan [&::-moz-progress-bar]:bg-cyan" value={metric.used} max={metric.quota || 1} aria-label={`${account.name} ${metric.name} usage`} /></div>)}<div><p className="mb-2 text-xs text-muted-foreground">Websites</p><p className="font-mono text-sm">{accountResources(account).filter(r => r.type === "Website").length} / {account.sites}</p></div><div><p className="mb-2 text-xs text-muted-foreground">Databases</p><p className="font-mono text-sm">{accountResources(account).filter(r => r.type === "Database").length} / {account.databases}</p></div></div>
      <div className="flex flex-wrap gap-2 border-t border-border pt-3"><Button size="sm" variant="outline" onClick={() => { setError(""); setForm({ ...account }); }}><Pencil />Edit Quotas</Button><Button size="sm" variant="outline" disabled={!account.enabled} onClick={() => setArea(account)}><LayoutDashboard />User Area Preview</Button><Button size="icon" variant="ghost" className="ml-auto text-destructive" aria-label={`Delete ${account.name}`} title="Delete sub-account" onClick={() => setRemoving(account)}><Trash2 /></Button></div>
    </article>)}</div>
    {!visible.length && <p className="py-12 text-center text-muted-foreground">No matching sub-accounts.</p>}
    <Dialog open={form !== undefined} onOpenChange={open => { if (!open) setForm(undefined); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{form?.id ? "Edit Sub Account" : "Add Sub Account"}</DialogTitle><DialogDescription>Demo account and quotas · No real access granted</DialogDescription></DialogHeader>{form && <form className="space-y-4" onSubmit={save}>
      <label className="block space-y-2 text-sm"><span>Account name</span><input required className={inputCls} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="block space-y-2 text-sm"><span>Email</span><input required type="email" className={inputCls} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></label>
      <div className="grid grid-cols-2 gap-3">{([{ key: "disk", label: "Disk quota (GB)" }, { key: "traffic", label: "Monthly traffic (GB)" }, { key: "sites", label: "Website quota" }, { key: "databases", label: "Database quota" }] as const).map(field => <label key={field.key} className="space-y-2 text-xs"><span>{field.label}</span><input className={inputCls} type="number" min="0" step="1" required value={form[field.key]} onChange={e => { setError(""); setForm({ ...form, [field.key]: Number(e.target.value) }); }} /></label>)}</div>
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Allocate Resources</legend>{availableResources.map(resource => <label key={resource.name} className="flex items-start gap-2 text-xs"><input type="checkbox" className="mt-0.5 accent-primary" checked={form.resources.includes(resource.name)} onChange={e => { setError(""); setForm({ ...form, resources: e.target.checked ? [...form.resources, resource.name] : form.resources.filter(name => name !== resource.name) }); }} /><span className="break-all">{resource.name} <span className="text-muted-foreground">· {resource.type}</span></span></label>)}</fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setForm(undefined)}>Cancel</Button><Button type="submit">Save Sub Account</Button></div>
    </form>}</DialogContent></Dialog>
    <Dialog open={area !== undefined} onOpenChange={open => { if (!open) setArea(undefined); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{area?.name} · User Area</DialogTitle><DialogDescription>Separate user area preview · Not a signed-in session or enforced isolation</DialogDescription></DialogHeader>{area && <><div className="flex flex-wrap gap-2"><Pill tone="muted">Allocated resources only · Demo</Pill></div><div className="grid grid-cols-2 gap-3 border-y border-border py-4 text-xs"><span>Disk: {area.usedDisk} / {area.disk} GB</span><span>Traffic: {area.usedTraffic} / {area.traffic} GB</span></div>{accountResources(area).map(resource => <div key={resource.name} className="flex items-center gap-3 border-b border-border py-3">{resource.type === "Website" ? <Globe className="h-4 w-4 shrink-0 text-cyan" /> : <Database className="h-4 w-4 shrink-0 text-success" />}<div className="min-w-0 flex-1"><p className="break-all text-sm">{resource.name}</p><p className="text-xs text-muted-foreground">{resource.type}</p></div><Button size="sm" variant="outline" onClick={() => toast("Resource management preview", { description: `${resource.name} · API not connected` })}>Manage</Button></div>)}{!area.resources.length && <p className="text-sm text-muted-foreground">No resources allocated.</p>}</>}</DialogContent></Dialog>
    <Dialog open={removing !== undefined} onOpenChange={open => { if (!open) setRemoving(undefined); }}><DialogContent><DialogHeader><DialogTitle>Delete Sub Account?</DialogTitle><DialogDescription>Remove {removing?.name} from the preview only. Real accounts and resources are unchanged.</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(undefined)}>Cancel</Button><Button variant="destructive" onClick={() => { setAccounts(current => current.filter(a => a.id !== removing?.id)); setRemoving(undefined); }}>Delete Sub Account</Button></div></DialogContent></Dialog>
  </>;
}