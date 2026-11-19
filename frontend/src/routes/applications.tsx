import { createFileRoute } from "@tanstack/react-router";
import { meta } from "@/components/cp/meta";
import { ApplicationsWorkspace } from "@/components/cp/ApplicationsWorkspace";

export const Route = createFileRoute("/applications")({
  head: () => meta("Applications", "Explore the CrossPanel application library, sample versions, installed app previews and custom deployment sources."),
  component: ApplicationsWorkspace,
});
