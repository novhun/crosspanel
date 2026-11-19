export interface SystemStatus {
  cpu_percent: number;
  cpu_count: number;
  cpu_freq_current?: number;
  ram_total_gb: number;
  ram_used_gb: number;
  ram_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  disk_percent: number;
  net_bytes_sent_mb: number;
  net_bytes_recv_mb: number;
  uptime_seconds: number;
  hostname: string;
  os_name: string;
  os_version: string;
  platform_system: string;
  target_os: string;
}

export interface FirewallRule {
  id?: number | string;
  name: string;
  port: string;
  protocol: "TCP" | "UDP" | "ANY" | string;
  action: "ALLOW" | "DENY" | string;
  direction: "IN" | "OUT" | string;
  enabled: boolean;
  os_type?: string;
  created_at?: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_percent: number;
  memory_percent: number;
  status: string;
  username?: string;
}

export interface HardwareDiagnostics {
  hostname: string;
  os: string;
  os_version: string;
  kernel: string;
  architecture: string;
  cpu_count: number;
  cpu_freq_current: number;
  memory_total_gb: number;
  disks: Array<{
    device: string;
    mountpoint: string;
    fstype: string;
    total_gb: number;
    used_gb: number;
    free_gb: number;
    percent: number;
  }>;
  network_interfaces: Array<{
    name: string;
    ip: string;
    mac: string;
    is_up: boolean;
  }>;
}
