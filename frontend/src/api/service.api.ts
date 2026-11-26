import { apiClient } from "./client";
import { ManagedService, ServiceActionResult } from "@/types/service.types";

export const serviceApi = {
  list: () => apiClient.get<ManagedService[]>("/service/list"),

  start: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/start`, { mode }, { timeoutMs: 120000 }),

  stop: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/stop`, { mode }, { timeoutMs: 120000 }),

  restart: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/restart`, { mode }, { timeoutMs: 120000 }),

  updateMode: (serviceName: string, mode: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/mode`, { mode }),

  install: (serviceName: string, mode?: "native" | "docker", version?: string) =>
    apiClient.post<ServiceActionResult>(
      `/service/${serviceName}/install`,
      { mode: mode || "native", version: version || "latest" },
      { timeoutMs: 300000 }
    ),

  uninstall: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(
      `/service/${serviceName}/uninstall`,
      { mode: mode || "native" },
      { timeoutMs: 300000 }
    ),

  logs: (serviceName: string, mode?: "native" | "docker", lines = 80) =>
    apiClient.get<{ name: string; mode: string; logs: string }>(
      `/service/${serviceName}/logs?lines=${lines}${mode ? `&mode=${mode}` : ""}`
    ),
};
