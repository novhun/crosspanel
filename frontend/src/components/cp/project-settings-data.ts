import { demoProjects, type DeployProject } from "./deploy-data";

export type ProjectSettings = {
  name: string; domain: string; repo: string; branch: string;
  runtime: string; version: string; rootDirectory: string;
  installCommand: string; buildCommand: string; startCommand: string; outputDirectory: string;
  autoDeploy: boolean; https: boolean; redirectHttps: boolean;
  port: string; cpu: string; memory: string; instances: string; healthPath: string; restart: string;
  variables: { id: string; name: string; value: string; environment: "Production" | "Preview" }[];
};

export function defaultProjectSettings(project: DeployProject): ProjectSettings {
  const node = project.runtime === "Node.js";
  const python = project.runtime === "Python";
  return {
    name: project.name, domain: project.domain, repo: project.repo, branch: project.branch,
    runtime: project.runtime, version: project.version, rootDirectory: "./",
    installCommand: node ? "npm ci" : python ? "pip install -r requirements.txt" : project.runtime === "PHP" ? "composer install" : "",
    buildCommand: node ? "npm run build" : project.runtime === "Docker" ? "docker build -t app ." : "",
    startCommand: node ? "npm start" : python ? "gunicorn app:app" : "",
    outputDirectory: node ? "dist" : "./", autoDeploy: project.method === "Git push",
    https: true, redirectHttps: true, port: python ? "8000" : "3000", cpu: "1", memory: "1024",
    instances: "1", healthPath: "/", restart: "On failure",
    variables: [{ id: "sample-mode", name: "APP_MODE", value: "demo", environment: "Production" }],
  };
}

export function validateProjectSettings(settings: ProjectSettings): string | undefined {
  if (!settings.name.trim()) return "Enter a project name.";
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i.test(settings.domain.trim())) return "Enter a domain without a protocol or path.";
  if (!settings.healthPath.startsWith("/")) return "Health check path must start with /.";
  if (!/^\d+$/.test(settings.port) || Number(settings.port) < 1 || Number(settings.port) > 65535) return "Enter a port between 1 and 65535.";
  const names = new Set<string>();
  for (const variable of settings.variables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(variable.name)) return "Variable names must contain letters, numbers or underscores and cannot start with a number.";
    const key = `${variable.environment}:${variable.name}`;
    if (names.has(key)) return "Variable names must be unique within each environment.";
    names.add(key);
  }
  return undefined;
}

const initial: Record<number, ProjectSettings> = Object.fromEntries(demoProjects.map((p) => [p.id, defaultProjectSettings(p)]));
let saved = initial;
const listeners = new Set<() => void>();
export const projectSettingsStore = {
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  getSnapshot: () => saved,
  getServerSnapshot: () => initial,
  save(id: number, settings: ProjectSettings) {
    saved = { ...saved, [id]: structuredClone(settings) };
    listeners.forEach((listener) => listener());
  },
};