import { apiClient } from "./client";
import { ManagedService, ServiceActionResult } from "@/types/service.types";

export const serviceApi = {
  list: () => apiClient.get<ManagedService[]>("/service/list"),

  start: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/start`, { mode }),

  stop: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/stop`, { mode }),

  restart: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/restart`, { mode }),

  updateMode: (serviceName: string, mode: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(`/service/${serviceName}/mode`, { mode }),

  install: (serviceName: string, mode?: "native" | "docker", version?: string) =>
    apiClient.post<ServiceActionResult>(
      `/service/${serviceName}/install`,
      { mode: mode || "native", version: version || "latest" }
    ),

  uninstall: (serviceName: string, mode?: "native" | "docker") =>
    apiClient.post<ServiceActionResult>(
      `/service/${serviceName}/uninstall`,
      { mode: mode || "native" }
    ),

  logs: (serviceName: string, mode?: "native" | "docker", lines = 80) =>
    apiClient.get<{ name: string; mode: string; logs: string }>(
      `/service/${serviceName}/logs?lines=${lines}${mode ? `&mode=${mode}` : ""}`
    ),
};
