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

export interface ManagedServiceItem {
  id: number;
  name: string;
  display_name: string;
  description: string;
  default_port: number;
  category: string;
  status: 'running' | 'stopped' | 'error';
  is_active: boolean;
  os_environment: string;
}

export interface FirewallRule {
  id?: number;
  name: string;
  port: string;
  protocol: string;
  action: string;
  direction: string;
  enabled?: boolean;
  os_type?: string;
  created_at?: string;
}
