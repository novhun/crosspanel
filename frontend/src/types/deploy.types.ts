export interface DeployTemplate {
  name: string;
  display_name: string;
  description: string;
  category: string;
  default_port: number;
  docker_image?: string;
  env_defaults?: Record<string, string>;
}

export interface DeployedApp {
  id: number;
  name: string;
  template_name: string;
  status: "running" | "stopped" | "failed" | string;
  port: number;
  container_id?: string;
  env_vars?: string | Record<string, string>;
  source_url?: string;
  compose_content?: string;
  created_at?: string;
}

export interface GitDeployPayload {
  name: string;
  repo_url: string;
  branch: string;
  port: number;
  env_vars?: Record<string, string>;
  build_command?: string;
}
