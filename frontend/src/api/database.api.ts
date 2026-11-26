import { apiClient } from "./client";
import { DatabaseStatus, PhpMyAdminLaunchResult } from "@/types/database.types";

export interface ManagedDatabaseRecord {
  id: number;
  name: string;
  engine: string;
  user: string;
  host: string;
  port: number;
  size_mb: number;
  tables_count: number;
  run_mode: string;
  created_at?: string;
}

export interface DatabaseBackupRecord {
  id: number;
  name: string;
  filename: string;
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

export interface EngineActionResponse {
  success: boolean;
  engine: string;
  canonical_name?: string;
  mode: string;
  requires_terminal?: boolean;
  command?: string;
  output?: string;
  message: string;
}

export const databaseApi = {
  getStatus: () => apiClient.get<DatabaseStatus>("/database/status"),

  launchPhpMyAdmin: () => apiClient.post<PhpMyAdminLaunchResult>("/database/launch-phpmyadmin"),

  getQuickAccess: () =>
    apiClient.get<{
      phpmyadmin_url: string;
      public_port: number;
      host: string;
      default_user: string;
      password_policy: string;
    }>("/database/quick-access"),

  getEngines: () => apiClient.get<LiveDatabaseEngine[]>("/database/engines"),

  list: () => apiClient.get<ManagedDatabaseRecord[]>("/database/list"),

  delete: (name: string) =>
    apiClient.delete<{ success: boolean; message: string }>(`/database/${name}`),

  backup: (name: string) =>
    apiClient.post<{ success: boolean; message: string; backup?: any }>(`/database/${name}/backup`),

  getBackups: () => apiClient.get<DatabaseBackupRecord[]>("/database/backups"),

  testConnection: (host: string, port: number, engine?: string) =>
    apiClient.post<{ success: boolean; message: string }>("/database/test-connection", {
      host,
      port,
      engine: engine || "PostgreSQL",
    }),

  installEngine: (engineName: string, mode?: "native" | "docker", version?: string) =>
    apiClient.post<EngineActionResponse>(
      `/database/engines/${encodeURIComponent(engineName)}/install`,
      { mode: mode || "native", version: version || "latest" }
    ),

  uninstallEngine: (engineName: string, mode?: "native" | "docker") =>
    apiClient.post<EngineActionResponse>(
      `/database/engines/${encodeURIComponent(engineName)}/uninstall`,
      { mode: mode || "native" }
    ),

  controlEngine: (engineName: string, action: "start" | "stop" | "restart", mode?: "native" | "docker") =>
    apiClient.post<EngineActionResponse>(
      `/database/engines/${encodeURIComponent(engineName)}/${action}`,
      { mode }
    ),

  createDatabase: (payload: { name: string; engine?: string; user?: string; password?: string }) =>
    apiClient.post<{ success: boolean; message: string; database?: any }>(
      "/database/create",
      payload
    ),
};
