import { createFileRoute, Link } from "@tanstack/react-router";
import { demoProjects } from "@/components/cp/deploy-data";
import { ProjectSettingsWorkspace } from "@/components/cp/ProjectSettingsWorkspace";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/deployments_/$projectId/settings")({
  head: ({ params }) => {
    const project = demoProjects.find((item) => String(item.id) === params.projectId);
    return meta(`${project?.name ?? "Unavailable project"} Settings`, "CrossPanel per-project deployment settings preview for build commands, domains, environment variables and hosting resources.");
  },
  component: Page,
});

function Page() {
  const { projectId } = Route.useParams();
  const project = demoProjects.find((item) => String(item.id) === projectId);
  if (!project) return <div className="py-12"><h1 className="mb-4 font-display text-2xl">Project not found</h1><Link to="/deployments" className="text-cyan">Back to deployments</Link></div>;
  return <ProjectSettingsWorkspace key={project.id} project={project} />;
}