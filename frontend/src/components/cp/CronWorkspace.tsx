import { useRef, useState, type FormEvent } from "react";
import { Clock, Code2, Download, Upload, MessageSquare, Plus, Pencil, Play, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DemoEditor, type DemoRow } from "./DemoEditor";
import { PageHeader, Pill, inputCls } from "./ui";
import { cycles, initialTasks, newTask, parseTaskImport, prohibitedCommands, scheduleLabel, validateTask, type CronTask, type Cycle } from "./cron-data";

const scripts: DemoRow[] = [
  { id: 1, enabled: true, values: { name: "Daily backup", content: "/usr/local/bin/backup.sh" } },
  { id: 2, enabled: true, values: { name: "Clear application cache", content: "php /var/www/app/artisan cache:clear" } },
  { id: 3, enabled: true, values: { name: "Disk report", content: "df -h" } },
];

export function CronWorkspace() {
  const [tab, setTab] = useState("scheduling");
  const [tasks, setTasks] = useState(initialTasks);
  const [form, setForm] = useState(newTask);
  const [editing, setEditing] = useState<number>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All categories");
  const [picker, setPicker] = useState(false);
  const [library, setLibrary] = useState(scripts);
  const [removing, setRemoving] = useState<CronTask>();
  const [feedback, setFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const formSection = useRef<HTMLElement>(null);
  const visibleTasks = tasks.filter(task => task.name.toLowerCase().includes(query.toLowerCase()) && (category === "All categories" || task.cycle === category));

  function save(event: FormEvent) {
    event.preventDefault();
    const invalid = validateTask(form);
    if (invalid) { setError(invalid); return; }
    setTasks(current => editing === undefined ? [...current, { ...form, id: Date.now() }] : current.map(task => task.id === editing ? { ...form, id: editing } : task));
    toast(editing === undefined ? "Task added in preview" : "Task updated in preview", { description: "No schedule or command is executed." });
    setForm(newTask()); setEditing(undefined); setError("");
  }
  function exportTasks() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ app: "CrossPanel", demo: true, tasks }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "crosspanel-demo-cron-tasks.json"; link.click(); URL.revokeObjectURL(url);
    toast("Demo task list exported");
  }
  return <>
    <PageHeader title="Cron Job" desc="Scheduled tasks & commands" action={<Pill tone="muted">Demo · Not connected</Pill>} />
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="mb-6 flex h-auto w-fit max-w-full flex-wrap">
        <TabsTrigger value="scheduling"><Clock className="mr-2 h-4 w-4" />Task Scheduling</TabsTrigger>
        <TabsTrigger value="library"><Code2 className="mr-2 h-4 w-4" />Script library</TabsTrigger>
      </TabsList>
      <TabsContent value="scheduling" className="space-y-8">
        <section ref={formSection} className="min-w-0 border-b border-border pb-7">
          <h2 className="mb-5 font-display text-lg font-semibold">{editing === undefined ? "Add Task" : "Edit Task"}</h2>
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="space-y-2 text-sm"><span className="block">Task type</span><select aria-label="Task type" className={inputCls} value={form.type} onChange={() => {}}><option>Shell Script</option></select></label>
              <label className="space-y-2 text-sm md:col-span-1 xl:col-span-2"><span className="block">Task name</span><input required className={inputCls} placeholder="Please enter task name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
              <label className="space-y-2 text-sm"><span className="block">Execute cycle</span><select className={inputCls} value={form.cycle} onChange={e => { setForm({ ...form, cycle: e.target.value as Cycle, day: "1" }); setError(""); }}>{cycles.map(cycle => <option key={cycle}>{cycle}</option>)}</select></label>
              <label className="space-y-2 text-sm"><span className="block">Execute user</span><input required className={inputCls} value={form.user} onChange={e => setForm({ ...form, user: e.target.value })} /></label>
              <label className="space-y-2 text-sm"><span className="block">Timezone</span><select className={inputCls} value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>{["UTC", "Asia/Phnom_Penh", "Asia/Bangkok", "Asia/Singapore", "Europe/London", "America/New_York"].map(zone => <option key={zone}>{zone}</option>)}</select></label>
            </div>
            {form.cycle === "Weekly" && <label className="block max-w-sm space-y-2 text-sm"><span>Weekday</span><select className={inputCls} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })}>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>}
            {form.cycle === "Monthly" && <label className="block max-w-sm space-y-2 text-sm"><span>Day of month</span><input type="number" min="1" max="31" required className={inputCls} value={form.day} onChange={e => setForm({ ...form, day: e.target.value })} /></label>}
            <div className="flex flex-wrap items-center gap-3">
              {form.times.map((time, index) => <div key={index} className="flex items-center gap-2"><label className="text-sm"><span className="sr-only">Execution time {index + 1}</span><input aria-label={`Execution time ${index + 1}`} type="time" required className={`${inputCls} w-36`} value={time} onChange={e => setForm({ ...form, times: form.times.map((t, i) => i === index ? e.target.value : t) })} /></label>{index > 0 && <Button type="button" variant="ghost" size="icon" aria-label={`Remove execution time ${index + 1}`} title="Remove execution time" onClick={() => setForm({ ...form, times: form.times.filter((_, i) => i !== index) })}><Trash2 /></Button>}</div>)}
              <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, times: [...form.times, "13:30"] })}><Plus />Multiple executions</Button>
              <span className="text-sm text-cyan">{scheduleLabel(form)}</span>
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><label htmlFor="cron-script" className="text-sm">Script content</label><Button type="button" size="sm" variant="outline" onClick={() => setPicker(true)}><Code2 />Select script</Button></div>
              <textarea id="cron-script" required placeholder="Please enter script content" className={`${inputCls} h-36 resize-y py-3 font-mono`} value={form.script} onChange={e => setForm({ ...form, script: e.target.value })} />
            </div>
            <div className="flex items-start gap-3 border-l-2 border-warning bg-warning/10 p-4 text-sm text-warning"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /><p className="min-w-0">To ensure the security and stability of the server, the following commands should not be used in shell scripts: <span className="break-words font-mono">{prohibitedCommands.join(", ")}</span></p></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2"><Button type="submit"><Plus />{editing === undefined ? "Add Task" : "Save Task"}</Button>{editing !== undefined && <Button type="button" variant="outline" onClick={() => { setForm(newTask()); setEditing(undefined); setError(""); }}>Cancel</Button>}</div>
          </form>
        </section>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">Task Lists <span className="ml-2 text-sm text-muted-foreground">{tasks.length}</span></h2><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}><Upload />Import</Button><Button variant="outline" size="sm" onClick={exportTasks}><Download />Export</Button><Button variant="ghost" size="sm" onClick={() => setFeedback(true)}><MessageSquare />Feedback</Button></div></div>
          <input ref={fileInput} type="file" accept=".json,application/json" aria-label="Import task file" className="hidden" onChange={async e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return; try { if (file.size > 1_000_000) throw new Error("Choose a file smaller than 1 MB."); const imported = parseTaskImport(await file.text()); setTasks(current => [...current, ...imported]); toast(`${imported.length} tasks imported in preview`); } catch (cause) { toast.error(cause instanceof Error ? cause.message : "Unable to import tasks."); } }} />
          <div className="mb-5 flex flex-wrap gap-3"><select aria-label="Task category" className={`${inputCls} w-full sm:w-48`} value={category} onChange={e => setCategory(e.target.value)}>{["All categories", ...cycles].map(c => <option key={c}>{c}</option>)}</select><input aria-label="Search tasks" placeholder="Task name or Fuzzy search" className={`${inputCls} max-w-md`} value={query} onChange={e => setQuery(e.target.value)} /></div>
          <div className="space-y-3">{visibleTasks.map(task => <article key={task.id} className="min-w-0 rounded-lg border border-border bg-card p-4"><div className="flex items-start gap-3"><Clock className="mt-1 h-5 w-5 shrink-0 text-cyan" /><div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{task.name}</h3><p className="mt-1 break-words text-xs text-muted-foreground">{task.type} · {scheduleLabel(task)} · {task.user} · {task.timezone}</p></div><Pill tone={task.enabled ? "success" : "muted"}>{task.enabled ? "Enabled" : "Paused"}</Pill></div><pre className="mt-3 whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 font-mono text-xs">{task.script}</pre><div className="mt-3 flex flex-wrap items-center gap-2"><Button variant="outline" size="sm" onClick={() => { setForm({ ...task, times: [...task.times] }); setEditing(task.id); setError(""); formSection.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }}><Pencil />Edit</Button><Button variant="ghost" size="sm" disabled={!task.enabled} onClick={() => toast(`Demo run: ${task.name}`, { description: "No command executed — API not connected." })}><Play />Run Now</Button><label className="flex items-center gap-2 text-xs"><input type="checkbox" aria-label={`Enable ${task.name}`} checked={task.enabled} onChange={e => setTasks(current => current.map(t => t.id === task.id ? { ...t, enabled: e.target.checked } : t))} />Enabled</label><Button variant="ghost" size="icon" className="ml-auto text-destructive" aria-label={`Delete ${task.name}`} title="Delete task" onClick={() => setRemoving(task)}><Trash2 /></Button></div></article>)}</div>
          {visibleTasks.length === 0 && <p className="py-10 text-center text-muted-foreground">No matching tasks.</p>}
        </section>
      </TabsContent>
      <TabsContent value="library" forceMount className={tab !== "library" ? "hidden" : ""}>
        <DemoEditor title="Script library" description="Sample shell scripts" singular="Script" fields={[{ key: "name", label: "Script name" }, { key: "content", label: "Script content", type: "textarea", placeholder: "Please enter script content" }]} initialRows={scripts} onRowsChange={setLibrary} validate={values => validateTask({ ...newTask(), name: values['name'] ?? "", script: values['content'] ?? "" })} details={row => <><h2 className="break-words font-semibold">{row.values['name']}</h2><pre className="mt-3 whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 font-mono text-xs">{row.values['content']}</pre></>} extraAction={row => <Button size="sm" variant="ghost" disabled={!row.enabled} onClick={() => { setForm(current => ({ ...current, script: row.values['content'] ?? "" })); setTab("scheduling"); }}><Code2 />Select script</Button>} />
      </TabsContent>
    </Tabs>
    <Dialog open={picker} onOpenChange={setPicker}><DialogContent><DialogHeader><DialogTitle>Select script</DialogTitle><DialogDescription>Script library · Demo</DialogDescription></DialogHeader><div className="max-h-96 space-y-2 overflow-y-auto">{library.filter(s => s.enabled).map(script => <Button key={script.id} variant="outline" className="h-auto w-full justify-start whitespace-normal py-3 text-left" onClick={() => { setForm({ ...form, script: script.values['content'] ?? "" }); setPicker(false); }}><Code2 className="shrink-0" /><span className="min-w-0 break-words">{script.values['name']}</span></Button>)}{library.filter(s => s.enabled).length === 0 && <p className="text-sm text-muted-foreground">No enabled scripts.</p>}</div></DialogContent></Dialog>
    <Dialog open={removing !== undefined} onOpenChange={open => { if (!open) setRemoving(undefined); }}><DialogContent><DialogHeader><DialogTitle>Delete Task?</DialogTitle><DialogDescription className="break-words">{removing?.name} · Preview only</DialogDescription></DialogHeader><div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setRemoving(undefined)}>Cancel</Button><Button variant="destructive" onClick={() => { setTasks(current => current.filter(t => t.id !== removing?.id)); setRemoving(undefined); }}>Delete Task</Button></div></DialogContent></Dialog>
    <Dialog open={feedback} onOpenChange={open => { setFeedback(open); if (!open) setFeedbackText(""); }}><DialogContent><DialogHeader><DialogTitle>Feedback</DialogTitle><DialogDescription>Demo · Feedback is not sent</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={e => { e.preventDefault(); toast("Feedback preview completed", { description: "Nothing was sent." }); setFeedback(false); setFeedbackText(""); }}><textarea required aria-label="Feedback message" placeholder="Your feedback" className={`${inputCls} h-32 py-3`} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} /><Button type="submit"><MessageSquare />Preview feedback</Button></form></DialogContent></Dialog>
  </>;
}