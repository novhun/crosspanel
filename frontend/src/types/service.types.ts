export interface ManagedService {
  id?: number;
  name: string;
  display_name: string;
  description?: string;
  default_port?: number;
  is_active: boolean;
  installed?: boolean;
  native_installed?: boolean;
  native_running?: boolean;
  native_status?: string;
  native_version?: string;
  docker_installed?: boolean;
  docker_running?: boolean;
  docker_status?: string;
  docker_available?: boolean;
  supports_docker?: boolean;
  version?: string;
  install_command?: string;
  uninstall_command?: string;
  manager?: string;
  binary_path?: string;
  status: "running" | "stopped" | "error" | string;
  os_type?: string;
  category: "web" | "runtime" | "db" | "cache" | "container" | string;
  run_mode: "native" | "docker";
  docker_image?: string;
  docker_container_name?: string;
  available_modes: Array<"native" | "docker">;
  memory_mb?: number;
}

export type ServiceAction = "start" | "stop" | "restart";

export interface ServiceActionResult {
  success: boolean;
  name?: string;
  message?: string;
  mode?: "native" | "docker" | string;
  requires_terminal?: boolean;
  command?: string;
  output?: string;
  details?: Record<string, unknown>;
}
