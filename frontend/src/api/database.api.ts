import { apiClient } from "./client";
import { DatabaseStatus, PhpMyAdminLaunchResult } from "@/types/database.types";

export interface ManagedDatabaseRecord {
  id: number;
  name: string;
  engine: string;
  user: string;
  password?: string;
  host: string;
  port: number;
  size_mb: number;
  tables_count: number;
  run_mode: string;
  connection_string?: string;
  created_at?: string;
}

export interface DatabaseBackupRecord {
  id: number;
  name: string;
  filename: string;
  database_name?: string;
  engine: string;
  time: string;
  size: string;
  notes?: string;
}

export interface LiveDatabaseEngine {
  name: string;
  canonical_name: string;
  version: string;
  category: string;
  description: string;
  installed: boolean;
  native_installed: boolean;
  native_running: boolean;
  native_version: string;
  docker_installed: boolean;
  docker_running: boolean;
  docker_available: boolean;
  status: string;
  port: number;
  bind: string;
  native_supported: boolean;
  docker_supported: boolean;
  active_mode: "native" | "docker";
  install_command: string;
  uninstall_command: string;
  os_type: string;
}

export interface DatabaseAdminTool {
  id: string;
  name: string;
  engines: string;
  description: string;
  port: number;
  url: string;
  installed: boolean;
  running: boolean;
  native_installed: boolean;
  native_running: boolean;
  docker_installed: boolean;
  docker_running: boolean;
  docker_available: boolean;
  active_mode: "native" | "docker";
  default_credentials: string;
  os_type: string;
}

export interface EngineActionResponse {
  success: boolean;
  engine?: string;
  canonical_name?: string;
  mode?: string;
  requires_terminal?: boolean;
  command?: string;
  output?: string;
  url?: string;
  message: string;
}

export const databaseApi = {
  getStatus: () => apiClient.get<DatabaseStatus>("/database/status"),

  launchPhpMyAdmin: () => apiClient.post<PhpMyAdminLaunchResult>("/database/launch-phpmyadmin", undefined, { timeoutMs: 300000 }),

  getQuickAccess: () =>
    apiClient.get<{
      phpmyadmin_url: string;
      public_port: number;
      host: string;
      default_user: string;
      password_policy: string;
    }>("/database/quick-access"),

  getEngines: () => apiClient.get<LiveDatabaseEngine[]>("/database/engines"),

  getTools: () => apiClient.get<DatabaseAdminTool[]>("/database/tools"),

  installTool: (toolId: string, mode: "native" | "docker", port?: number) =>
    apiClient.post<EngineActionResponse>(`/database/tools/${toolId}/install`, { mode, port }, { timeoutMs: 300000 }),

  uninstallTool: (toolId: string, mode: "native" | "docker") =>
    apiClient.post<EngineActionResponse>(`/database/tools/${toolId}/uninstall`, { mode }, { timeoutMs: 120000 }),

  controlTool: (toolId: string, action: "start" | "stop" | "restart", mode?: "native" | "docker", port?: number) =>
    apiClient.post<EngineActionResponse>(`/database/tools/${toolId}/${action}`, { mode, port }, { timeoutMs: 120000 }),

  getLiveInventory: () =>
    apiClient.get<{
      databases: ManagedDatabaseRecord[];
      users: Array<{ username: string; host: string; engine: string }>;
    }>("/database/live-inventory"),

  list: () => apiClient.get<ManagedDatabaseRecord[]>("/database/list"),

  delete: (name: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/database/${encodeURIComponent(name)}`),

  backup: (name: string) =>
    apiClient.post<{ success: boolean; message: string; backup?: any }>(`/database/${encodeURIComponent(name)}/backup`),

  getBackups: () => apiClient.get<DatabaseBackupRecord[]>("/database/backups"),

  restoreBackup: (filename: string) =>
    apiClient.post<{ success: boolean; message: string }>(`/database/backups/${encodeURIComponent(filename)}/restore`, undefined, { timeoutMs: 180000 }),

  downloadBackup: async (filename: string): Promise<void> => {
    const baseUrl = (import.meta.env["VITE_API_URL"] as string) || "/api";
    const token = typeof window !== "undefined" ? localStorage.getItem("cp_token") : null;
    const response = await fetch(`${baseUrl}/database/backups/${encodeURIComponent(filename)}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error("Failed to download backup file");
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  testConnection: (host: string, port: number, engine?: string) =>
    apiClient.post<{ success: boolean; message: string }>("/database/test-connection", {
      host,
      port,
      engine: engine || "PostgreSQL",
    }),

  installEngine: (engineName: string, mode?: "native" | "docker", version?: string) =>
    apiClient.post<EngineActionResponse>(
      `/database/engines/${encodeURIComponent(engineName)}/install`,
      { mode: mode || "native", version: version || "latest" },
      { timeoutMs: 300000 }
    ),

  uninstallEngine: (engineName: string, mode?: "native" | "docker") =>
    apiClient.post<EngineActionResponse>(
      `/database/engines/${encodeURIComponent(engineName)}/uninstall`,
      { mode: mode || "native" },
      { timeoutMs: 300000 }
    ),

  controlEngine: (engineName: string, action: "start" | "stop" | "restart", mode?: "native" | "docker") =>
    apiClient.post<EngineActionResponse>(
      `/database/engines/${encodeURIComponent(engineName)}/${action}`,
      { mode },
      { timeoutMs: 120000 }
    ),

  createDatabase: (payload: {
    name: string;
    engine?: string | undefined;
    user?: string | undefined;
    password?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    admin_user?: string | undefined;
    admin_password?: string | undefined;
  }) =>
    apiClient.post<{ success: boolean; message: string; database?: ManagedDatabaseRecord }>(
      "/database/create",
      payload
    ),

  createUser: (payload: {
    engine: string;
    username: string;
    password: string;
    grant_database?: string | undefined;
    admin_user?: string | undefined;
    admin_password?: string | undefined;
  }) => apiClient.post<{ success: boolean; message: string }>("/database/users/create", payload),

  updateUserPassword: (payload: {
    engine: string;
    username: string;
    new_password: string;
    database_name?: string | undefined;
    admin_user?: string | undefined;
    admin_password?: string | undefined;
  }) => apiClient.post<{ success: boolean; message: string }>("/database/users/password", payload),

  dropUser: (engine: string, username: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/database/users/${encodeURIComponent(engine)}/${encodeURIComponent(username)}`),

  loginSession: (payload: {
    engine: string;
    host: string;
    port?: number | undefined;
    username: string;
    password: string;
    database?: string | undefined;
  }) =>
    apiClient.post<{ success: boolean; databases: string[]; version: string; message: string }>(
      "/database/login-session",
      payload
    ),

  runQuery: (payload: {
    engine: string;
    host: string;
    port?: number | undefined;
    username: string;
    password: string;
    database?: string | undefined;
    query: string;
  }) =>
    apiClient.post<{ success: boolean; columns: string[]; rows: string[][]; raw_output?: string; message: string }>(
      "/database/query",
      payload
    ),
};
