import { apiClient } from "./client";
import { DeployedApp, DeployTemplate, GitDeployPayload } from "@/types/deploy.types";

export const deployApi = {
  getTemplates: () => apiClient.get<DeployTemplate[]>("/deploy/templates"),

  getApps: () => apiClient.get<DeployedApp[]>("/deploy/apps"),

  deployOneClick: (payload: {
    name: string;
    template_name: string;
    port: number;
    env_vars?: Record<string, string>;
  }) => apiClient.post<{ success: boolean; app: DeployedApp; message?: string }>("/deploy/one-click", payload),

  deployGit: (payload: GitDeployPayload) =>
    apiClient.post<{ success: boolean; message: string; log?: string }>("/deploy/git", payload),
};
