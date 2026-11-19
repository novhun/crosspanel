import { createFileRoute } from "@tanstack/react-router";
import { AutomationWorkspace } from "@/components/cp/AutomationWorkspace";
import { meta } from "@/components/cp/meta";
export const Route = createFileRoute("/automation")({
  head: () => meta("DevOps Automation", "CrossPanel automation task previews with Jenkins pipelines, Ansible playbooks, scheduling, run history and workspace preferences."),
  component: AutomationWorkspace,
});