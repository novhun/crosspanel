import { createFileRoute } from "@tanstack/react-router";
import { meta } from "@/components/cp/meta";
import { DockerWorkspace } from "@/components/cp/DockerWorkspace";

export const Route = createFileRoute("/docker")({
  head: () => meta("Docker Management", "Manage Docker containers, images, compose stacks, networks, and daemon settings."),
  component: DockerWorkspace,
});
