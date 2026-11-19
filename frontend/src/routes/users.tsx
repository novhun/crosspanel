import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";
import { DemoEditor } from "@/components/cp/DemoEditor";
import { Pill } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/users")({ head: () => meta("User Management", "Manage CrossPanel team profiles and preview user roles."), component: Page });
function Page() {
  return <DemoEditor title="User Management" description="Team members & access profiles" singular="User" fields={[{ key: "name", label: "Name" }, { key: "email", label: "Email", type: "email" }, { key: "role", label: "Role", options: ["Viewer", "Operator", "Administrator"] }]} initialRows={[
    { id: 1, enabled: true, values: { name: "Nov Hun", email: "nov@example.com", role: "Administrator" } },
    { id: 2, enabled: true, values: { name: "Demo Operator", email: "operator@example.com", role: "Operator" } },
    { id: 3, enabled: false, values: { name: "Demo Viewer", email: "viewer@example.com", role: "Viewer" } },
  ]} details={(row) => <div className="flex flex-wrap items-start gap-3"><Users className="h-5 w-5 text-cyan" /><div className="min-w-0 flex-1"><h2 className="break-words font-semibold">{row.values['name']}</h2><p className="mt-1 break-all text-xs text-muted-foreground">{row.values['email']}</p></div><Pill tone="primary">{row.values['role']}</Pill><Pill tone={row.enabled ? "success" : "muted"}>{row.enabled ? "Active" : "Disabled"}</Pill></div>} />;
}