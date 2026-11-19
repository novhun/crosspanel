export interface TunnelRecord {
  id?: string;
  name: string;
  tunnel_type: "cloudflare" | "ngrok" | string;
  local_port: number;
  remote_url?: string;
  status: "running" | "stopped" | "error" | string;
  created_at?: string;
}

export interface TunnelCreatePayload {
  name: string;
  tunnel_type: "cloudflare" | "ngrok";
  local_port: number;
  auth_token?: string;
}
