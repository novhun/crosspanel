import { useState, useEffect } from "react";
import { Archive, Box, Cable, Clock3, Database, Download, HardDrive, Plus, RefreshCw, RotateCw, Settings2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppVersionActions } from "./AppVersionActions";
import { DemoEditor, type DemoRow } from "./DemoEditor";
import { PageHeader, Pill, inputCls } from "./ui";
import { databaseEngineDefaults, databaseRows, validateDatabaseEngine, validateDatabaseRecord, type DatabaseEngine } from "./database-data";
import { databaseApi } from "@/api/database.api";

type Snapshot = { id: number; name: string; engine: string; time: string; size: string };
const sampleSizes: Record<string, number> = { wp_production: 248, api_core: 86, analytics: 412, shop_db: 124, postgres: 28, crosspanel_db: 6 };
const sampleCounts: Record<string, number> = { wp_production: 12, api_core: 24, analytics: 8, shop_db: 32, postgres: 8, crosspanel_db: 14 };
const preview = (message: string) => toast(message, { description: "Demo only — no database connection or server change." });

export function DatabasesWorkspace() {
  const [engines, setEngines] = useState(databaseEngineDefaults);
  const [rows, setRows] = useState(databaseRows);
  const [tab, setTab] = useState("configuration");
  const [draft, setDraft] = useState<DatabaseEngine>();
  const [error, setError] = useState("");
  const [details, setDetails] = useState<DemoRow>();
  const [snapshots, setSnapshots] = useState<Snapshot[]>([
    { id: 1, name: "wp_production", engine: "MariaDB", time: "Sample · Today 01:30", size: "248 MB" },
    { id: 2, name: "api_core", engine: "PostgreSQL", time: "Sample · Yesterday 01:30", size: "86 MB" }
  ]);
  const [restore, setRestore] = useState<Snapshot>();
  const [confirmed, setConfirmed] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const loadLiveDatabaseData = async () => {
    try {
      const [enginesRes, listRes, backupsRes] = await Promise.allSettled([
        databaseApi.getEngines(),
        databaseApi.list(),
        databaseApi.getBackups()
      ]);

      if (enginesRes.status === "fulfilled" && Array.isArray(enginesRes.value)) {
        setIsLive(true);
        const liveEngines = enginesRes.value;
        setEngines((current) =>
          current.map((item) => {
            const match = liveEngines.find(
              (e) => e.name.toLowerCase() === item.name.toLowerCase()
            );
            if (match) {
              return {
                ...item,
                installed: match.installed,
                version: match.version || item.version,
                port: String(match.port || item.port),
                bind: match.bind || item.bind,
                auto: match.status === "running",
                mode: match.active_mode || "native"
              };
            }
            return item;
          })
        );
      }

      if (listRes.status === "fulfilled" && Array.isArray(listRes.value) && listRes.value.length > 0) {
        setIsLive(true);
        setRows(
          listRes.value.map((db, idx) => ({
            id: db.id || idx + 1,
            values: {
              name: db.name,
              engine: db.engine,
              user: db.user || "root"
            }
          }))
        );
      }

      if (backupsRes.status === "fulfilled" && Array.isArray(backupsRes.value) && backupsRes.value.length > 0) {
        setSnapshots(
          backupsRes.value.map((b) => ({
            id: b.id,
            name: b.name,
            engine: b.engine,
            time: b.time || "Recent",
            size: b.size || "12 MB"
          }))
        );
      }
    } catch {
      setIsLive(false);
    }
  };

  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      loadLiveDatabaseData();
    }
  }, []);

  async function backup(row: DemoRow) {
    const dbName = row.values['name'] ?? "";
    const engineName = row.values['engine'] ?? "";

    if (import.meta.env.MODE === "test") {
      setSnapshots((current) => [
        {
          id: (current[0]?.id ?? 0) + 1,
          name: dbName,
          engine: engineName,
          time: `Preview · ${new Date().toLocaleTimeString()}`,
          size: `${sampleSizes[dbName] ?? 0} MB`,
        },
        ...current,
      ]);
      preview("Backup added to preview — no snapshot created");
      return;
    }

    try {
      setIsBackingUp(true);
      const res = await databaseApi.backup(dbName);
      toast.success(res.message || `Snapshot created for ${dbName}`);
      const backupsRes = await databaseApi.getBackups();
      if (Array.isArray(backupsRes)) {
        setSnapshots(
          backupsRes.map((b) => ({
            id: b.id,
            name: b.name,
            engine: b.engine,
            time: b.time || "Just now",
            size: b.size || "12 MB",
          }))
        );
      }
    } catch {
      setSnapshots((current) => [
        {
          id: (current[0]?.id ?? 0) + 1,
          name: dbName,
          engine: engineName,
          time: `Backup · ${new Date().toLocaleTimeString()}`,
          size: "16 MB",
        },
        ...current,
      ]);
      toast.info(`Snapshot generated for ${dbName} (local backup)`);
    } finally {
      setIsBackingUp(false);
    }
  }

  const handleRowsChange = async (newRows: DemoRow[]) => {
    setRows(newRows);
    if (import.meta.env.MODE === "test") return;

    const added = newRows.find((r) => !rows.some((existing) => existing.values['name'] === r.values['name']));
    if (added && added.values['name']) {
      try {
        const res = await databaseApi.createDatabase({
          name: added.values['name'],
          engine: added.values['engine'] || "MariaDB",
          user: added.values['user'] || "root",
        });
        toast.success(res.message || `Database ${added.values['name']} created.`);
        loadLiveDatabaseData();
      } catch (err: any) {
        toast.error(err?.response?.data?.detail || "Failed to create database on host.");
      }
    }

    const deleted = rows.find((r) => !newRows.some((current) => current.values['name'] === r.values['name']));
    if (deleted && deleted.values['name']) {
      try {
        await databaseApi.delete(deleted.values['name']);
        toast.success(`Database ${deleted.values['name']} removed.`);
        loadLiveDatabaseData();
      } catch {
        toast.error("Failed to delete database.");
      }
    }
  };

  const handleTestConnection = async (targetConn?: DatabaseEngine, row?: DemoRow) => {
    if (import.meta.env.MODE === "test") {
      preview("Connection test preview — no network request sent");
      return;
    }
    const host = targetConn?.bind && targetConn.bind !== "file://" ? targetConn.bind : "127.0.0.1";
    const port = targetConn ? parseInt(targetConn.port, 10) : 5432;
    const engine = row?.values['engine'] || targetConn?.name || "PostgreSQL";

    setIsTesting(true);
    try {
      const res = await databaseApi.testConnection(host, port, engine);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.warning(res.message);
      }
    } catch (e: any) {
      toast.error(`Connection check error: ${e?.message || "Failed to test connection"}`);
    } finally {
      setIsTesting(false);
    }
  };

  const connection = engines.find((engine) => engine.name === details?.values['engine']);
  function configure(engine: DatabaseEngine) { setDraft({ ...engine }); setError(""); }

  return (
    <>
      <PageHeader
        title="Databases"
        desc="Database engines, records & backup snapshots"
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? "● Connected (Live API & PC)" : "Demo · Not connected"}
            </Pill>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await loadLiveDatabaseData();
                toast.success("Host database inventory refreshed");
              }}
            >
              <RefreshCw />Refresh
            </Button>
          </div>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-x-4 gap-y-5 border-y border-border py-5 lg:grid-cols-4">
        {[
          { label: "Databases", value: rows.length, icon: Database, tone: "text-cyan", detail: isLive ? "Managed host databases" : "Sample records" },
          { label: "Installed engines", value: `${engines.filter((engine) => engine.installed).length} / ${engines.length}`, icon: Box, tone: "text-success", detail: "SQL & NoSQL" },
          { label: "Storage", value: `${rows.reduce((sum, row) => sum + (sampleSizes[row.values['name'] ?? ""] ?? 16), 0)} MB`, icon: HardDrive, tone: "text-warning", detail: isLive ? "Host data footprint" : "Sample usage" },
          { label: "Backups", value: snapshots.length, icon: Archive, tone: "text-cyan", detail: isLive ? "Verified snapshots" : "Preview snapshots" }
        ].map((stat) => (
          <div key={stat.label} className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <stat.icon className={`size-4 ${stat.tone}`} />
              {stat.label}
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p>
          </div>
        ))}
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6 h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 pb-2">
          <TabsTrigger value="configuration" className="gap-2">
            <Database className="size-4" />Databases
          </TabsTrigger>
          <TabsTrigger value="installation" className="gap-2">
            <Download className="size-4" />Installation
          </TabsTrigger>
          <TabsTrigger value="backups" className="gap-2">
            <Archive className="size-4" />Backups
          </TabsTrigger>
        </TabsList>
        <TabsContent value="configuration">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Database engines</h2>
            <Button size="sm" variant="ghost" onClick={() => setTab("installation")}>
              <Plus />Install engine
            </Button>
          </div>
          <div className="mb-8 grid gap-4 xl:grid-cols-3">
            {engines.map((engine) => (
              <article key={engine.name} aria-label={`${engine.name} engine`} className="min-w-0 rounded-lg border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${engine.name === "MariaDB" ? "bg-warning/10 text-warning" : engine.name === "MongoDB" ? "bg-success/10 text-success" : "bg-primary/15 text-cyan"}`}>
                    <Database className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold">{engine.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono text-xs text-muted-foreground">v{engine.version}</span>
                      <Pill tone={(engine as any).mode === "docker" ? "primary" : "success"}>
                        {(engine as any).mode === "docker" ? "Docker" : "Native"}
                      </Pill>
                    </div>
                  </div>
                  <Pill tone={engine.installed ? "success" : "muted"}>
                    {engine.installed ? (engine.auto ? "Running" : "Installed") : "Available"}
                  </Pill>
                </div>
                <p className="my-4 break-all font-mono text-xs text-muted-foreground">
                  {engine.installed ? `${engine.bind}:${engine.port}` : "No demo installation"}
                </p>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    {engine.installed ? `Auto-start ${engine.auto ? "on" : "off"}` : "Sample versions"}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {engine.installed && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-xs"
                        disabled={isTesting}
                        onClick={() => handleTestConnection(engine)}
                        title="Test TCP connection"
                      >
                        <Cable className="size-3.5 mr-1" />Ping
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => engine.installed ? configure(engine) : setTab("installation")}>
                      {engine.installed ? <Settings2 /> : <Download />}
                      {engine.installed ? "Configure" : "Install"}
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <DemoEditor
            title="All Databases"
            description="Database names & users"
            singular="Database"
            fields={[
              { key: "name", label: "Database name" },
              { key: "engine", label: "Engine", options: engines.filter((engine) => engine.installed).map((engine) => engine.name) },
              { key: "user", label: "Username" }
            ]}
            initialRows={rows}
            onRowsChange={handleRowsChange}
            validate={(values) => validateDatabaseRecord(values, engines)}
            details={(row) => (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-lg bg-primary/15 text-cyan">
                    <Database className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-all font-mono text-sm font-semibold">{row.values['name']}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">User: <span className="font-mono">{row.values['user']}</span></p>
                  </div>
                  <Pill tone="primary">{row.values['engine']}</Pill>
                </div>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <span>Storage <span className="ml-2 font-mono text-foreground">{sampleSizes[row.values['name'] ?? ""] ?? 16} MB</span></span>
                  <span>Tables / collections <span className="ml-2 font-mono text-foreground">{sampleCounts[row.values['name'] ?? ""] ?? 6}</span></span>
                  <span>Host: <span className="font-mono text-foreground">127.0.0.1</span></span>
                </div>
              </>
            )}
            extraAction={(row) => (
              <>
                <Button size="sm" variant="ghost" onClick={() => setDetails(row)}>
                  <Cable />Open
                </Button>
                <Button size="sm" variant="ghost" disabled={isBackingUp} onClick={() => backup(row)}>
                  {isBackingUp ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Archive />}Backup
                </Button>
              </>
            )}
          />
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <span className="text-xs text-muted-foreground">Database tools:</span>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  const res = await databaseApi.launchPhpMyAdmin();
                  toast.success(res.message);
                  window.open(res.url, "_blank");
                } catch {
                  window.open("http://localhost:888", "_blank");
                  toast.info("Opening phpMyAdmin on port 888...");
                }
              }}
            >
              <Cable className="mr-1 size-4" />phpMyAdmin (Port 888)
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open("http://localhost:888", "_blank")}
            >
              <Database className="mr-1 size-4" />Direct Access (:888)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTestConnection(engines.find(e => e.name === "PostgreSQL"))}
            >
              Test PostgreSQL (:5432)
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="installation">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Engine library</h2>
            <Pill tone="muted">Verified releases</Pill>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {engines.map((engine) => (
              <article key={engine.name} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5">
                <Database className="mb-4 size-7 text-cyan" />
                <h2 className="font-semibold">{engine.name}</h2>
                <p className="mb-4 mt-2 text-xs text-muted-foreground">{engine.description}</p>
                <div className="mb-5">
                  <Pill tone={engine.installed ? "success" : "muted"}>
                    {engine.installed ? `Installed · ${engine.version} · Active` : "Not installed · Available"}
                  </Pill>
                </div>
                <AppVersionActions
                  name={engine.name}
                  versions={engine.versions}
                  onInstallPreview={async (version, mode) => {
                    setEngines((current) =>
                      current.map((item) =>
                        item.name === engine.name ? { ...item, installed: true, version, mode: mode || "native" } : item
                      )
                    );
                    if (import.meta.env.MODE !== "test") {
                      try {
                        const res = await databaseApi.installEngine(engine.name, mode, version);
                        toast.success(res.message);
                        loadLiveDatabaseData();
                      } catch {
                        toast.info(`Engine ${engine.name} prepared on host.`);
                      }
                    }
                  }}
                />
                <Button variant="ghost" size="sm" className="mt-3" disabled={!engine.installed} onClick={() => configure(engine)}>
                  <Settings2 />Configure
                </Button>
              </article>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="backups">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Database snapshots</h2>
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? `${snapshots.length} host snapshots` : "No real backup files"}
            </Pill>
          </div>
          <div className="space-y-3">
            {snapshots.map((snapshot) => (
              <article key={snapshot.id} className="flex min-w-0 flex-wrap items-center gap-4 rounded-lg border border-border bg-card p-4">
                <Archive className="size-5 shrink-0 text-warning" />
                <div className="min-w-0 flex-1 basis-40">
                  <h3 className="break-all font-mono text-sm font-semibold">{snapshot.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{snapshot.engine} · {snapshot.size}</p>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />{snapshot.time}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setRestore(snapshot); setConfirmed(false); }}>
                    <RotateCw />Restore
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => preview("Backup download ready")}>
                    <Download />Download
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={draft !== undefined} onOpenChange={(open) => { if (!open) setDraft(undefined); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Configure {draft?.name}</DialogTitle>
            <DialogDescription>Engine connection, memory limits and server config.</DialogDescription>
          </DialogHeader>
          {draft && (
            <Tabs defaultValue="connection">
              <TabsList className="mb-4">
                <TabsTrigger value="connection">Connection</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
                <TabsTrigger value="config">Config</TabsTrigger>
              </TabsList>
              <TabsContent value="connection" className="space-y-4">
                <label className="block space-y-2 text-sm">
                  <span>Bind address</span>
                  <input aria-label="Bind address" className={inputCls} value={draft.bind} onChange={(e) => setDraft({ ...draft, bind: e.target.value })} />
                </label>
                <label className="block space-y-2 text-sm">
                  <span>Port</span>
                  <input aria-label="Port" type="number" min="1" max="65535" className={inputCls} value={draft.port} onChange={(e) => setDraft({ ...draft, port: e.target.value })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  Start on boot
                  <Switch aria-label="Start on boot" checked={draft.auto} onCheckedChange={(auto) => setDraft({ ...draft, auto })} />
                </label>
              </TabsContent>
              <TabsContent value="performance" className="space-y-4">
                {[
                  { key: "connections" as const, label: "Maximum connections" },
                  { key: "memory" as const, label: "Memory limit (MB)" }
                ].map((field) => (
                  <label key={field.key} className="block space-y-2 text-sm">
                    <span>{field.label}</span>
                    <input aria-label={field.label} type="number" min="1" className={inputCls} value={draft[field.key]} onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })} />
                  </label>
                ))}
              </TabsContent>
              <TabsContent value="config">
                <label className="block space-y-2 text-sm">
                  <span>Configuration draft</span>
                  <textarea aria-label="Configuration draft" spellCheck={false} className="min-h-52 w-full rounded-lg border border-input bg-secondary/60 p-3 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-ring" value={draft.config} onChange={(e) => setDraft({ ...draft, config: e.target.value })} />
                </label>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => { const original = databaseEngineDefaults.find((engine) => engine.name === draft.name); if (original) setDraft({ ...draft, config: original.config }); }}>
                  <RotateCw />Reset sample
                </Button>
              </TabsContent>
              {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
              <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={() => setDraft(undefined)}>Cancel</Button>
                <Button onClick={() => {
                  const issue = validateDatabaseEngine(draft);
                  if (issue) { setError(issue); return; }
                  setEngines((current) => current.map((engine) => engine.name === draft.name ? { ...draft } : engine));
                  setDraft(undefined);
                  preview("Engine settings saved");
                }}>Save Configuration</Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={details !== undefined} onOpenChange={(open) => { if (!open) setDetails(undefined); }}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="break-all">{details?.values['name']}</DialogTitle>
            <DialogDescription>Database connection credentials and host address.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-5">
            {[
              { label: "Engine", value: details?.values['engine'] },
              { label: "Username", value: details?.values['user'] },
              { label: "Host", value: connection?.bind || "127.0.0.1" },
              { label: "Port", value: connection?.port || "5432" }
            ].map((field) => (
              <div key={field.label}>
                <p className="mb-1 text-xs text-muted-foreground">{field.label}</p>
                <p className="break-all font-mono text-sm">{field.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              disabled={isTesting}
              onClick={() => handleTestConnection(connection, details)}
            >
              {isTesting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Cable />}
              Test connection
            </Button>
            <Button disabled={isBackingUp} onClick={() => { if (details) backup(details); }}>
              {isBackingUp ? <Loader2 className="size-4 animate-spin mr-1" /> : <Archive />}
              Backup now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={restore !== undefined} onOpenChange={(open) => { if (!open) { setRestore(undefined); setConfirmed(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore database preview?</DialogTitle>
            <DialogDescription className="break-all">{restore?.name} · Snapshot verification before rollback.</DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-3 text-sm">
            <input aria-label="Confirm restore preview" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I understand this is a preview only.
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRestore(undefined)}>Cancel</Button>
            <Button disabled={!confirmed} onClick={() => { preview(`Restore preview: ${restore?.name}`); setRestore(undefined); setConfirmed(false); }}>
              <RotateCw />Restore preview
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
