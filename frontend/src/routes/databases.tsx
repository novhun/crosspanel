import { createFileRoute } from "@tanstack/react-router";
import { DatabasesWorkspace } from "@/components/cp/DatabasesWorkspace";
import { meta } from "@/components/cp/meta";
export const Route = createFileRoute("/databases")({
  head: () => meta("Databases", "CrossPanel database previews with engine versions, connection settings, database records and backup snapshots."),
  component: DatabasesWorkspace,
});