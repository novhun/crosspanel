import { apiClient } from "./client";
import { SystemStatus, FirewallRule, ProcessInfo, HardwareDiagnostics } from "@/types/system.types";

export const systemApi = {
  getStatus: () => apiClient.get<SystemStatus>("/system/status"),

  getFirewallRules: () => apiClient.get<FirewallRule[]>("/system/firewall"),

  addFirewallRule: (rule: Omit<FirewallRule, "id" | "created_at">) =>
    apiClient.post<FirewallRule>("/system/firewall", rule),

  deleteFirewallRule: (ruleId: number | string) =>
    apiClient.delete<void>(`/system/firewall/${ruleId}`),

  getProcesses: () => apiClient.get<ProcessInfo[]>("/system/processes"),

  getDiagnostics: () => apiClient.get<HardwareDiagnostics>("/system/diagnostics"),
};
