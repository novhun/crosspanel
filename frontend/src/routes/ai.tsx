import { createFileRoute } from "@tanstack/react-router";
import { AiWorkspace } from "@/components/cp/AiWorkspace";
import { meta } from "@/components/cp/meta";
export const Route = createFileRoute("/ai")({
  head: () => meta("AI", "CrossPanel AI workspace previews for Chat, Skills, Quota, Models, ChatOps, settings and available server tools."),
  component: AiWorkspace,
});