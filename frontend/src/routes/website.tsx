import { createFileRoute } from "@tanstack/react-router";
import { meta } from "@/components/cp/meta";
import { WebsiteWorkspace } from "@/components/cp/WebsiteWorkspace";

export const Route = createFileRoute("/website")({
  head: () => meta("Website", "Browse CrossPanel website previews and manage domain, runtime, hosting and HTTPS demo settings."),
  component: WebsiteWorkspace,
});
