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

  getEngines: () =>
    apiClient.get<
      Array<{
        name: string;
        version: string;
        category: string;
        installed: boolean;
        status: string;
        port: number;
        bind: string;
        native_supported: boolean;
        docker_supported: boolean;
        active_mode: "native" | "docker";
      }>
    >("/database/engines"),

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
    apiClient.post<{ success: boolean; engine: string; mode: string; message: string }>(
      `/database/engines/${engineName}/install`,
      { mode: mode || "native", version: version || "latest" }
    ),

  createDatabase: (payload: { name: string; engine?: string; user?: string; password?: string }) =>
    apiClient.post<{ success: boolean; message: string; database?: any }>(
      "/database/create",
      payload
    ),
};

