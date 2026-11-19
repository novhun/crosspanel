import { createFileRoute } from "@tanstack/react-router";
import { ServiceWorkspace } from "@/components/cp/ServiceWorkspace";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/service")({
  head: () => meta("Service", "Manage CrossPanel service previews, sample resources, versions, configurations and activity."),
  component: ServiceWorkspace,
});