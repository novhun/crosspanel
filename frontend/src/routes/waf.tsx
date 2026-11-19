import { createFileRoute } from "@tanstack/react-router";
import { WafWorkspace } from "@/components/cp/WafWorkspace";
import { meta } from "@/components/cp/meta";
export const Route = createFileRoute("/waf")({
  head: () => meta("WAF", "CrossPanel Nginx-only Web Application Firewall previews for CC attacks, malicious scans, keyword rules and traffic reports."),
  component: WafWorkspace,
});