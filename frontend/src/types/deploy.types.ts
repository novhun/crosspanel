export interface DeployTemplate {
  name: string;
  display_name: string;
  description: string;
  category: string;
  default_port: number;
  docker_image?: string;
  env_defaults?: Record<string, string>;
}

export interface CatalogAppStatus {
  name: string;
  slug: string;
  native_kind: string;
  native_installed: boolean;
  native_running: boolean;
  native_version: string;
  docker_installed: boolean;
  docker_running: boolean;
  docker_available: boolean;
  docker_supported: boolean;
  installed: boolean;
  running: boolean;
  install_command: string;
  uninstall_command: string;
  os_type: string;
}

export interface DeployedApp {
  id: number;
  name: string;
  template_name: string;
  status: "running" | "stopped" | "failed" | string;
  port: number;
  mode?: "native" | "docker";
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
