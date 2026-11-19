import { createFileRoute } from "@tanstack/react-router";
import { FilesWorkspace } from "@/components/cp/FilesWorkspace";
import { meta } from "@/components/cp/meta";
export const Route = createFileRoute("/files")({
  head: () => meta("File Manager", "CrossPanel file explorer previews with folder navigation, list and grid views, text editing and file management controls."),
  component: FilesWorkspace,
});