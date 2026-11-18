import axios from 'axios';
import { SystemStatus, ManagedServiceItem, FirewallRule } from '../types/system.types';
import { DeployedApp, AppTemplate, TunnelItem, JenkinsJob, AnsiblePlaybook, FileItem } from '../types/deploy.types';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

export const systemApi = {
  getStatus: () => api.get<SystemStatus>('/system/status').then(res => res.data),
  getFirewallRules: () => api.get<FirewallRule[]>('/system/firewall').then(res => res.data),
  addFirewallRule: (data: FirewallRule) => api.post('/system/firewall', data).then(res => res.data),
  deleteFirewallRule: (name: string) => api.delete(`/system/firewall/${encodeURIComponent(name)}`).then(res => res.data),
  setTargetOS: (target_os: string) => api.post('/system/target-os', { target_os }).then(res => res.data),
  toggleTerminal: () => api.post('/system/terminal-toggle').then(res => res.data),
};

export const serviceApi = {
  list: () => api.get<ManagedServiceItem[]>('/service/list').then(res => res.data),
  start: (name: string) => api.post(`/service/${name}/start`).then(res => res.data),
  stop: (name: string) => api.post(`/service/${name}/stop`).then(res => res.data),
  restart: (name: string) => api.post(`/service/${name}/restart`).then(res => res.data),
};

export const deployApi = {
  getTemplates: () => api.get<Record<string, AppTemplate>>('/deploy/templates').then(res => res.data),
  getApps: () => api.get<DeployedApp[]>('/deploy/apps').then(res => res.data),
  deployOneClick: (data: { name: string; template_name: string; port: number; env_vars?: Record<string, string>; source_url?: string }) =>
    api.post('/deploy/one-click', data).then(res => res.data),
  deployCustomCompose: (data: { name: string; compose_yaml: string; env_vars?: Record<string, string> }) =>
    api.post('/deploy/custom-compose', data).then(res => res.data),
  deployGit: (data: { name: string; repo_url: string; branch: string; env_type: string; build_command?: string; port?: number; env_vars?: Record<string, string> }) =>
    api.post('/deploy/git', data).then(res => res.data),
  restartApp: (id: number) => api.post(`/deploy/apps/${id}/restart`).then(res => res.data),
  stopApp: (id: number) => api.post(`/deploy/apps/${id}/stop`).then(res => res.data),
  deleteApp: (id: number) => api.delete(`/deploy/apps/${id}`).then(res => res.data),
  getLogs: (id: number) => api.get<{ name: string; logs: string }>(`/deploy/apps/${id}/logs`).then(res => res.data),
};

export const tunnelApi = {
  list: () => api.get<TunnelItem[]>('/tunnel/list').then(res => res.data),
  create: (data: { name: string; tunnel_type: string; local_port: number; auth_token?: string }) =>
    api.post('/tunnel/create', data).then(res => res.data),
  stop: (id: string) => api.delete(`/tunnel/${id}`).then(res => res.data),
};

export const databaseApi = {
  getStatus: () => api.get('/database/status').then(res => res.data),
  launchPhpMyAdmin: () => api.post('/database/launch-phpmyadmin').then(res => res.data),
  getQuickAccess: () => api.get('/database/quick-access').then(res => res.data),
};

export const automationApi = {
  getJenkinsJobs: () => api.get<JenkinsJob[]>('/automation/jenkins/jobs').then(res => res.data),
  createJenkinsJob: (data: any) => api.post('/automation/jenkins/create', data).then(res => res.data),
  triggerJenkinsBuild: (id: number) => api.post(`/automation/jenkins/${id}/build`).then(res => res.data),
  getAnsiblePlaybooks: () => api.get<AnsiblePlaybook[]>('/automation/ansible/playbooks').then(res => res.data),
  createAnsiblePlaybook: (data: any) => api.post('/automation/ansible/create', data).then(res => res.data),
  runAnsiblePlaybook: (id: number) => api.post(`/automation/ansible/${id}/run`).then(res => res.data),
};

export const fileApi = {
  list: (path: string = '') => api.get<{ current_path: string; items: FileItem[] }>(`/files/list?path=${encodeURIComponent(path)}`).then(res => res.data),
  read: (path: string) => api.get<{ path: string; content: string }>(`/files/read?path=${encodeURIComponent(path)}`).then(res => res.data),
  write: (path: string, content: string) => api.post('/files/write', { path, content }).then(res => res.data),
  mkdir: (path: string) => api.post('/files/mkdir', { path }).then(res => res.data),
  delete: (path: string) => api.post('/files/delete', { path }).then(res => res.data),
  zip: (source_path: string, target_zip: string) => api.post('/files/zip', { source_path, target_zip }).then(res => res.data),
  unzip: (zip_path: string, extract_to: string) => api.post('/files/unzip', { zip_path, extract_to }).then(res => res.data),
  chmod: (path: string, mode: string) => api.post('/files/chmod', { path, mode }).then(res => res.data),
};

export default api;
