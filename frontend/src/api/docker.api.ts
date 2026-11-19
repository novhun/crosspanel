import { apiClient } from "./client";

export interface DockerStatus {
  is_running: boolean;
  version: string;
  api_version: string;
  go_version: string;
  storage_driver: string;
  cgroup_driver: string;
  cgroup_version: string;
  root_dir: string;
  containers_total: number;
  containers_running: number;
  containers_paused: number;
  containers_stopped: number;
  images_count: number;
  volumes_count: number;
  networks_count: number;
}

export interface DockerContainer {
  Id?: string;
  ID?: string;
  Names?: string | string[];
  Image?: string;
  State?: string;
  Status?: string;
  Ports?: string;
  Created?: string | number;
  CreatedAt?: string;
}

export interface DockerImage {
  ID?: string;
  Id?: string;
  Repository?: string;
  Tag?: string;
  Size?: string;
  CreatedAt?: string;
}

export interface DockerVolume {
  Name: string;
  Driver: string;
  Mountpoint?: string;
  Scope?: string;
  Size?: string;
}

export interface DockerNetwork {
  ID?: string;
  Name: string;
  Driver: string;
  Scope?: string;
  Subnet?: string;
  Gateway?: string;
}

export interface DockerSettings {
  status: string;
  accelerate_urls: string[];
  compose_path: string;
  private_registry: string;
  log_max_size: string;
  log_max_file: string;
  ipv6_enabled: boolean;
  ipv6_subnet: string;
  iptables: boolean;
  live_restore: boolean;
  cgroup_driver: string;
  install_dir: string;
  has_applications: boolean;
  daemon_json: string;
}

export const dockerApi = {
  getStatus: () => apiClient.get<DockerStatus>("/docker/status"),

  getContainers: () => apiClient.get<DockerContainer[]>("/docker/containers"),

  containerAction: (id: string, action: string) =>
    apiClient.post<{ success: boolean; message: string }>(`/docker/containers/${id}/action`, { action }),

  getContainerLogs: (id: string, lines: number = 100) =>
    apiClient.get<{ logs: string }>(`/docker/containers/${id}/logs?lines=${lines}`),

  getImages: () => apiClient.get<DockerImage[]>("/docker/images"),

  pullImage: (image: string, tag: string = "latest") =>
    apiClient.post<{ success: boolean; message: string }>("/docker/images/pull", { image, tag }),

  deleteImage: (id: string) => apiClient.delete<{ success: boolean; message: string }>(`/docker/images/${id}`),

  getVolumes: () => apiClient.get<DockerVolume[]>("/docker/volumes"),

  createVolume: (name: string, driver: string = "local") =>
    apiClient.post<{ success: boolean; name: string }>("/docker/volumes/create", { name, driver }),

  deleteVolume: (name: string) => apiClient.delete<{ success: boolean }>(`/docker/volumes/${name}`),

  pruneVolumes: () => apiClient.post<{ success: boolean }>("/docker/volumes/prune"),

  getNetworks: () => apiClient.get<DockerNetwork[]>("/docker/networks"),

  createNetwork: (payload: { name: string; driver: string; subnet?: string; gateway?: string }) =>
    apiClient.post<{ success: boolean; name: string }>("/docker/networks/create", payload),

  deleteNetwork: (id: string) => apiClient.delete<{ success: boolean }>(`/docker/networks/${id}`),

  getSettings: () => apiClient.get<DockerSettings>("/docker/settings"),

  updateSettings: (payload: Partial<DockerSettings>) =>
    apiClient.post<{ success: boolean; message: string }>("/docker/settings", payload),

  daemonAction: (action: "start" | "restart" | "repair") =>
    apiClient.post<{ success: boolean; message: string }>(`/docker/daemon/${action}`),
};
