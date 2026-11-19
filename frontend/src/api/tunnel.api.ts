import { apiClient } from "./client";
import { TunnelRecord, TunnelCreatePayload } from "@/types/tunnel.types";

export const tunnelApi = {
  list: () => apiClient.get<TunnelRecord[]>("/tunnel/list"),

  create: (payload: TunnelCreatePayload) =>
    apiClient.post<TunnelRecord>("/tunnel/create", payload),

  stop: (tunnelName: string) =>
    apiClient.post<{ success: boolean; message: string }>(`/tunnel/${tunnelName}/stop`),
};
