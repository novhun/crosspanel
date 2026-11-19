export interface ManagedService {
  id?: number;
  name: string;
  display_name: string;
  description?: string;
  default_port?: number;
  is_active: boolean;
  status: "running" | "stopped" | "error" | string;
  os_type?: string;
  category: "web" | "runtime" | "db" | "container" | string;
  run_mode: "native" | "docker";
  docker_image?: string;
  docker_container_name?: string;
  available_modes: Array<"native" | "docker">;
  memory_mb?: number;
}

export type ServiceAction = "start" | "stop" | "restart";

export interface ServiceActionResult {
  success: boolean;
  message?: string;
  mode?: "native" | "docker";
  details?: Record<string, unknown>;
}
