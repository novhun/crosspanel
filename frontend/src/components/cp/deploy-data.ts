// Demo-only deployment data and helpers for the Deployments page.
// Nothing here connects to a real Git provider, builder, or host.

export type DeployStatus = "Ready" | "Building" | "Failed";
export type DeployMethod = "Git push" | "Upload ZIP" | "Webhook";

export type DeployProject = {
  id: number;
  name: string;
  domain: string;
  repo: string;
  provider: "GitHub" | "GitLab";
  branch: string;
  runtime: string;
  version: string;
  method: DeployMethod;
  status: DeployStatus;
  lastDeploy: string;
  builds: number;
};

export const demoProjects: DeployProject[] = [
  { id: 1, name: "shop-frontend", domain: "shop.example.com", repo: "novhun/shop-frontend", provider: "GitHub", branch: "main", runtime: "Node.js", version: "20", method: "Git push", status: "Ready", lastDeploy: "2m ago", builds: 48 },
  { id: 2, name: "api-server", domain: "api.example.com", repo: "novhun/api-server", provider: "GitLab", branch: "production", runtime: "Python", version: "3.12", method: "Git push", status: "Building", lastDeploy: "8m ago", builds: 132 },
  { id: 3, name: "company-blog", domain: "blog.example.com", repo: "novhun/company-blog", provider: "GitHub", branch: "main", runtime: "PHP", version: "8.3", method: "Upload ZIP", status: "Ready", lastDeploy: "1h ago", builds: 21 },
  { id: 4, name: "legacy-crm", domain: "crm.example.com", repo: "novhun/legacy-crm", provider: "GitHub", branch: "main", runtime: "Docker", version: "latest", method: "Webhook", status: "Failed", lastDeploy: "3h ago", builds: 9 },
];

export const runtimes: { name: string; versions: string[]; note: string }[] = [
  { name: "Node.js", versions: ["18", "20", "22"], note: "npm, pnpm, bun build & start scripts" },
  { name: "Python", versions: ["3.10", "3.11", "3.12"], note: "pip / requirements.txt, gunicorn, uvicorn" },
  { name: "PHP", versions: ["8.1", "8.2", "8.3"], note: "Composer, PHP-FPM, Laravel & WordPress" },
  { name: "Go", versions: ["1.21", "1.22", "1.23"], note: "go build, single binary output" },
  { name: "Java", versions: ["17", "21"], note: "Maven / Gradle, Spring Boot jars" },
  { name: "Ruby", versions: ["3.2", "3.3"], note: "Bundler, Rails & Sinatra" },
  { name: "Static site", versions: ["—"], note: "HTML/CSS/JS, Hugo, Astro, Vite build output" },
  { name: "Docker", versions: ["latest"], note: "Dockerfile or docker-compose.yml" },
];

export const deployMethods: { name: DeployMethod; desc: string }[] = [
  { name: "Git push", desc: "Build and deploy automatically on every push to the selected branch." },
  { name: "Upload ZIP", desc: "Upload a packaged build and deploy it without a Git repository." },
  { name: "Webhook", desc: "Trigger a deploy from any CI system with an HTTP POST." },
];

export type DeployHistoryEntry = {
  commit: string;
  message: string;
  project: string;
  branch: string;
  status: DeployStatus;
  time: string;
  duration: string;
};

export const demoHistory: DeployHistoryEntry[] = [
  { commit: "a1f3c9e", message: "feat: add checkout flow", project: "shop-frontend", branch: "main", status: "Ready", time: "2m ago", duration: "1m 12s" },
  { commit: "9b2e71d", message: "fix: header overflow", project: "api-server", branch: "preview", status: "Building", time: "8m ago", duration: "—" },
  { commit: "4c8d0aa", message: "chore: bump deps", project: "company-blog", branch: "main", status: "Ready", time: "1h ago", duration: "54s" },
  { commit: "e77f12b", message: "refactor api client", project: "legacy-crm", branch: "main", status: "Failed", time: "3h ago", duration: "2m 03s" },
  { commit: "c51d8f0", message: "feat: product search", project: "shop-frontend", branch: "main", status: "Ready", time: "5h ago", duration: "1m 05s" },
];

export function projectStats(projects: DeployProject[]) {
  return {
    total: projects.length,
    ready: projects.filter((p) => p.status === "Ready").length,
    building: projects.filter((p) => p.status === "Building").length,
    failed: projects.filter((p) => p.status === "Failed").length,
  };
}

export function filterProjects(projects: DeployProject[], query: string, status: "All" | DeployStatus): DeployProject[] {
  const q = query.trim().toLowerCase();
  return projects.filter((p) =>
    (status === "All" || p.status === status) &&
    (!q || [p.name, p.domain, p.repo, p.runtime, p.branch].join(" ").toLowerCase().includes(q)),
  );
}

export function statusTone(status: DeployStatus): "success" | "warning" | "danger" {
  return status === "Ready" ? "success" : status === "Building" ? "warning" : "danger";
}

export function versionsFor(runtimeName: string): string[] {
  return runtimes.find((r) => r.name === runtimeName)?.versions ?? [];
}
