export interface AppTemplate {
  name: string;
  category: string;
  description: string;
  default_port: number;
  default_env: Record<string, string>;
  compose: string;
}

export interface DeployedApp {
  id: number;
  name: string;
  template_name: string;
  status: 'running' | 'stopped' | 'failed' | 'deploying';
  port?: number;
  container_id?: string;
  env_vars?: string;
  source_url?: string;
  git_branch?: string;
  compose_content?: string;
  created_at?: string;
  updated_at?: string;
}

export interface TunnelItem {
  id: string;
  name: string;
  tunnel_type: 'cloudflare' | 'ngrok';
  local_port: number;
  remote_url: string;
  status: 'active' | 'inactive';
  created_at?: string;
}

export interface JenkinsJob {
  id: number;
  name: string;
  url: string;
  job_name: string;
  last_status: string;
  last_duration?: string;
  last_run?: string;
}

export interface AnsiblePlaybook {
  id: number;
  name: string;
  description?: string;
  content: string;
  inventory: string;
  last_run?: string;
  last_status: string;
  last_output?: string;
}

export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  permissions: string;
}
