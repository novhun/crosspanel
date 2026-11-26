import { apiClient } from "./client";
import { CatalogAppStatus, DeployedApp, DeployTemplate, GitDeployPayload } from "@/types/deploy.types";

export interface DeployInstallResponse {
  success: boolean;
  app_name?: string;
  mode: "native" | "docker" | string;
  requires_terminal?: boolean;
  command?: string;
  output?: string;
  message: string;
  app?: DeployedApp;
}

export const deployApi = {
  getTemplates: () => apiClient.get<DeployTemplate[]>("/deploy/templates"),

  getCatalog: () => apiClient.get<CatalogAppStatus[]>("/deploy/catalog"),

  getApps: () => apiClient.get<DeployedApp[]>("/deploy/apps"),

  installApp: (payload: {
    app_name: string;
    mode: "native" | "docker";
    version?: string;
    port?: number;
    instance_name?: string;
  }) => apiClient.post<DeployInstallResponse>("/deploy/install", payload, { timeoutMs: 300000 }),

  uninstallApp: (payload: { app_name: string; mode: "native" | "docker" }) =>
    apiClient.post<DeployInstallResponse>("/deploy/uninstall", payload, { timeoutMs: 300000 }),

  deployOneClick: (payload: {
    name: string;
    template_name: string;
    port: number;
    mode?: "native" | "docker";
    env_vars?: Record<string, string>;
  }) => apiClient.post<{ success: boolean; app: DeployedApp; mode?: string; message?: string }>("/deploy/one-click", payload, { timeoutMs: 300000 }),

  deployCustomCompose: (payload: { name: string; compose_yaml: string }) =>
    apiClient.post<{ success: boolean; message: string; app_id?: number }>("/deploy/custom-compose", payload, { timeoutMs: 300000 }),

  deployGit: (payload: GitDeployPayload & { mode?: "native" | "docker" }) =>
    apiClient.post<{ success: boolean; message: string; log?: string }>("/deploy/git", payload, { timeoutMs: 180000 }),

  controlApp: (appId: number, action: "start" | "stop" | "restart") =>
    apiClient.post<{ success: boolean; message?: string; requires_terminal?: boolean; command?: string }>(`/deploy/apps/${appId}/${action}`, undefined, { timeoutMs: 120000 }),

  deleteApp: (appId: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/deploy/apps/${appId}`, { timeoutMs: 180000 }),

  getAppLogs: (appId: number, lines = 100) =>
    apiClient.get<{ logs: string }>(`/deploy/apps/${appId}/logs?lines=${lines}`),
};
