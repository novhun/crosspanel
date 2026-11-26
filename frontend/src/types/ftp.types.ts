export type FtpProtocol = "ftp" | "ftps" | "sftp";

export interface FtpConnectionProfile {
  id: number;
  name: string;
  protocol: FtpProtocol;
  host: string;
  port: number;
  username: string;
  has_password: boolean;
  remote_path: string;
  passive: boolean;
  created_at?: string | null;
}

export interface FtpTargetConfig {
  connection_id?: number;
  protocol: FtpProtocol;
  host: string;
  port: number;
  username: string;
  password?: string;
  passive?: boolean;
  remote_path?: string;
}

export interface FtpRemoteItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  permissions: string;
  owner: string;
}

export interface FtpListResponse {
  current_path: string;
  parent_path: string | null;
  items: FtpRemoteItem[];
}

export interface FtpAccountRecord {
  id: number;
  username: string;
  home_dir: string;
  permissions: string;
  enabled: boolean;
  created_at?: string | null;
}

export interface FtpServerStatus {
  running: boolean;
  host: string;
  port: number;
  active_users: number;
  logs: string[];
}

export interface FtpPackageInfo {
  name: string;
  display_name: string;
  description: string;
  default_port: number;
  os: string;
  installed: boolean;
  running: boolean;
  version: string;
  service_name: string;
  binary_path: string;
  install_command: string;
  uninstall_command: string;
}

export interface FtpPackageActionResponse {
  success: boolean;
  requires_terminal: boolean;
  command: string;
  output: string;
  message: string;
  packages?: FtpPackageInfo[];
}
