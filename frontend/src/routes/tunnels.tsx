import { createFileRoute } from "@tanstack/react-router";
import { TunnelsWorkspace } from "@/components/cp/TunnelsWorkspace";
import { meta } from "@/components/cp/meta";
export const Route = createFileRoute("/tunnels")({
  head: () => meta("Network Tunnels", "CrossPanel Cloudflare and Ngrok previews with client versions, tunnel routing settings and sample activity."),
  component: TunnelsWorkspace,
});