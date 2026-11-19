import { apiClient } from "./client";
import { DatabaseStatus, PhpMyAdminLaunchResult } from "@/types/database.types";

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
};
