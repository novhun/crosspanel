import { apiClient } from "./client";
import type {
  FtpAccountRecord,
  FtpConnectionProfile,
  FtpListResponse,
  FtpPackageActionResponse,
  FtpPackageInfo,
  FtpProtocol,
  FtpServerStatus,
  FtpTargetConfig,
} from "@/types/ftp.types";

const BASE_URL = (import.meta.env["VITE_API_URL"] as string) || "/api";

export const ftpApi = {
  // Saved connections
  listConnections: () => apiClient.get<FtpConnectionProfile[]>("/ftp/connections"),

  createConnection: (payload: {
    name: string;
    protocol: FtpProtocol;
    host: string;
    port: number;
    username: string;
    password: string;
    remote_path: string;
    passive: boolean;
  }) => apiClient.post<FtpConnectionProfile>("/ftp/connections", payload),

  deleteConnection: (id: number) => apiClient.delete<{ success: boolean }>(`/ftp/connections/${id}`),

  // Remote client
  test: (cfg: FtpTargetConfig) =>
    apiClient.post<{ success: boolean; protocol: string; pwd: string; banner: string; message: string }>(
      "/ftp/client/test",
      cfg
    ),

  listRemote: (cfg: FtpTargetConfig, path: string) =>
    apiClient.post<FtpListResponse>("/ftp/client/list", { ...cfg, path }),

  readRemote: (cfg: FtpTargetConfig, path: string) =>
    apiClient.post<{ path: string; content: string }>("/ftp/client/read", { ...cfg, path }),

  writeRemote: (cfg: FtpTargetConfig, path: string, content: string) =>
    apiClient.post<{ success: boolean; message: string }>("/ftp/client/write", { ...cfg, path, content }),

  mkdirRemote: (cfg: FtpTargetConfig, path: string) =>
    apiClient.post<{ success: boolean; message: string }>("/ftp/client/mkdir", { ...cfg, path }),

  renameRemote: (cfg: FtpTargetConfig, oldPath: string, newPath: string) =>
    apiClient.post<{ success: boolean; message: string }>("/ftp/client/rename", {
      ...cfg,
      old_path: oldPath,
      new_path: newPath,
    }),

  deleteRemote: (cfg: FtpTargetConfig, path: string, isDir: boolean) =>
    apiClient.post<{ success: boolean; message: string }>("/ftp/client/delete", {
      ...cfg,
      path,
      is_dir: isDir,
    }),

  chmodRemote: (cfg: FtpTargetConfig, path: string, mode: string) =>
    apiClient.post<{ success: boolean; message: string }>("/ftp/client/chmod", { ...cfg, path, mode }),

  syncLocal: (
    cfg: FtpTargetConfig,
    direction: "push" | "pull",
    localPath: string,
    remoteTarget: string
  ) =>
    apiClient.post<{ success: boolean; path?: string; message: string }>("/ftp/client/sync-local", {
      ...cfg,
      direction,
      local_path: localPath,
      remote_target: remoteTarget,
    }),

  uploadRemote: async (
    cfg: FtpTargetConfig,
    remoteDir: string,
    files: File[]
  ): Promise<{ success: boolean; files: string[]; message: string }> => {
    const formData = new FormData();
    formData.append("remote_dir", remoteDir);
    formData.append("connection_id", cfg.connection_id ? String(cfg.connection_id) : "");
    formData.append("protocol", cfg.protocol);
    formData.append("host", cfg.host);
    formData.append("port", String(cfg.port));
    formData.append("username", cfg.username);
    formData.append("password", cfg.password || "");
    formData.append("passive", String(cfg.passive ?? true));
    for (const file of files) {
      formData.append("files", file);
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("cp_token") : null;
    const response = await fetch(`${BASE_URL}/ftp/client/upload`, {
      method: "POST",
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      body: formData,
    });
    if (!response.ok) {
      let detail = response.statusText || "Upload failed";
      try {
        const body = (await response.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
    return (await response.json()) as { success: boolean; files: string[]; message: string };
  },

  downloadRemote: async (cfg: FtpTargetConfig, path: string, filename: string): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("cp_token") : null;
    const response = await fetch(`${BASE_URL}/ftp/client/download`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ ...cfg, path }),
    });
    if (!response.ok) {
      let detail = response.statusText || "Download failed";
      try {
        const body = (await response.json()) as { detail?: string };
        if (body?.detail) detail = body.detail;
      } catch {
        // ignore
      }
      throw new Error(detail);
    }
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

  // Built-in FTP Server & Accounts
  getServerStatus: () => apiClient.get<FtpServerStatus>("/ftp/server/status"),

  startServer: (port: number, host = "0.0.0.0") =>
    apiClient.post<FtpServerStatus>("/ftp/server/start", { port, host }),

  stopServer: () => apiClient.post<FtpServerStatus>("/ftp/server/stop"),

  listAccounts: () => apiClient.get<FtpAccountRecord[]>("/ftp/accounts"),

  createAccount: (payload: {
    username: string;
    password: string;
    home_dir: string;
    permissions: string;
    enabled: boolean;
  }) => apiClient.post<FtpAccountRecord>("/ftp/accounts", payload),

  updateAccount: (
    id: number,
    payload: { password?: string; home_dir?: string; permissions?: string; enabled?: boolean }
  ) => apiClient.put<FtpAccountRecord>(`/ftp/accounts/${id}`, payload),

  deleteAccount: (id: number) => apiClient.delete<{ success: boolean }>(`/ftp/accounts/${id}`),

  // Native OS FTP / SFTP Server Packages
  listPackages: () => apiClient.get<FtpPackageInfo[]>("/ftp/packages"),

  managePackage: (
    packageName: string,
    action: "install" | "uninstall" | "start" | "stop" | "restart"
  ) =>
    apiClient.post<FtpPackageActionResponse>(`/ftp/packages/${packageName}/${action}`, undefined, {
      timeoutMs: 120000,
    }),
};
