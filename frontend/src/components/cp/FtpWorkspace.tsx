import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUp,
  Download,
  FileText,
  Folder,
  FolderPlus,
  HardDriveUpload,
  KeyRound,
  Loader2,
  Package,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Save,
  Server,
  Square,
  SquareTerminal,
  Trash2,
  Upload,
  UserPlus,
  Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { ftpApi } from "@/api/ftp.api";
import type {
  FtpAccountRecord,
  FtpConnectionProfile,
  FtpPackageInfo,
  FtpProtocol,
  FtpRemoteItem,
  FtpServerStatus,
  FtpTargetConfig,
} from "@/types/ftp.types";
import { XTermTerminal } from "./XTermTerminal";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader, Pill, inputCls } from "./ui";

const isTestMode = import.meta.env.MODE === "test";

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes / 1024;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val >= 10 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const record = err as { detail?: unknown; message?: unknown };
    if (record.detail && typeof record.detail === "object" && "detail" in record.detail) {
      const inner = (record.detail as { detail?: unknown }).detail;
      if (typeof inner === "string" && inner) return inner;
      if (Array.isArray(inner) && inner.length > 0) {
        const firstMsg = (inner[0] as { msg?: unknown })?.msg;
        if (typeof firstMsg === "string" && firstMsg) return firstMsg;
      }
    }
    if (typeof record.detail === "string" && record.detail) return record.detail;
    if (typeof record.message === "string" && record.message) return record.message;
  }
  return fallback;
}

function joinRemotePath(dirPath: string, name: string): string {
  const clean = dirPath.replace(/\/+$/, "");
  if (!clean) return `/${name}`;
  return `${clean}/${name}`;
}

function parentRemotePath(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return "/";
  return path.slice(0, idx);
}

export function FtpWorkspace() {
  const [tab, setTab] = useState("client");

  // Saved profiles & active connection config
  const [connections, setConnections] = useState<FtpConnectionProfile[]>([]);
  const [selectedConnId, setSelectedConnId] = useState<number | undefined>();
  const [profileName, setProfileName] = useState("");
  const [protocol, setProtocol] = useState<FtpProtocol>("ftp");
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(2121);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passive, setPassive] = useState(true);

  // Remote browser state
  const [connected, setConnected] = useState(false);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remotePath, setRemotePath] = useState("/");
  const [pathDraft, setPathDraft] = useState("/");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [remoteItems, setRemoteItems] = useState<FtpRemoteItem[]>([]);

  // Remote dialogs
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState("");
  const [renameTarget, setRenameTarget] = useState<FtpRemoteItem>();
  const [renameValue, setRenameValue] = useState("");
  const [chmodTarget, setChmodTarget] = useState<FtpRemoteItem>();
  const [chmodValue, setChmodValue] = useState("644");
  const [editorTarget, setEditorTarget] = useState<FtpRemoteItem>();
  const [editorContent, setEditorContent] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [syncDialog, setSyncDialog] = useState<{ direction: "push" | "pull"; remoteItem?: FtpRemoteItem }>();
  const [localSyncPath, setLocalSyncPath] = useState("");

  // Local FTP Server & Accounts
  const [serverStatus, setServerStatus] = useState<FtpServerStatus>({
    running: false,
    host: "0.0.0.0",
    port: 2121,
    active_users: 0,
    logs: [],
  });
  const [serverPort, setServerPort] = useState(2121);
  const [accounts, setAccounts] = useState<FtpAccountRecord[]>([]);
  const [serverBusy, setServerBusy] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FtpAccountRecord>();
  const [accUsername, setAccUsername] = useState("");
  const [accPassword, setAccPassword] = useState("");
  const [accHomeDir, setAccHomeDir] = useState("");
  const [accPerms, setAccPerms] = useState("elradfmwMT");

  // OS FTP/SFTP server packages (install / uninstall / control)
  const [packages, setPackages] = useState<FtpPackageInfo[]>([]);
  const [pkgBusy, setPkgBusy] = useState<string | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<FtpPackageInfo>();
  const [pkgTerminal, setPkgTerminal] = useState<{ title: string; command: string }>();

  function buildTargetConfig(): FtpTargetConfig {
    return {
      ...(selectedConnId !== undefined && !password ? { connection_id: selectedConnId } : {}),
      protocol,
      host: host.trim(),
      port,
      username: username.trim() || "anonymous",
      password,
      passive,
      remote_path: remotePath,
    };
  }

  async function refreshConnections() {
    try {
      const list = await ftpApi.listConnections();
      setConnections(list);
    } catch {
      // ignore initial offline
    }
  }

  async function refreshServerAndAccounts() {
    try {
      const [statusRes, accountsRes, packagesRes] = await Promise.all([
        ftpApi.getServerStatus(),
        ftpApi.listAccounts(),
        ftpApi.listPackages(),
      ]);
      setServerStatus(statusRes);
      if (statusRes.running) setServerPort(statusRes.port);
      setAccounts(accountsRes);
      setPackages(packagesRes);
    } catch {
      // ignore initial offline
    }
  }

  async function handlePackageAction(
    pkg: FtpPackageInfo,
    action: "install" | "uninstall" | "start" | "stop" | "restart"
  ) {
    setPkgBusy(pkg.name);
    try {
      const res = await ftpApi.managePackage(pkg.name, action);
      if (res.packages) setPackages(res.packages);
      if (res.success) {
        toast.success(`${pkg.display_name}: ${action} completed`);
      } else if (res.requires_terminal) {
        setPkgTerminal({
          title: `${action === "install" ? "Install" : action === "uninstall" ? "Uninstall" : action} ${pkg.display_name}`,
          command: res.command,
        });
        toast.info(res.message);
      } else {
        toast.error(res.message || `Failed to ${action} ${pkg.display_name}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, `Failed to ${action} ${pkg.display_name}`));
    } finally {
      setPkgBusy(null);
    }
  }

  useEffect(() => {
    if (!isTestMode) {
      refreshConnections();
      refreshServerAndAccounts();
    }
  }, []);

  useEffect(() => {
    if (isTestMode || tab !== "server" || !serverStatus.running) return;
    const timer = setInterval(() => {
      ftpApi.getServerStatus().then(setServerStatus).catch(() => {});
    }, 3000);
    return () => clearInterval(timer);
  }, [tab, serverStatus.running]);

  async function connectAndList(targetPath = "/", cfgOverride?: FtpTargetConfig) {
    const cfg = cfgOverride ?? buildTargetConfig();
    if (!cfg.host) {
      toast.error("Enter a host address first.");
      return;
    }
    if (
      !serverStatus.running &&
      cfg.protocol === "ftp" &&
      (cfg.host === "127.0.0.1" || cfg.host === "localhost") &&
      cfg.port === serverPort
    ) {
      toast.error(`Local FTP Server on port ${serverPort} is Stopped — click Start Server in the Local FTP Server tab first.`);
      return;
    }
    setRemoteLoading(true);
    try {
      const res = await ftpApi.listRemote(cfg, targetPath);
      setRemoteItems(res.items);
      setRemotePath(res.current_path);
      setPathDraft(res.current_path);
      setParentPath(res.parent_path);
      setConnected(true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to connect to remote server."));
    } finally {
      setRemoteLoading(false);
    }
  }

  async function handleTestConnection() {
    const cfg = buildTargetConfig();
    if (
      !serverStatus.running &&
      cfg.protocol === "ftp" &&
      (cfg.host === "127.0.0.1" || cfg.host === "localhost") &&
      cfg.port === serverPort
    ) {
      toast.error(`Local FTP Server on port ${serverPort} is Stopped — click Start Server in the Local FTP Server tab first.`);
      return;
    }
    setRemoteLoading(true);
    try {
      const res = await ftpApi.test(cfg);
      toast.success(res.message);
    } catch (err) {
      toast.error(getErrorMessage(err, "Connection test failed."));
    } finally {
      setRemoteLoading(false);
    }
  }

  async function handleSaveProfile() {
    const name = profileName.trim() || `${protocol.toUpperCase()} - ${host.trim()}`;
    if (!host.trim() || !username.trim()) {
      toast.error("Host and username are required to save a profile.");
      return;
    }
    try {
      const saved = await ftpApi.createConnection({
        name,
        protocol,
        host: host.trim(),
        port,
        username: username.trim(),
        password,
        remote_path: remotePath || "/",
        passive,
      });
      setSelectedConnId(saved.id);
      setProfileName("");
      toast.success(`Saved profile "${saved.name}"`);
      await refreshConnections();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save connection profile."));
    }
  }

  function applySavedProfile(profile: FtpConnectionProfile) {
    setSelectedConnId(profile.id);
    setProtocol(profile.protocol);
    setHost(profile.host);
    setPort(profile.port);
    setUsername(profile.username);
    setPassword("");
    setPassive(profile.passive);
    const cfg: FtpTargetConfig = {
      connection_id: profile.id,
      protocol: profile.protocol,
      host: profile.host,
      port: profile.port,
      username: profile.username,
      passive: profile.passive,
      remote_path: profile.remote_path || "/",
    };
    connectAndList(profile.remote_path || "/", cfg);
  }

  async function openRemoteFile(item: FtpRemoteItem) {
    if (item.is_dir) {
      await connectAndList(item.path);
      return;
    }
    setRemoteLoading(true);
    try {
      const res = await ftpApi.readRemote(buildTargetConfig(), item.path);
      setEditorTarget(item);
      setEditorContent(res.content);
    } catch (err) {
      toast.error(getErrorMessage(err, `Cannot preview ${item.name}. Try Download instead.`));
    } finally {
      setRemoteLoading(false);
    }
  }

  function openNewAccountDialog() {
    setEditingAccount(undefined);
    setAccUsername("");
    setAccPassword("");
    setAccHomeDir("/home/ubuntu");
    setAccPerms("elradfmwMT");
    setAccountDialogOpen(true);
  }

  function openEditAccountDialog(acc: FtpAccountRecord) {
    setEditingAccount(acc);
    setAccUsername(acc.username);
    setAccPassword("");
    setAccHomeDir(acc.home_dir);
    setAccPerms(acc.permissions);
    setAccountDialogOpen(true);
  }

  return (
    <>
      <PageHeader
        title="FTP / SFTP Manager"
        desc="Connect to remote FTP, FTPS, or SFTP servers and host local CrossPanel FTP accounts."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={serverStatus.running ? "success" : "muted"}>
              {serverStatus.running ? `● Local FTP :${serverStatus.port}` : "● Local FTP Stopped"}
            </Pill>
            {connected && (
              <Pill tone="primary">
                ● Remote {protocol.toUpperCase()}: {host}
              </Pill>
            )}
          </div>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-5 h-auto w-full justify-start gap-1 rounded-none border-b border-border bg-transparent p-0 pb-2">
          <TabsTrigger value="client" className="gap-2">
            <ArrowLeftRight className="size-4" />
            Remote Client (FTP / FTPS / SFTP)
          </TabsTrigger>
          <TabsTrigger value="server" className="gap-2">
            <Server className="size-4" />
            Local FTP Server & Accounts
          </TabsTrigger>
          <TabsTrigger value="packages" className="gap-2">
            <Package className="size-4" />
            Install / Uninstall Servers ({packages.filter((p) => p.installed).length}/{packages.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: REMOTE CLIENT */}
        <TabsContent value="client" className="space-y-4">
          {connections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
              <span className="text-xs font-semibold text-muted-foreground">Saved Profiles:</span>
              {connections.map((conn) => (
                <div key={conn.id} className="flex items-center gap-1 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs">
                  <button
                    type="button"
                    onClick={() => applySavedProfile(conn)}
                    className="flex items-center gap-1.5 font-medium hover:text-cyan"
                  >
                    <Wifi className="size-3.5 text-cyan" />
                    <span>{conn.name}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ({conn.protocol.toUpperCase()} :{conn.port})
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete profile ${conn.name}`}
                    onClick={async () => {
                      await ftpApi.deleteConnection(conn.id);
                      if (selectedConnId === conn.id) setSelectedConnId(undefined);
                      refreshConnections();
                    }}
                    className="ml-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Protocol</span>
                <select
                  aria-label="Protocol"
                  className={inputCls}
                  value={protocol}
                  onChange={(e) => {
                    const next = e.target.value as FtpProtocol;
                    setProtocol(next);
                    setSelectedConnId(undefined);
                    setPort(next === "sftp" ? 22 : 21);
                  }}
                >
                  <option value="ftp">FTP</option>
                  <option value="ftps">FTPS (TLS)</option>
                  <option value="sftp">SFTP (SSH)</option>
                </select>
              </label>

              <label className="space-y-1 text-xs lg:col-span-2">
                <span className="text-muted-foreground">Host</span>
                <input
                  aria-label="Host"
                  className={inputCls}
                  placeholder="127.0.0.1 or server.example.com"
                  value={host}
                  onChange={(e) => {
                    setHost(e.target.value);
                    setSelectedConnId(undefined);
                  }}
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Port</span>
                <input
                  aria-label="Port"
                  type="number"
                  min={1}
                  max={65535}
                  className={inputCls}
                  value={port}
                  onChange={(e) => {
                    setPort(Number(e.target.value) || 21);
                    setSelectedConnId(undefined);
                  }}
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Username</span>
                <input
                  aria-label="Username"
                  className={inputCls}
                  placeholder="ubuntu"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setSelectedConnId(undefined);
                  }}
                />
              </label>

              <label className="space-y-1 text-xs">
                <span className="text-muted-foreground">Password</span>
                <input
                  aria-label="Password"
                  type="password"
                  className={inputCls}
                  placeholder={selectedConnId ? "Using saved password" : "Password (optional for SSH key)"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-3">
                {protocol !== "sftp" && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch checked={passive} onCheckedChange={setPassive} />
                    Passive mode (PASV)
                  </label>
                )}
                <input
                  aria-label="Profile name"
                  className={`${inputCls} h-8 w-44 text-xs`}
                  placeholder="Profile name (optional)"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={handleSaveProfile}>
                  <Save />
                  Save Profile
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant="outline" disabled={remoteLoading} onClick={handleTestConnection}>
                  Test Connection
                </Button>
                <Button size="sm" disabled={remoteLoading} onClick={() => connectAndList(remotePath || "/")}>
                  {remoteLoading ? <Loader2 className="animate-spin" /> : <Wifi />}
                  {connected ? "Reconnect" : "Connect"}
                </Button>
                {connected && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setConnected(false);
                      setRemoteItems([]);
                    }}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>

          {connected ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={!parentPath || remoteLoading}
                  title="Up one folder"
                  onClick={() => parentPath && connectAndList(parentPath)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={remoteLoading}
                  title="Refresh"
                  onClick={() => connectAndList(remotePath)}
                >
                  {remoteLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                </Button>
                <form
                  className="min-w-0 flex-1 basis-48"
                  onSubmit={(e) => {
                    e.preventDefault();
                    connectAndList(pathDraft || "/");
                  }}
                >
                  <input
                    aria-label="Remote path"
                    className={`${inputCls} font-mono text-xs`}
                    value={pathDraft}
                    onChange={(e) => setPathDraft(e.target.value)}
                  />
                </form>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMkdirName("");
                    setMkdirOpen(true);
                  }}
                >
                  <FolderPlus />
                  New Folder
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setUploadFiles([]);
                    setUploadOpen(true);
                  }}
                >
                  <Upload />
                  Upload
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setLocalSyncPath("");
                    setSyncDialog({ direction: "push" });
                  }}
                >
                  <HardDriveUpload />
                  Push Local File
                </Button>
              </div>

              <div className="hidden grid-cols-[minmax(0,1fr)_85px_95px_90px_145px_auto] gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground xl:grid">
                <span>Name</span>
                <span>Size</span>
                <span>Permissions</span>
                <span>Owner</span>
                <span>Modified</span>
                <span>Actions</span>
              </div>

              <div className="divide-y divide-border">
                {remoteItems.map((item) => (
                  <div
                    key={item.path}
                    className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-2.5 hover:bg-accent/30"
                  >
                    <button
                      type="button"
                      onClick={() => openRemoteFile(item)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    >
                      {item.is_dir ? (
                        <Folder className="size-4 shrink-0 text-warning" />
                      ) : (
                        <FileText className="size-4 shrink-0 text-cyan" />
                      )}
                      <span className="truncate text-xs font-medium">{item.name}</span>
                    </button>

                    <span className="hidden w-[85px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                      {item.is_dir ? "Folder" : formatBytes(item.size)}
                    </span>
                    <span className="hidden w-[95px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                      {item.permissions}
                    </span>
                    <span className="hidden w-[90px] shrink-0 truncate text-xs text-muted-foreground xl:block">
                      {item.owner}
                    </span>
                    <span className="hidden w-[145px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                      {item.modified}
                    </span>

                    <div className="flex shrink-0 items-center gap-1">
                      {!item.is_dir && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit text"
                            onClick={() => openRemoteFile(item)}
                          >
                            <FileText className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Download to browser"
                            onClick={() =>
                              ftpApi
                                .downloadRemote(buildTargetConfig(), item.path, item.name)
                                .catch((err) => toast.error(getErrorMessage(err, "Download failed")))
                            }
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Save to local server path"
                            onClick={() => {
                              setLocalSyncPath("/home/ubuntu");
                              setSyncDialog({ direction: "pull", remoteItem: item });
                            }}
                          >
                            <HardDriveUpload className="size-4 rotate-180" />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Rename"
                        onClick={() => {
                          setRenameTarget(item);
                          setRenameValue(item.name);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Permissions (chmod)"
                        onClick={() => {
                          setChmodTarget(item);
                          setChmodValue(/^[0-7]{3,4}$/.test(item.permissions) ? item.permissions : "644");
                        }}
                      >
                        <KeyRound className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        title="Delete"
                        onClick={async () => {
                          try {
                            const res = await ftpApi.deleteRemote(buildTargetConfig(), item.path, item.is_dir);
                            toast.success(res.message);
                            await connectAndList(remotePath);
                          } catch (err) {
                            toast.error(getErrorMessage(err, "Delete failed."));
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {!remoteLoading && remoteItems.length === 0 && (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  Remote directory is empty.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
              <ArrowLeftRight className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm font-medium">Not connected to any remote server</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter your FTP, FTPS, or SFTP credentials above, or start the Local FTP Server in the second tab.
              </p>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: LOCAL FTP SERVER & ACCOUNTS */}
        <TabsContent value="server" className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">CrossPanel Local FTP Server</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Built-in RFC-959 FTP server (`pyftpdlib`) with passive ports 60000–60100.
                  </p>
                </div>
                <Pill tone={serverStatus.running ? "success" : "muted"}>
                  {serverStatus.running ? "Running" : "Stopped"}
                </Pill>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-xs">
                  <span className="text-muted-foreground">Listen Port</span>
                  <input
                    aria-label="FTP Server Port"
                    type="number"
                    min={1}
                    max={65535}
                    disabled={serverStatus.running}
                    className={`${inputCls} w-28 font-mono`}
                    value={serverPort}
                    onChange={(e) => setServerPort(Number(e.target.value) || 2121)}
                  />
                </label>

                {serverStatus.running ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={serverBusy}
                    onClick={async () => {
                      setServerBusy(true);
                      try {
                        const res = await ftpApi.stopServer();
                        setServerStatus(res);
                        toast.success("Local FTP server stopped.");
                      } catch (err) {
                        toast.error(getErrorMessage(err, "Failed to stop FTP server."));
                      } finally {
                        setServerBusy(false);
                      }
                    }}
                  >
                    <Square />
                    Stop Server
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={serverBusy}
                    onClick={async () => {
                      setServerBusy(true);
                      try {
                        const res = await ftpApi.startServer(serverPort);
                        setServerStatus(res);
                        toast.success(`FTP server listening on port ${res.port}`);
                      } catch (err) {
                        toast.error(getErrorMessage(err, "Failed to start FTP server."));
                      } finally {
                        setServerBusy(false);
                      }
                    }}
                  >
                    <Play />
                    Start Server
                  </Button>
                )}

                <Button size="sm" variant="outline" onClick={refreshServerAndAccounts}>
                  <RefreshCw />
                  Refresh
                </Button>
              </div>

              {!serverStatus.running && serverPort < 1024 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  <span>
                    Ports below 1024 (like 21) require root privileges on Linux and may conflict with vsftpd. Use port 2121.
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setServerPort(2121)}>
                    Use 2121
                  </Button>
                </div>
              )}

              {serverStatus.running && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-secondary/50 p-3 text-xs">
                  <div>
                    <p className="font-mono text-cyan">ftp://127.0.0.1:{serverStatus.port}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {serverStatus.active_users} enabled FTP account(s) active
                    </p>
                  </div>
                  {accounts[0] && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setProtocol("ftp");
                        setHost("127.0.0.1");
                        setPort(serverStatus.port);
                        setUsername(accounts[0]?.username || "");
                        setSelectedConnId(undefined);
                        setTab("client");
                        toast.info("Loaded local FTP server settings into Client tab. Enter password and click Connect.");
                      }}
                    >
                      Open in Client
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Live Server Activity</p>
                <pre className="max-h-56 overflow-auto rounded-md border border-border bg-[#0B0F19] p-3 font-mono text-[11px] leading-5 text-slate-300">
                  {serverStatus.logs.length > 0
                    ? serverStatus.logs.join("\n")
                    : "[idle] No FTP server events yet."}
                </pre>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold">FTP User Accounts</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Each user is jailed to their configured home directory.
                  </p>
                </div>
                <Button size="sm" onClick={openNewAccountDialog}>
                  <UserPlus />
                  Add FTP User
                </Button>
              </div>

              {accounts.length === 0 ? (
                <div className="rounded-md border border-dashed border-border py-12 text-center text-xs text-muted-foreground">
                  <Plus className="mx-auto mb-2 size-6" />
                  No FTP user accounts yet. Add a user before starting the local FTP server.
                </div>
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {accounts.map((acc) => (
                    <div key={acc.id} className="flex flex-wrap items-center gap-3 p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{acc.username}</span>
                          <Pill tone={acc.permissions.includes("w") ? "primary" : "muted"}>
                            {acc.permissions.includes("w") ? "Read / Write" : "Read Only"}
                          </Pill>
                        </div>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                          {acc.home_dir}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Switch
                          aria-label={`Toggle ${acc.username}`}
                          checked={acc.enabled}
                          onCheckedChange={async (checked) => {
                            try {
                              await ftpApi.updateAccount(acc.id, { enabled: checked });
                              await refreshServerAndAccounts();
                            } catch (err) {
                              toast.error(getErrorMessage(err, "Failed to update account."));
                            }
                          }}
                        />
                        <Button size="icon" variant="ghost" onClick={() => openEditAccountDialog(acc)} title="Edit user">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          title="Delete user"
                          onClick={async () => {
                            try {
                              await ftpApi.deleteAccount(acc.id);
                              toast.success(`Deleted FTP user ${acc.username}`);
                              await refreshServerAndAccounts();
                            } catch (err) {
                              toast.error(getErrorMessage(err, "Failed to delete account."));
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: INSTALL / UNINSTALL OS FTP & SFTP SERVERS */}
        <TabsContent value="packages" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">System FTP / SFTP Server Packages</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Install, uninstall, and control native OS FTP &amp; SFTP daemons (`vsftpd`, `ProFTPD`, `Pure-FTPd`, `OpenSSH`).
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={refreshServerAndAccounts}>
              <RefreshCw />
              Refresh Status
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {packages.map((pkg) => {
              const isWorking = pkgBusy === pkg.name;
              return (
                <article key={pkg.name} className="rounded-lg border border-border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{pkg.display_name}</h3>
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                          Port {pkg.default_port}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{pkg.description}</p>
                    </div>
                    <Pill tone={pkg.running ? "success" : pkg.installed ? "primary" : "muted"}>
                      {pkg.running ? "Running" : pkg.installed ? "Installed" : "Not Installed"}
                    </Pill>
                  </div>

                  <div className="mt-4 space-y-1 rounded-md border border-border bg-secondary/40 p-3 font-mono text-xs text-muted-foreground">
                    <p>
                      {pkg.installed ? "Installed version:" : "Available package:"}{" "}
                      <span className="text-foreground">{pkg.version || "unknown"}</span>
                    </p>
                    {pkg.binary_path && (
                      <p className="break-all">
                        Binary: <span className="text-foreground">{pkg.binary_path}</span>
                      </p>
                    )}
                    <p className="break-all text-[11px]">
                      Command: {pkg.installed ? pkg.uninstall_command : pkg.install_command}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
                    {!pkg.installed ? (
                      <>
                        <Button
                          size="sm"
                          disabled={isWorking}
                          onClick={() => handlePackageAction(pkg, "install")}
                        >
                          {isWorking ? <Loader2 className="animate-spin" /> : <Download />}
                          Install
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isWorking}
                          onClick={() =>
                            setPkgTerminal({
                              title: `Install ${pkg.display_name}`,
                              command: pkg.install_command,
                            })
                          }
                        >
                          <SquareTerminal />
                          Install in Terminal
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant={pkg.running ? "outline" : "default"}
                          disabled={isWorking}
                          onClick={() => handlePackageAction(pkg, pkg.running ? "stop" : "start")}
                        >
                          {isWorking ? (
                            <Loader2 className="animate-spin" />
                          ) : pkg.running ? (
                            <Square />
                          ) : (
                            <Play />
                          )}
                          {pkg.running ? "Stop" : "Start"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isWorking || !pkg.running}
                          onClick={() => handlePackageAction(pkg, "restart")}
                        >
                          <RotateCw />
                          Restart
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="ml-auto"
                          disabled={isWorking}
                          onClick={() => setUninstallTarget(pkg)}
                        >
                          <Trash2 />
                          Uninstall
                        </Button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Remote Mkdir Dialog */}
      <Dialog open={mkdirOpen} onOpenChange={setMkdirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Remote Folder</DialogTitle>
            <DialogDescription className="font-mono text-xs">Inside {remotePath}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const clean = mkdirName.trim();
              if (!clean) return;
              try {
                const res = await ftpApi.mkdirRemote(buildTargetConfig(), joinRemotePath(remotePath, clean));
                toast.success(res.message);
                setMkdirOpen(false);
                await connectAndList(remotePath);
              } catch (err) {
                toast.error(getErrorMessage(err, "Failed to create remote folder."));
              }
            }}
          >
            <input
              aria-label="Remote folder name"
              className={inputCls}
              placeholder="new-folder"
              value={mkdirName}
              onChange={(e) => setMkdirName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setMkdirOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remote Rename Dialog */}
      <Dialog open={renameTarget !== undefined} onOpenChange={(o) => !o && setRenameTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Remote Item</DialogTitle>
            <DialogDescription className="font-mono text-xs">{renameTarget?.path}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!renameTarget || !renameValue.trim()) return;
              const newPath = joinRemotePath(parentRemotePath(renameTarget.path), renameValue.trim());
              try {
                const res = await ftpApi.renameRemote(buildTargetConfig(), renameTarget.path, newPath);
                toast.success(res.message);
                setRenameTarget(undefined);
                await connectAndList(remotePath);
              } catch (err) {
                toast.error(getErrorMessage(err, "Rename failed."));
              }
            }}
          >
            <input
              aria-label="New name"
              className={inputCls}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameTarget(undefined)}>
                Cancel
              </Button>
              <Button type="submit">Rename</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remote Chmod Dialog */}
      <Dialog open={chmodTarget !== undefined} onOpenChange={(o) => !o && setChmodTarget(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remote Permissions (chmod)</DialogTitle>
            <DialogDescription className="font-mono text-xs">{chmodTarget?.path}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!chmodTarget) return;
              try {
                const res = await ftpApi.chmodRemote(buildTargetConfig(), chmodTarget.path, chmodValue.trim());
                toast.success(res.message);
                setChmodTarget(undefined);
                await connectAndList(remotePath);
              } catch (err) {
                toast.error(getErrorMessage(err, "Failed to change permissions."));
              }
            }}
          >
            <input
              aria-label="Permission mode"
              className={`${inputCls} font-mono`}
              value={chmodValue}
              onChange={(e) => setChmodValue(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setChmodTarget(undefined)}>
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Remote Text Editor Dialog */}
      <Dialog open={editorTarget !== undefined} onOpenChange={(o) => !o && setEditorTarget(undefined)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-all">{editorTarget?.name}</DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Editing remote file: {editorTarget?.path}
            </DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="Remote file content"
            spellCheck={false}
            className="min-h-80 w-full rounded-md border border-input bg-secondary/60 p-3 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-ring"
            value={editorContent}
            onChange={(e) => setEditorContent(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditorTarget(undefined)}>
              Close
            </Button>
            <Button
              onClick={async () => {
                if (!editorTarget) return;
                try {
                  const res = await ftpApi.writeRemote(buildTargetConfig(), editorTarget.path, editorContent);
                  toast.success(res.message);
                  setEditorTarget(undefined);
                  await connectAndList(remotePath);
                } catch (err) {
                  toast.error(getErrorMessage(err, "Failed to save remote file."));
                }
              }}
            >
              <Save />
              Save to Server
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload to Remote Server</DialogTitle>
            <DialogDescription className="font-mono text-xs">Target directory: {remotePath}</DialogDescription>
          </DialogHeader>
          <input
            aria-label="Choose remote upload files"
            type="file"
            multiple
            onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
            className="w-full text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!uploadFiles.length}
              onClick={async () => {
                try {
                  const res = await ftpApi.uploadRemote(buildTargetConfig(), remotePath, uploadFiles);
                  toast.success(res.message);
                  setUploadOpen(false);
                  await connectAndList(remotePath);
                } catch (err) {
                  toast.error(getErrorMessage(err, "Upload failed."));
                }
              }}
            >
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sync Local OS <-> Remote Dialog */}
      <Dialog open={syncDialog !== undefined} onOpenChange={(o) => !o && setSyncDialog(undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {syncDialog?.direction === "push"
                ? "Push Local OS File to Remote"
                : "Download Remote File to Local OS"}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              {syncDialog?.direction === "push"
                ? `Destination remote folder: ${remotePath}`
                : `Remote file: ${syncDialog?.remoteItem?.path}`}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!syncDialog || !localSyncPath.trim()) return;
              try {
                const target =
                  syncDialog.direction === "push"
                    ? remotePath
                    : syncDialog.remoteItem?.path || remotePath;
                const res = await ftpApi.syncLocal(
                  buildTargetConfig(),
                  syncDialog.direction,
                  localSyncPath.trim(),
                  target
                );
                toast.success(res.message);
                setSyncDialog(undefined);
                if (syncDialog.direction === "push") await connectAndList(remotePath);
              } catch (err) {
                toast.error(getErrorMessage(err, "Transfer failed."));
              }
            }}
          >
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">
                {syncDialog?.direction === "push" ? "Local file path" : "Local destination folder or file path"}
              </span>
              <input
                aria-label="Local OS path"
                className={`${inputCls} font-mono`}
                placeholder="/home/ubuntu/example.txt"
                value={localSyncPath}
                onChange={(e) => setLocalSyncPath(e.target.value)}
                autoFocus
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSyncDialog(undefined)}>
                Cancel
              </Button>
              <Button type="submit">Transfer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Local FTP Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? `Edit ${editingAccount.username}` : "New FTP Account"}</DialogTitle>
            <DialogDescription>Configure credentials and home directory jail for the local FTP server.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                if (editingAccount) {
                  await ftpApi.updateAccount(editingAccount.id, {
                    ...(accPassword ? { password: accPassword } : {}),
                    home_dir: accHomeDir.trim() || "~",
                    permissions: accPerms,
                  });
                  toast.success(`Updated FTP user ${editingAccount.username}`);
                } else {
                  if (!accUsername.trim() || !accPassword) {
                    toast.error("Username and password are required.");
                    return;
                  }
                  await ftpApi.createAccount({
                    username: accUsername.trim(),
                    password: accPassword,
                    home_dir: accHomeDir.trim() || "~",
                    permissions: accPerms,
                    enabled: true,
                  });
                  toast.success(`Created FTP user ${accUsername.trim()}`);
                }
                setAccountDialogOpen(false);
                await refreshServerAndAccounts();
              } catch (err) {
                toast.error(getErrorMessage(err, "Failed to save FTP account."));
              }
            }}
          >
            {!editingAccount && (
              <label className="block space-y-1 text-xs">
                <span className="text-muted-foreground">Username</span>
                <input
                  aria-label="Account username"
                  className={inputCls}
                  value={accUsername}
                  onChange={(e) => setAccUsername(e.target.value)}
                  autoFocus
                />
              </label>
            )}
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">
                {editingAccount ? "New Password (leave blank to keep)" : "Password"}
              </span>
              <input
                aria-label="Account password"
                type="password"
                className={inputCls}
                value={accPassword}
                onChange={(e) => setAccPassword(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">Home Directory</span>
              <input
                aria-label="Home directory"
                className={`${inputCls} font-mono`}
                value={accHomeDir}
                onChange={(e) => setAccHomeDir(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span className="text-muted-foreground">Permissions</span>
              <select
                aria-label="Account permissions"
                className={inputCls}
                value={accPerms}
                onChange={(e) => setAccPerms(e.target.value)}
              >
                <option value="elradfmwMT">Full Read / Write (elradfmwMT)</option>
                <option value="elr">Read Only (elr)</option>
              </select>
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAccountDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Account</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Uninstall Package Confirmation Dialog */}
      <Dialog
        open={uninstallTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) setUninstallTarget(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Uninstall {uninstallTarget?.display_name}?</DialogTitle>
            <DialogDescription>
              This will stop the {uninstallTarget?.service_name} service and uninstall the package from the host OS.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setUninstallTarget(undefined)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!uninstallTarget) return;
                const target = uninstallTarget;
                setUninstallTarget(undefined);
                setPkgTerminal({
                  title: `Uninstall ${target.display_name}`,
                  command: target.uninstall_command,
                });
              }}
            >
              <SquareTerminal />
              Uninstall in Terminal
            </Button>
            <Button
              variant="destructive"
              disabled={pkgBusy !== null}
              onClick={async () => {
                if (!uninstallTarget) return;
                const target = uninstallTarget;
                setUninstallTarget(undefined);
                await handlePackageAction(target, "uninstall");
              }}
            >
              <Trash2 />
              Uninstall Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Interactive Terminal Modal for Sudo Package Install / Uninstall */}
      <Dialog
        open={pkgTerminal !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setPkgTerminal(undefined);
            refreshServerAndAccounts();
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
            {pkgTerminal && (
              <XTermTerminal active={true} initialCommand={pkgTerminal.command} />
            )}
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setPkgTerminal(undefined);
                refreshServerAndAccounts();
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
