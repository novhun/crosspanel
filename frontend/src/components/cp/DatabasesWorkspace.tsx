import { useState, useEffect } from "react";
import {
  Archive,
  Box,
  Cable,
  Clock3,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Link2,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Settings2,
  Square,
  SquareTerminal,
  Terminal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppVersionActions } from "./AppVersionActions";
import { XTermTerminal } from "./XTermTerminal";
import { DemoEditor, type DemoRow } from "./DemoEditor";
import { PageHeader, Pill, inputCls } from "./ui";
import { databaseEngineDefaults, databaseRows, validateDatabaseEngine, validateDatabaseRecord, type DatabaseEngine } from "./database-data";
import {
  databaseApi,
  type DatabaseAdminTool,
  type EngineActionResponse,
  type LiveDatabaseEngine,
  type ManagedDatabaseRecord,
} from "@/api/database.api";

type Snapshot = { id: number; name: string; database_name?: string | undefined; engine: string; time: string; size: string };
const isTestMode = import.meta.env.MODE === "test";
const sampleSizes: Record<string, number> = { wp_production: 248, api_core: 86, analytics: 412, shop_db: 124 };
const sampleCounts: Record<string, number> = { wp_production: 12, api_core: 24, analytics: 8, shop_db: 32 };
const preview = (message: string) => toast(message, { description: "Demo only — no database connection or server change." });

function maskConnStr(conn: string, pw?: string): string {
  if (!pw) return conn;
  const enc = encodeURIComponent(pw);
  return conn.replace(`:${enc}@`, ":••••••••@").replace(`:${pw}@`, ":••••••••@");
}

export function DatabasesWorkspace() {
  const [engines, setEngines] = useState<DatabaseEngine[]>(isTestMode ? databaseEngineDefaults : []);
  const [liveMeta, setLiveMeta] = useState<Record<string, LiveDatabaseEngine>>({});
  const [tools, setTools] = useState<DatabaseAdminTool[]>([]);
  const [toolModes, setToolModes] = useState<Record<string, "native" | "docker">>({});
  const [liveDbs, setLiveDbs] = useState<ManagedDatabaseRecord[]>([]);
  const [dbUsers, setDbUsers] = useState<Array<{ username: string; host: string; engine: string }>>([]);
  const [rows, setRows] = useState<DemoRow[]>(isTestMode ? databaseRows : []);
  const [tab, setTab] = useState("configuration");
  const [searchDb, setSearchDb] = useState("");
  const [draft, setDraft] = useState<DatabaseEngine>();
  const [error, setError] = useState("");
  const [details, setDetails] = useState<DemoRow>();
  const [liveDetails, setLiveDetails] = useState<ManagedDatabaseRecord | null>(null);
  const [revealedDbs, setRevealedDbs] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<ManagedDatabaseRecord | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(
    isTestMode
      ? [
          { id: 1, name: "wp_production", engine: "MariaDB", time: "Sample · Today 01:30", size: "248 MB" },
          { id: 2, name: "api_core", engine: "PostgreSQL", time: "Sample · Yesterday 01:30", size: "86 MB" }
        ]
      : []
  );
  const [restore, setRestore] = useState<Snapshot>();
  const [confirmed, setConfirmed] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [busyEngine, setBusyEngine] = useState<string | null>(null);
  const [busyTool, setBusyTool] = useState<string | null>(null);
  const [pkgTerminal, setPkgTerminal] = useState<{ title: string; command: string }>();

  // Real DB Login & Query Console State
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({
    engine: "MariaDB",
    host: "127.0.0.1",
    port: "3306",
    username: "root",
    password: "",
    database: "",
  });
  const [sessionConnected, setSessionConnected] = useState(false);
  const [sessionDatabases, setSessionDatabases] = useState<string[]>([]);
  const [sessionVersion, setSessionVersion] = useState("");
  const [sqlText, setSqlText] = useState("SHOW TABLES;");
  const [sqlResult, setSqlResult] = useState<{ columns: string[]; rows: string[][]; message: string } | null>(null);
  const [isRunningSql, setIsRunningSql] = useState(false);

  // Create Database + User + Password Modal
  const [createDbOpen, setCreateDbOpen] = useState(false);
  const [createDbForm, setCreateDbForm] = useState({
    name: "",
    engine: "MariaDB",
    user: "",
    password: "",
    adminUser: "root",
    adminPassword: "",
  });
  const [isCreatingDb, setIsCreatingDb] = useState(false);

  // Create DB User Modal
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserForm, setCreateUserForm] = useState({
    engine: "MariaDB",
    username: "",
    password: "",
    grantDatabase: "",
    adminUser: "root",
    adminPassword: "",
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Change DB User Password Modal
  const [changePwTarget, setChangePwTarget] = useState<{ engine: string; username: string; dbName?: string | undefined } | null>(null);
  const [changePwForm, setChangePwForm] = useState({ newPassword: "", adminUser: "root", adminPassword: "" });
  const [isUpdatingPw, setIsUpdatingPw] = useState(false);

  const loadLiveDatabaseData = async () => {
    try {
      const [enginesRes, listRes, backupsRes, toolsRes, invRes] = await Promise.allSettled([
        databaseApi.getEngines(),
        databaseApi.list(),
        databaseApi.getBackups(),
        databaseApi.getTools(),
        databaseApi.getLiveInventory(),
      ]);

      if (enginesRes.status === "fulfilled" && Array.isArray(enginesRes.value)) {
        setIsLive(true);
        const liveEngines = enginesRes.value;
        const metaMap: Record<string, LiveDatabaseEngine> = {};
        for (const le of liveEngines) {
          metaMap[le.name.toLowerCase()] = le;
        }
        setLiveMeta(metaMap);

        setEngines(() =>
          liveEngines.map((le) => {
            const def = databaseEngineDefaults.find((d) => d.name.toLowerCase() === le.name.toLowerCase());
            return {
              name: le.name,
              versions: def?.versions ?? (le.name === "Redis" ? ["7.4", "7.2"] : [le.version || "latest"]),
              version: le.version || "",
              installed: le.installed,
              port: String(le.port ?? 0),
              bind: le.bind || "127.0.0.1",
              auto: le.status === "running",
              connections: def?.connections ?? "100",
              memory: def?.memory ?? "128",
              description: le.description || le.category,
              config: def?.config ?? `# ${le.name} configuration\nbind = ${le.bind || "127.0.0.1"}\nport = ${le.port || 0}`,
            };
          })
        );
      }

      if (toolsRes.status === "fulfilled" && Array.isArray(toolsRes.value)) {
        setTools(toolsRes.value);
        setToolModes((prev) => {
          const next = { ...prev };
          for (const t of toolsRes.value) {
            if (!next[t.id]) next[t.id] = t.active_mode;
          }
          return next;
        });
      }

      if (invRes.status === "fulfilled" && invRes.value?.users) {
        setDbUsers(invRes.value.users);
      }

      if (listRes.status === "fulfilled" && Array.isArray(listRes.value)) {
        setIsLive(true);
        setLiveDbs(listRes.value);
        setRows(
          listRes.value.map((db, idx) => ({
            id: db.id || idx + 1,
            enabled: true,
            values: {
              name: db.name,
              engine: db.engine,
              user: db.user || "root"
            }
          }))
        );
      }

      if (backupsRes.status === "fulfilled" && Array.isArray(backupsRes.value)) {
        setSnapshots(
          backupsRes.value.map((b) => ({
            id: b.id,
            name: b.name,
            database_name: b.database_name,
            engine: b.engine,
            time: b.time || "Recent",
            size: b.size || "0 KB"
          }))
        );
      }
    } catch {
      setIsLive(false);
    }
  };

  useEffect(() => {
    if (!isTestMode) {
      loadLiveDatabaseData();
    }
  }, []);

  function copyText(label: string, text: string) {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied to clipboard`);
  }

  function handleEngineResponse(title: string, res: EngineActionResponse, successMsg: string) {
    if (res.requires_terminal && res.command) {
      setPkgTerminal({ title, command: res.command });
      return false;
    }
    if (res.success) {
      toast.success(res.message || successMsg);
      return true;
    }
    toast.error(res.message || `${title} failed`);
    return false;
  }

  async function installEngine(engineName: string, mode: "native" | "docker", version: string) {
    setBusyEngine(`${engineName}:install`);
    try {
      const res = await databaseApi.installEngine(engineName, mode, version);
      const ok = handleEngineResponse(
        `Install ${engineName} (${mode === "docker" ? "Docker" : "Native OS"})`,
        res,
        `${engineName} installed (${mode})`
      );
      if (ok) await loadLiveDatabaseData();
    } catch (e: any) {
      toast.error(e?.message || `Failed to install ${engineName}`);
    } finally {
      setBusyEngine(null);
    }
  }

  async function uninstallEngine(engineName: string, mode: "native" | "docker") {
    setBusyEngine(`${engineName}:uninstall`);
    try {
      const res = await databaseApi.uninstallEngine(engineName, mode);
      const ok = handleEngineResponse(
        `Uninstall ${engineName} (${mode === "docker" ? "Docker" : "Native OS"})`,
        res,
        `${engineName} uninstalled (${mode})`
      );
      if (ok) await loadLiveDatabaseData();
    } catch (e: any) {
      toast.error(e?.message || `Failed to uninstall ${engineName}`);
    } finally {
      setBusyEngine(null);
    }
  }

  async function controlEngine(engineName: string, action: "start" | "stop" | "restart", mode?: "native" | "docker") {
    setBusyEngine(`${engineName}:${action}`);
    try {
      const res = await databaseApi.controlEngine(engineName, action, mode);
      const ok = handleEngineResponse(
        `${action.toUpperCase()} ${engineName}`,
        res,
        `${engineName} ${action} completed`
      );
      if (ok) await loadLiveDatabaseData();
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action} ${engineName}`);
    } finally {
      setBusyEngine(null);
    }
  }

  async function handleToolInstall(tool: DatabaseAdminTool) {
    const mode = toolModes[tool.id] || tool.active_mode || "native";
    setBusyTool(`${tool.id}:install`);
    try {
      const res = await databaseApi.installTool(tool.id, mode, tool.port);
      if (res.success) {
        toast.success(res.message);
        await loadLiveDatabaseData();
      } else {
        toast.error(res.message || `Failed to install ${tool.name}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to install ${tool.name}`);
    } finally {
      setBusyTool(null);
    }
  }

  async function handleToolUninstall(tool: DatabaseAdminTool) {
    const mode = toolModes[tool.id] || (tool.docker_installed && !tool.native_installed ? "docker" : "native");
    setBusyTool(`${tool.id}:uninstall`);
    try {
      const res = await databaseApi.uninstallTool(tool.id, mode);
      if (res.success) {
        toast.success(res.message);
        await loadLiveDatabaseData();
      } else {
        toast.error(res.message || `Failed to uninstall ${tool.name}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to uninstall ${tool.name}`);
    } finally {
      setBusyTool(null);
    }
  }

  async function handleToolControl(tool: DatabaseAdminTool, action: "start" | "stop") {
    const mode = toolModes[tool.id] || (tool.docker_installed ? "docker" : "native");
    setBusyTool(`${tool.id}:${action}`);
    try {
      const res = await databaseApi.controlTool(tool.id, action, mode, tool.port);
      if (res.success) {
        toast.success(res.message);
        await loadLiveDatabaseData();
      } else {
        toast.error(res.message || `Failed to ${action} ${tool.name}`);
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to ${action} ${tool.name}`);
    } finally {
      setBusyTool(null);
    }
  }

  async function handleLiveLogin(e?: React.FormEvent) {
    if (e) e.preventDefault();
    try {
      const res = await databaseApi.loginSession({
        engine: loginForm.engine,
        host: loginForm.host,
        port: Number(loginForm.port) || undefined,
        username: loginForm.username,
        password: loginForm.password,
        database: loginForm.database,
      });
      setSessionConnected(true);
      setSessionDatabases(res.databases || []);
      setSessionVersion(res.version || "");
      setSqlText(
        loginForm.engine === "PostgreSQL"
          ? "SELECT datname, pg_size_pretty(pg_database_size(datname)) AS size FROM pg_database WHERE datistemplate = false;"
          : loginForm.engine === "SQLite"
          ? "SELECT name, type FROM sqlite_master;"
          : "SHOW TABLES;"
      );
      toast.success(res.message);
    } catch (err: any) {
      setSessionConnected(false);
      const detail = (err?.detail as any)?.detail || err?.message || "Login failed";
      toast.error(detail);
    }
  }

  async function handleRunSql() {
    setIsRunningSql(true);
    try {
      const res = await databaseApi.runQuery({
        engine: loginForm.engine,
        host: loginForm.host,
        port: Number(loginForm.port) || undefined,
        username: loginForm.username,
        password: loginForm.password,
        database: loginForm.database,
        query: sqlText,
      });
      setSqlResult({ columns: res.columns || [], rows: res.rows || [], message: res.message });
      toast.success(res.message);
      await loadLiveDatabaseData();
    } catch (err: any) {
      const detail = (err?.detail as any)?.detail || err?.message || "Query error";
      toast.error(detail);
    } finally {
      setIsRunningSql(false);
    }
  }

  async function handleCreateDbSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingDb(true);
    try {
      const res = await databaseApi.createDatabase({
        name: createDbForm.name.trim(),
        engine: createDbForm.engine,
        user: createDbForm.user.trim() || (createDbForm.engine === "PostgreSQL" ? "postgres" : "root"),
        password: createDbForm.password,
        admin_user: createDbForm.adminUser.trim() || undefined,
        admin_password: createDbForm.adminPassword || undefined,
      });
      toast.success(res.message);
      setCreateDbOpen(false);
      setCreateDbForm({ ...createDbForm, name: "", user: "", password: "" });
      await loadLiveDatabaseData();
      if (res.database) setLiveDetails(res.database);
    } catch (err: any) {
      const detail = (err?.detail as any)?.detail || err?.message || "Failed to create database & user";
      toast.error(detail);
    } finally {
      setIsCreatingDb(false);
    }
  }

  async function handleCreateUserSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsCreatingUser(true);
    try {
      const res = await databaseApi.createUser({
        engine: createUserForm.engine,
        username: createUserForm.username.trim(),
        password: createUserForm.password,
        grant_database: createUserForm.grantDatabase.trim() || undefined,
        admin_user: createUserForm.adminUser.trim() || undefined,
        admin_password: createUserForm.adminPassword || undefined,
      });
      toast.success(res.message);
      setCreateUserOpen(false);
      setCreateUserForm({ ...createUserForm, username: "", password: "" });
      await loadLiveDatabaseData();
    } catch (err: any) {
      const detail = (err?.detail as any)?.detail || err?.message || "Failed to create database user";
      toast.error(detail);
    } finally {
      setIsCreatingUser(false);
    }
  }

  async function handleUpdatePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!changePwTarget) return;
    setIsUpdatingPw(true);
    try {
      const res = await databaseApi.updateUserPassword({
        engine: changePwTarget.engine,
        username: changePwTarget.username,
        new_password: changePwForm.newPassword,
        database_name: changePwTarget.dbName,
        admin_user: changePwForm.adminUser.trim() || undefined,
        admin_password: changePwForm.adminPassword || undefined,
      });
      toast.success(res.message);
      setChangePwTarget(null);
      setChangePwForm({ ...changePwForm, newPassword: "" });
      await loadLiveDatabaseData();
    } catch (err: any) {
      const detail = (err?.detail as any)?.detail || err?.message || "Failed to update password";
      toast.error(detail);
    } finally {
      setIsUpdatingPw(false);
    }
  }

  async function handleDeleteLiveDb(db: ManagedDatabaseRecord) {
    try {
      const res = await databaseApi.delete(db.name);
      toast.success(res.message);
      setDeleteTarget(null);
      if (liveDetails?.name === db.name) setLiveDetails(null);
      await loadLiveDatabaseData();
    } catch (err: any) {
      const detail = (err?.detail as any)?.detail || err?.message || "Failed to delete database";
      toast.error(detail);
    }
  }

  async function backupLive(dbName: string) {
    try {
      setIsBackingUp(true);
      const res = await databaseApi.backup(dbName);
      toast.success(res.message || `Snapshot created for ${dbName}`);
      await loadLiveDatabaseData();
    } catch (err: any) {
      toast.error(err?.message || `Backup failed for ${dbName}`);
    } finally {
      setIsBackingUp(false);
    }
  }

  async function backup(row: DemoRow) {
    const dbName = row.values['name'] ?? "";
    const engineName = row.values['engine'] ?? "";

    if (isTestMode) {
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
    await backupLive(dbName);
  }

  const handleTestConnection = async (targetConn?: DatabaseEngine | { bind: string; port: string | number; name: string }) => {
    if (isTestMode) {
      preview("Connection test preview — no network request sent");
      return;
    }
    const host = targetConn?.bind && targetConn.bind !== "file://" ? targetConn.bind : "127.0.0.1";
    const port = targetConn ? Number(targetConn.port) : 5432;
    const engine = targetConn?.name || "PostgreSQL";

    setIsTesting(true);
    try {
      const res = await databaseApi.testConnection(host, port, engine);
      if (res.success) toast.success(res.message);
      else toast.warning(res.message);
    } catch (e: any) {
      const detail = (e?.detail as any)?.detail || e?.message || "Failed to test connection";
      toast.error(detail);
    } finally {
      setIsTesting(false);
    }
  };

  const connection = engines.find((engine) => engine.name === details?.values['engine']);
  function configure(engine: DatabaseEngine) { setDraft({ ...engine }); setError(""); }
  const firstOs = Object.values(liveMeta)[0]?.os_type;
  const osBadge = firstOs ? ` · ${firstOs.toUpperCase()}` : "";

  const totalDbCount = isTestMode ? rows.length : liveDbs.length;
  const totalStorageMb = isTestMode
    ? rows.reduce((sum, row) => sum + (sampleSizes[row.values['name'] ?? ""] ?? 16), 0)
    : Number(liveDbs.reduce((sum, db) => sum + (db.size_mb || 0), 0).toFixed(2));

  const filteredLiveDbs = liveDbs.filter((d) =>
    `${d.name} ${d.engine} ${d.user}`.toLowerCase().includes(searchDb.trim().toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Databases"
        desc="Native & Docker engines, web admin UIs (phpMyAdmin / pgAdmin / Adminer), DB passwords & connection strings"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? `● Connected (Live OS${osBadge})` : isTestMode ? "Demo · Not connected" : "● Connecting..."}
            </Pill>
            {!isTestMode && (
              <>
                <Button size="sm" onClick={() => setCreateDbOpen(true)}>
                  <Plus />Create DB &amp; User
                </Button>
                <Button size="sm" variant="outline" onClick={() => setCreateUserOpen(true)}>
                  <UserPlus />Create User
                </Button>
                <Button size="sm" variant="outline" onClick={() => setLoginModalOpen(true)}>
                  <KeyRound />Login / SQL Console
                </Button>
              </>
            )}
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
          { label: "Databases", value: totalDbCount, icon: Database, tone: "text-cyan", detail: isTestMode ? "Sample records" : "Real host & container DBs" },
          { label: "Installed engines", value: `${engines.filter((engine) => engine.installed).length} / ${engines.length}`, icon: Box, tone: "text-success", detail: "SQL & NoSQL" },
          { label: "Storage", value: `${totalStorageMb} MB`, icon: HardDrive, tone: "text-warning", detail: isTestMode ? "Sample usage" : "Real data footprint" },
          { label: "Backups", value: snapshots.length, icon: Archive, tone: "text-cyan", detail: isTestMode ? "Preview snapshots" : "Real dump files" }
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
            {engines.map((engine) => {
              const meta = liveMeta[engine.name.toLowerCase()];
              const mode = meta?.active_mode || "native";
              const isRunning = engine.installed && engine.auto;
              const isEmbedded = meta?.canonical_name === "sqlite";

              return (
                <article key={engine.name} aria-label={`${engine.name} engine`} className="min-w-0 rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${engine.name === "MariaDB" ? "bg-warning/10 text-warning" : engine.name === "MongoDB" ? "bg-success/10 text-success" : "bg-primary/15 text-cyan"}`}>
                      <Database className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{engine.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {engine.version && <span className="font-mono text-xs text-muted-foreground">v{engine.version.split("-")[0]}</span>}
                        <Pill tone={mode === "docker" ? "primary" : "success"}>
                          {mode === "docker" ? "Docker" : "Native"}
                        </Pill>
                      </div>
                    </div>
                    <Pill tone={isRunning ? "success" : "muted"}>
                      {engine.installed ? (isRunning ? "Running" : "Stopped") : "Not Installed"}
                    </Pill>
                  </div>
                  <p className="my-4 break-all font-mono text-xs text-muted-foreground">
                    {engine.installed
                      ? (Number(engine.port) > 0 ? `${engine.bind}:${engine.port}` : "Embedded local engine")
                      : (isLive ? "Not installed on host or Docker" : "No demo installation")}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {engine.installed ? (isRunning ? "Listening" : "Stopped") : "Available"}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isLive && engine.installed && !isEmbedded && (
                        <>
                          <Button
                            size="sm"
                            variant={isRunning ? "outline" : "default"}
                            className="h-8 px-2 text-xs"
                            disabled={busyEngine === `${engine.name}:start` || busyEngine === `${engine.name}:stop`}
                            onClick={() => controlEngine(engine.name, isRunning ? "stop" : "start", mode)}
                          >
                            {isRunning ? <Square className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                            {isRunning ? "Stop" : "Start"}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="h-8 px-2 text-xs"
                            disabled={busyEngine === `${engine.name}:uninstall`}
                            onClick={() => uninstallEngine(engine.name, mode)}
                            title={`Uninstall ${engine.name} (${mode})`}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </>
                      )}
                      {isLive && engine.installed && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => {
                            setLoginForm({
                              engine: engine.name,
                              host: engine.bind || "127.0.0.1",
                              port: engine.port || "3306",
                              username: engine.name === "PostgreSQL" ? "postgres" : engine.name === "SQLite" ? "local" : "root",
                              password: "",
                              database: "",
                            });
                            setLoginModalOpen(true);
                          }}
                          title="Login & manage databases/users"
                        >
                          <KeyRound className="size-3.5 mr-1" />Login
                        </Button>
                      )}
                      {engine.installed && Number(engine.port) > 0 && (
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
              );
            })}
          </div>

          {tools.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Database Web Admin Managers (phpMyAdmin, pgAdmin 4, Adminer, Mongo Express)</h2>
                  <p className="text-xs text-muted-foreground">Install, uninstall, start, stop, or open web administration UIs in Native OS or Docker mode.</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {tools.map((tool) => {
                  const selectedMode = toolModes[tool.id] || tool.active_mode || "native";
                  const modeInstalled = selectedMode === "docker" ? tool.docker_installed : tool.native_installed;
                  const modeRunning = selectedMode === "docker" ? tool.docker_running : tool.native_running;
                  return (
                    <article key={tool.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold">{tool.name}</h3>
                          <p className="text-xs text-muted-foreground">{tool.engines} · Port <span className="font-mono">{tool.port}</span></p>
                        </div>
                        <Pill tone={tool.running ? "success" : "muted"}>
                          {tool.running ? "Running" : tool.installed ? "Stopped" : "Not Installed"}
                        </Pill>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{tool.description}</p>
                      <p className="mt-1 text-[11px] font-mono text-muted-foreground">{tool.default_credentials}</p>

                      <div className="mt-3 grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5 bg-background/50 text-xs">
                        <button
                          type="button"
                          onClick={() => setToolModes((m) => ({ ...m, [tool.id]: "native" }))}
                          className={`flex items-center justify-center gap-1 rounded-md py-1 font-medium ${selectedMode === "native" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        >
                          <Cpu className="size-3" /> Native {tool.native_installed ? "✓" : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => setToolModes((m) => ({ ...m, [tool.id]: "docker" }))}
                          className={`flex items-center justify-center gap-1 rounded-md py-1 font-medium ${selectedMode === "docker" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                        >
                          <Box className="size-3" /> Docker {tool.docker_installed ? "✓" : ""}
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                        {!modeInstalled ? (
                          <Button
                            size="sm"
                            disabled={busyTool === `${tool.id}:install`}
                            onClick={() => handleToolInstall(tool)}
                          >
                            {busyTool === `${tool.id}:install` ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Download className="size-3.5 mr-1" />}
                            Install ({selectedMode === "docker" ? "Docker" : "Native"})
                          </Button>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant={modeRunning ? "outline" : "default"}
                              disabled={busyTool === `${tool.id}:start` || busyTool === `${tool.id}:stop`}
                              onClick={() => handleToolControl(tool, modeRunning ? "stop" : "start")}
                            >
                              {modeRunning ? <Square className="size-3.5 mr-1" /> : <Play className="size-3.5 mr-1" />}
                              {modeRunning ? "Stop" : "Start"}
                            </Button>
                            {tool.running && (
                              <Button size="sm" variant="secondary" onClick={() => window.open(tool.url, "_blank")}>
                                <ExternalLink className="size-3.5 mr-1" />Open UI
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busyTool === `${tool.id}:uninstall`}
                              onClick={() => handleToolUninstall(tool)}
                            >
                              <Trash2 className="size-3.5 mr-1" />Uninstall
                            </Button>
                          </>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {isLive && (
            <div className="mb-8 rounded-lg border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">Live Database User Accounts ({dbUsers.length})</h3>
                <Button size="sm" variant="outline" onClick={() => setCreateUserOpen(true)}>
                  <UserPlus className="size-3.5 mr-1" />Create User
                </Button>
              </div>
              {dbUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground">No remote/server user accounts reported (install &amp; start MariaDB or PostgreSQL to list real users).</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {dbUsers.map((u, i) => (
                    <div
                      key={`${u.engine}-${u.username}-${u.host}-${i}`}
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-1 font-mono text-xs"
                    >
                      <span>
                        <span className="text-cyan">{u.username}</span>@{u.host}
                        <span className="ml-1 text-[10px] text-muted-foreground">({u.engine})</span>
                      </span>
                      <button
                        type="button"
                        title="Change password"
                        onClick={() => {
                          setChangePwTarget({ engine: u.engine, username: u.username });
                          setChangePwForm({ newPassword: "", adminUser: u.engine === "PostgreSQL" ? "postgres" : "root", adminPassword: "" });
                        }}
                        className="text-muted-foreground hover:text-cyan"
                      >
                        <KeyRound className="size-3" />
                      </button>
                      {!["root", "postgres", "mariadb.sys"].includes(u.username) && (
                        <button
                          type="button"
                          title="Drop user"
                          onClick={async () => {
                            try {
                              const res = await databaseApi.dropUser(u.engine, u.username);
                              toast.success(res.message);
                              loadLiveDatabaseData();
                            } catch (e: any) {
                              toast.error((e?.detail as any)?.detail || e?.message || "Drop user failed");
                            }
                          }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {isTestMode ? (
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
              onRowsChange={setRows}
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
          ) : (
            <section>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">All Databases ({filteredLiveDbs.length})</h2>
                  <p className="text-xs text-muted-foreground">Real databases with per-DB credentials, passwords &amp; copyable connection strings.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    aria-label="Search databases"
                    placeholder="Search databases, engine, user..."
                    className={`${inputCls} w-60`}
                    value={searchDb}
                    onChange={(e) => setSearchDb(e.target.value)}
                  />
                  <Button onClick={() => setCreateDbOpen(true)}>
                    <Plus />Create Database
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {filteredLiveDbs.map((db) => {
                  const key = `${db.engine}:${db.name}`;
                  const revealed = Boolean(revealedDbs[key]);
                  const connStr = db.connection_string || "";
                  return (
                    <article key={key} className="min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/15 text-cyan">
                          <Database className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="break-all font-mono text-sm font-semibold">{db.name}</h3>
                          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>User: <span className="font-mono text-foreground">{db.user}</span></span>
                            <span>
                              Password:{" "}
                              <span className="font-mono text-foreground">
                                {db.password ? (revealed ? db.password : "••••••••") : "(none / socket)"}
                              </span>
                            </span>
                            {db.password !== undefined && (
                              <button
                                type="button"
                                onClick={() => setRevealedDbs((r) => ({ ...r, [key]: !r[key] }))}
                                className="inline-flex items-center gap-1 text-cyan hover:underline"
                              >
                                {revealed ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                                {revealed ? "Hide" : "Show"}
                              </button>
                            )}
                          </p>
                        </div>
                        <Pill tone="primary">{db.engine}</Pill>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                        <span>Storage <span className="ml-1 font-mono text-foreground">{db.size_mb ?? 0} MB</span></span>
                        <span>Tables <span className="ml-1 font-mono text-foreground">{db.tables_count ?? 0}</span></span>
                        <span>Endpoint <span className="ml-1 font-mono text-foreground">{db.port > 0 ? `${db.host}:${db.port}` : "local SQLite"}</span></span>
                      </div>

                      {connStr && (
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 font-mono text-xs">
                          <Link2 className="size-3.5 shrink-0 text-cyan" />
                          <span className="min-w-0 flex-1 truncate" title={revealed ? connStr : maskConnStr(connStr, db.password)}>
                            {revealed ? connStr : maskConnStr(connStr, db.password)}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() => copyText("Connection string", connStr)}
                          >
                            <Copy className="size-3 mr-1" />Copy URI
                          </Button>
                        </div>
                      )}

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                        <Button size="sm" variant="outline" onClick={() => setLiveDetails(db)}>
                          <Cable className="size-3.5 mr-1" />Credentials / URI
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLoginForm({
                              engine: db.engine,
                              host: db.host || "127.0.0.1",
                              port: String(db.port || 0),
                              username: db.user || (db.engine === "PostgreSQL" ? "postgres" : "root"),
                              password: db.password || "",
                              database: db.name,
                            });
                            setLoginModalOpen(true);
                          }}
                        >
                          <Terminal className="size-3.5 mr-1" />SQL / Login
                        </Button>
                        {db.engine !== "SQLite" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setChangePwTarget({ engine: db.engine, username: db.user, dbName: db.name });
                              setChangePwForm({
                                newPassword: "",
                                adminUser: db.engine === "PostgreSQL" ? "postgres" : "root",
                                adminPassword: "",
                              });
                            }}
                          >
                            <KeyRound className="size-3.5 mr-1" />Change Password
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={isBackingUp} onClick={() => backupLive(db.name)}>
                          {isBackingUp ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Archive className="size-3.5 mr-1" />}
                          Backup
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteTarget(db)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </article>
                  );
                })}
                {filteredLiveDbs.length === 0 && (
                  <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                    No real databases found yet. Click <strong>Create DB &amp; User</strong> to create a database with password and connection string.
                  </div>
                )}
              </div>
            </section>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <span className="text-xs text-muted-foreground">Quick Launch:</span>
            <Button
              variant="default"
              size="sm"
              onClick={async () => {
                try {
                  const res = await databaseApi.launchPhpMyAdmin();
                  toast.success(res.message);
                  window.open(res.url, "_blank");
                  loadLiveDatabaseData();
                } catch (e: any) {
                  toast.error(e?.message || "Failed to launch phpMyAdmin.");
                }
              }}
            >
              <Cable className="mr-1 size-4" />Launch phpMyAdmin
            </Button>
            {tools.find((t) => t.id === "pgadmin") && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const pgTool = tools.find((t) => t.id === "pgadmin")!;
                  if (pgTool.running) {
                    window.open(pgTool.url, "_blank");
                  } else if (pgTool.installed) {
                    await handleToolControl(pgTool, "start");
                  } else {
                    await handleToolInstall(pgTool);
                  }
                }}
              >
                <Database className="mr-1 size-4" />pgAdmin 4
              </Button>
            )}
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
            <Pill tone="muted">Native OS &amp; Docker releases</Pill>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {engines.map((engine) => {
              const meta = liveMeta[engine.name.toLowerCase()];
              return (
                <article key={engine.name} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5">
                  <Database className="mb-4 size-7 text-cyan" />
                  <h2 className="font-semibold">{engine.name}</h2>
                  <p className="mb-4 mt-2 text-xs text-muted-foreground">{engine.description}</p>
                  <div className="mb-5 flex flex-wrap gap-1.5">
                    <Pill tone={engine.installed ? "success" : "muted"}>
                      {engine.installed ? `Installed${engine.version ? ` · ${engine.version.split("-")[0]}` : ""}` : "Not installed · Available"}
                    </Pill>
                    {isLive && meta?.native_installed && (
                      <Pill tone={meta.native_running ? "success" : "primary"}>
                        <Cpu className="size-3 mr-1 inline" />Native
                      </Pill>
                    )}
                    {isLive && meta?.docker_installed && (
                      <Pill tone={meta.docker_running ? "success" : "primary"}>
                        <Box className="size-3 mr-1 inline" />Docker
                      </Pill>
                    )}
                  </div>
                  <AppVersionActions
                    name={engine.name}
                    versions={engine.versions}
                    allowDocker={meta ? meta.docker_supported : true}
                    installed={engine.installed}
                    nativeInstalled={meta?.native_installed}
                    dockerInstalled={meta?.docker_installed}
                    dockerAvailable={meta?.docker_available ?? true}
                    defaultMode={meta?.active_mode || "native"}
                    installCommand={meta?.install_command}
                    uninstallCommand={meta?.uninstall_command}
                    onInstallPreview={(version, mode) => {
                      if (isTestMode) {
                        setEngines((current) =>
                          current.map((item) =>
                            item.name === engine.name ? { ...item, installed: true, version, mode: mode || "native" } : item
                          )
                        );
                      }
                    }}
                    onInstall={async (version, mode) => {
                      await installEngine(engine.name, mode, version);
                    }}
                    onUninstall={
                      meta?.canonical_name === "sqlite"
                        ? undefined
                        : async (mode) => {
                            await uninstallEngine(engine.name, mode);
                          }
                    }
                  />
                  <Button variant="ghost" size="sm" className="mt-3" disabled={!engine.installed} onClick={() => configure(engine)}>
                    <Settings2 />Configure
                  </Button>
                </article>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="backups">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Database snapshots</h2>
            <Pill tone={isLive ? "success" : "muted"}>
              {isLive ? `${snapshots.length} host snapshots` : isTestMode ? "No real backup files" : "0 snapshots"}
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
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (isTestMode) {
                        preview("Backup download ready");
                        return;
                      }
                      try {
                        await databaseApi.downloadBackup(snapshot.name);
                        toast.success(`Downloaded ${snapshot.name}`);
                      } catch (e: any) {
                        toast.error(e?.message || "Download failed");
                      }
                    }}
                  >
                    <Download />Download
                  </Button>
                </div>
              </article>
            ))}
            {snapshots.length === 0 && !isTestMode && (
              <div className="rounded-lg border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
                No database backups created yet. Click <strong>Backup</strong> on any database to generate a dump.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Engine Configure Dialog */}
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
                  if (isTestMode) preview("Engine settings saved");
                  else toast.success("Engine settings updated");
                }}>Save Configuration</Button>
              </div>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Test-mode Details Dialog */}
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
            <Button variant="outline" disabled={isTesting} onClick={() => handleTestConnection(connection)}>
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

      {/* Live Per-DB Credentials & Connection String Modal */}
      <Dialog open={liveDetails !== null} onOpenChange={(open) => { if (!open) setLiveDetails(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="break-all">{liveDetails?.name} — Credentials &amp; Connection String</DialogTitle>
            <DialogDescription>Ready-to-use credentials and URI for your application `.env` config.</DialogDescription>
          </DialogHeader>
          {liveDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Engine</p>
                  <p className="font-mono font-semibold">{liveDetails.engine}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Host : Port</p>
                  <p className="font-mono">{liveDetails.port > 0 ? `${liveDetails.host}:${liveDetails.port}` : "Embedded SQLite"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Username</p>
                  <p className="font-mono">{liveDetails.user}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Password</p>
                  <p className="font-mono">{liveDetails.password || "(none)"}</p>
                </div>
              </div>
              {liveDetails.connection_string && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Connection String (`DATABASE_URL`)</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => copyText("Connection String", liveDetails.connection_string!)}>
                      <Copy className="size-3 mr-1" />Copy
                    </Button>
                  </div>
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-border bg-secondary p-3 font-mono text-xs">
                    {liveDetails.connection_string}
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyText(".env snippet", `DATABASE_URL="${liveDetails.connection_string}"`)}
                  >
                    <Copy className="size-3.5 mr-1" />Copy `DATABASE_URL="..."`
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button
                  variant="outline"
                  disabled={isTesting}
                  onClick={() => handleTestConnection({ name: liveDetails.engine, bind: liveDetails.host, port: liveDetails.port })}
                >
                  {isTesting ? <Loader2 className="size-4 animate-spin mr-1" /> : <Cable />}
                  Test Connection
                </Button>
                <Button disabled={isBackingUp} onClick={() => backupLive(liveDetails.name)}>
                  {isBackingUp ? <Loader2 className="size-4 animate-spin mr-1" /> : <Archive />}
                  Backup Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Real Create Database + User Modal */}
      <Dialog open={createDbOpen} onOpenChange={setCreateDbOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Real Database &amp; User</DialogTitle>
            <DialogDescription>
              Provisions a real database + user + password + connection URI on your selected engine.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateDbSubmit} className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span>Database Engine</span>
              <select
                className={inputCls}
                value={createDbForm.engine}
                onChange={(e) => {
                  const eng = e.target.value;
                  setCreateDbForm({
                    ...createDbForm,
                    engine: eng,
                    adminUser: eng === "PostgreSQL" ? "postgres" : "root",
                  });
                }}
              >
                {["MariaDB", "PostgreSQL", "SQLite", "MongoDB"].map((eng) => (
                  <option key={eng} value={eng}>{eng}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span>New Database Name</span>
                <input
                  required
                  className={inputCls}
                  placeholder="my_app_db"
                  value={createDbForm.name}
                  onChange={(e) => setCreateDbForm({ ...createDbForm, name: e.target.value })}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span>New Username</span>
                <input
                  required
                  className={inputCls}
                  placeholder="app_user"
                  value={createDbForm.user}
                  onChange={(e) => setCreateDbForm({ ...createDbForm, user: e.target.value })}
                />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm">
              <span>User Password</span>
              <input
                type="password"
                className={inputCls}
                placeholder="Password stored & embedded in DB connection string"
                value={createDbForm.password}
                onChange={(e) => setCreateDbForm({ ...createDbForm, password: e.target.value })}
              />
            </label>
            {createDbForm.engine !== "SQLite" && (
              <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/20 p-3">
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Admin Username</span>
                  <input
                    className={inputCls}
                    value={createDbForm.adminUser}
                    onChange={(e) => setCreateDbForm({ ...createDbForm, adminUser: e.target.value })}
                  />
                </label>
                <label className="block space-y-1 text-xs">
                  <span className="text-muted-foreground">Admin Password (if set)</span>
                  <input
                    type="password"
                    className={inputCls}
                    placeholder="Admin password"
                    value={createDbForm.adminPassword}
                    onChange={(e) => setCreateDbForm({ ...createDbForm, adminPassword: e.target.value })}
                  />
                </label>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateDbOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatingDb}>
                {isCreatingDb ? <Loader2 className="size-4 animate-spin mr-1" /> : <Plus className="size-4 mr-1" />}
                Create Database &amp; User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Real Create Database User Modal */}
      <Dialog open={createUserOpen} onOpenChange={setCreateUserOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Database User Account</DialogTitle>
            <DialogDescription>Provision a real DB user + password and optionally grant access to a database.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUserSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span>Engine</span>
                <select
                  className={inputCls}
                  value={createUserForm.engine}
                  onChange={(e) =>
                    setCreateUserForm({
                      ...createUserForm,
                      engine: e.target.value,
                      adminUser: e.target.value === "PostgreSQL" ? "postgres" : "root",
                    })
                  }
                >
                  <option value="MariaDB">MariaDB</option>
                  <option value="PostgreSQL">PostgreSQL</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-sm">
                <span>Grant on Database (optional)</span>
                <input
                  className={inputCls}
                  placeholder="All databases (*.*)"
                  value={createUserForm.grantDatabase}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, grantDatabase: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5 text-sm">
                <span>Username</span>
                <input
                  required
                  className={inputCls}
                  placeholder="dev_user"
                  value={createUserForm.username}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, username: e.target.value })}
                />
              </label>
              <label className="block space-y-1.5 text-sm">
                <span>Password</span>
                <input
                  required
                  type="password"
                  className={inputCls}
                  value={createUserForm.password}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/20 p-3">
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Admin Username</span>
                <input
                  className={inputCls}
                  value={createUserForm.adminUser}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, adminUser: e.target.value })}
                />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Admin Password</span>
                <input
                  type="password"
                  className={inputCls}
                  value={createUserForm.adminPassword}
                  onChange={(e) => setCreateUserForm({ ...createUserForm, adminPassword: e.target.value })}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateUserOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isCreatingUser}>
                {isCreatingUser ? <Loader2 className="size-4 animate-spin mr-1" /> : <UserPlus className="size-4 mr-1" />}
                Create User
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Change Password Modal */}
      <Dialog open={changePwTarget !== null} onOpenChange={(open) => { if (!open) setChangePwTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Password — {changePwTarget?.username}</DialogTitle>
            <DialogDescription>Runs `ALTER USER` on {changePwTarget?.engine} and updates saved connection strings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
            <label className="block space-y-1.5 text-sm">
              <span>New Password</span>
              <input
                required
                type="password"
                className={inputCls}
                value={changePwForm.newPassword}
                onChange={(e) => setChangePwForm({ ...changePwForm, newPassword: e.target.value })}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Admin User</span>
                <input className={inputCls} value={changePwForm.adminUser} onChange={(e) => setChangePwForm({ ...changePwForm, adminUser: e.target.value })} />
              </label>
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Admin Password</span>
                <input type="password" className={inputCls} value={changePwForm.adminPassword} onChange={(e) => setChangePwForm({ ...changePwForm, adminPassword: e.target.value })} />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setChangePwTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={isUpdatingPw}>
                {isUpdatingPw ? <Loader2 className="size-4 animate-spin mr-1" /> : <KeyRound className="size-4 mr-1" />}
                Save Password
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Real Database Modal */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete database {deleteTarget?.name}?</DialogTitle>
            <DialogDescription>
              This runs `DROP DATABASE` on {deleteTarget?.engine} and permanently deletes its data.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { if (deleteTarget) handleDeleteLiveDb(deleteTarget); }}>
              <Trash2 className="size-4 mr-1" />Delete Database
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Live Database Login & SQL Query Console */}
      <Dialog open={loginModalOpen} onOpenChange={setLoginModalOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="size-5 text-cyan" />
              Database Login &amp; Live SQL Console
            </DialogTitle>
            <DialogDescription>
              Log in with real DB credentials to browse databases, inspect tables, and run SQL statements directly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLiveLogin} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <select
              className={`${inputCls} col-span-2`}
              value={loginForm.engine}
              onChange={(e) => {
                const eng = e.target.value;
                setLoginForm({
                  ...loginForm,
                  engine: eng,
                  port: eng === "PostgreSQL" ? "5432" : eng === "SQLite" ? "0" : "3306",
                  username: eng === "PostgreSQL" ? "postgres" : eng === "SQLite" ? "local" : "root",
                });
                setSessionConnected(false);
              }}
            >
              <option value="MariaDB">MariaDB / MySQL</option>
              <option value="PostgreSQL">PostgreSQL</option>
              <option value="SQLite">SQLite</option>
            </select>
            <input
              className={`${inputCls} col-span-1 sm:col-span-2`}
              placeholder="Host (127.0.0.1)"
              value={loginForm.host}
              onChange={(e) => setLoginForm({ ...loginForm, host: e.target.value })}
            />
            <input
              className={`${inputCls} col-span-1 sm:col-span-2`}
              placeholder="Port"
              value={loginForm.port}
              onChange={(e) => setLoginForm({ ...loginForm, port: e.target.value })}
            />
            <input
              className={`${inputCls} col-span-1 sm:col-span-2`}
              placeholder="Username"
              value={loginForm.username}
              onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            />
            <input
              type="password"
              className={`${inputCls} col-span-1 sm:col-span-2`}
              placeholder="Password"
              value={loginForm.password}
              onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            />
            <input
              className={`${inputCls} col-span-1 sm:col-span-1`}
              placeholder="Database"
              value={loginForm.database}
              onChange={(e) => setLoginForm({ ...loginForm, database: e.target.value })}
            />
            <Button type="submit" className="col-span-1">
              <KeyRound className="size-4 mr-1" />Connect
            </Button>
          </form>

          {sessionConnected && (
            <div className="space-y-4 border-t border-border pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <Pill tone="success">Connected ({loginForm.engine} {sessionVersion})</Pill>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-muted-foreground">Select DB:</span>
                  {sessionDatabases.map((dbName) => (
                    <button
                      key={dbName}
                      type="button"
                      onClick={() => setLoginForm((f) => ({ ...f, database: dbName }))}
                      className={`rounded px-2 py-0.5 font-mono text-xs border ${
                        loginForm.database === dbName
                          ? "border-cyan bg-cyan/15 text-cyan"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {dbName}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={4}
                spellCheck={false}
                className="w-full rounded-lg border border-input bg-secondary/60 p-3 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-ring"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
                placeholder="Enter SQL query..."
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setCreateDbOpen(true)}>
                    <Plus className="size-3.5 mr-1" />New DB &amp; User
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCreateUserOpen(true)}>
                    <UserPlus className="size-3.5 mr-1" />New User
                  </Button>
                </div>
                <Button size="sm" disabled={isRunningSql || !sqlText.trim()} onClick={handleRunSql}>
                  {isRunningSql ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Play className="size-3.5 mr-1" />}
                  Run SQL
                </Button>
              </div>
              {sqlResult && (
                <div className="max-h-64 overflow-auto rounded-lg border border-border bg-secondary/30 p-3 text-xs font-mono">
                  {sqlResult.columns.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border text-cyan">
                          {sqlResult.columns.map((c, idx) => (
                            <th key={idx} className="px-2 py-1">{c}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResult.rows.map((r, rIdx) => (
                          <tr key={rIdx} className="border-b border-border/40">
                            {r.map((cell, cIdx) => (
                              <td key={cIdx} className="px-2 py-1">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-success">{sqlResult.message}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={restore !== undefined} onOpenChange={(open) => { if (!open) { setRestore(undefined); setConfirmed(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isTestMode ? "Restore database preview?" : `Restore ${restore?.name}?`}</DialogTitle>
            <DialogDescription className="break-all">
              {isTestMode ? `${restore?.name} · Snapshot verification before rollback.` : `Executes SQL restore from ${restore?.name} into ${restore?.database_name || restore?.engine}.`}
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-center gap-3 text-sm">
            <input aria-label="Confirm restore preview" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            {isTestMode ? "I understand this is a preview only." : "I understand restoring overwrites current database state."}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRestore(undefined)}>Cancel</Button>
            <Button
              disabled={!confirmed || isRestoring}
              onClick={async () => {
                if (!restore) return;
                if (isTestMode) {
                  preview(`Restore preview: ${restore.name}`);
                  setRestore(undefined);
                  setConfirmed(false);
                  return;
                }
                setIsRestoring(true);
                try {
                  const res = await databaseApi.restoreBackup(restore.name);
                  toast.success(res.message);
                  setRestore(undefined);
                  setConfirmed(false);
                  loadLiveDatabaseData();
                } catch (e: any) {
                  toast.error((e?.detail as any)?.detail || e?.message || "Restore failed");
                } finally {
                  setIsRestoring(false);
                }
              }}
            >
              {isRestoring ? <Loader2 className="size-4 animate-spin mr-1" /> : <RotateCw />}
              {isTestMode ? "Restore preview" : "Restore Snapshot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={pkgTerminal !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setPkgTerminal(undefined);
            loadLiveDatabaseData();
          }
        }}
      >
        <DialogContent className="max-h-[92dvh] sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SquareTerminal className="size-5 text-cyan" />
              {pkgTerminal?.title}
            </DialogTitle>
            <DialogDescription className="break-all font-mono text-xs">
              {pkgTerminal?.command}
            </DialogDescription>
          </DialogHeader>
          <div className="h-[55vh] w-full overflow-hidden rounded-lg border border-border bg-[#0B0F19]">
            {pkgTerminal && <XTermTerminal active={true} initialCommand={pkgTerminal.command} />}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setPkgTerminal(undefined);
                loadLiveDatabaseData();
              }}
            >
              Done &amp; Refresh Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
