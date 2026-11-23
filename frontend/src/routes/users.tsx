import { createFileRoute } from "@tanstack/react-router";
import { meta } from "@/components/cp/meta";
import { UsersWorkspace } from "@/components/cp/UsersWorkspace";

export const Route = createFileRoute("/users")({
  head: () => meta("User Management", "Manage real CrossPanel team profiles, passwords, and access roles."),
  component: UsersWorkspace,
});
