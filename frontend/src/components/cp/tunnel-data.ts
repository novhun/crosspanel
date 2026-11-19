export type Provider = "Cloudflare" | "Ngrok";
export type Tunnel = { id: number; domain: string; host: string; port: string; provider: Provider; https: boolean; auto: boolean; running: boolean; protocol: "HTTP" | "HTTPS"; websocket: boolean; timeout: string };
export type TunnelDraft = Omit<Tunnel, "id" | "running">;
export const tunnelDefaults: TunnelDraft = { domain: "", host: "localhost", port: "8000", provider: "Cloudflare", https: true, auto: true, protocol: "HTTP", websocket: true, timeout: "30" };
export const initialTunnels: Tunnel[] = [
  { ...tunnelDefaults, id: 1, domain: "app.crosspanel.dev", running: true },
  { ...tunnelDefaults, id: 2, domain: "api.crosspanel.dev", port: "3000", running: true },
  { ...tunnelDefaults, id: 3, domain: "c3f1-203-0-113.ngrok.app", port: "5173", provider: "Ngrok", auto: false, running: false },
];
export function validateTunnel(form: TunnelDraft, tunnels: Tunnel[], editing?: number) {
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(form.domain.trim())) return "Enter a public hostname without a URL, path or spaces.";
  if (tunnels.some((tunnel) => tunnel.domain.toLowerCase() === form.domain.trim().toLowerCase() && tunnel.id !== editing)) return "This domain already has a tunnel.";
  if (!/^(?:localhost|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[a-f0-9:]+\])$/i.test(form.host.trim())) return "Enter a hostname or IP address without a URL or path.";
  if (!/^\d+$/.test(form.port) || Number(form.port) < 1 || Number(form.port) > 65535) return "Local port must be between 1 and 65535.";
  if (!/^\d+$/.test(form.timeout) || Number(form.timeout) < 1 || Number(form.timeout) > 600) return "Timeout must be between 1 and 600 seconds.";
  return undefined;
}