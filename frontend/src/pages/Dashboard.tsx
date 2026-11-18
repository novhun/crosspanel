import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  Cpu,
  HardDrive,
  Activity,
  Layers,
  Server,
  Database,
  Terminal,
  Radio,
  ArrowUpRight,
  ExternalLink,
  Play,
  RotateCw,
  Square,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { SystemStatus, ManagedServiceItem } from '../types/system.types';
import { HistoryPoint } from '../hooks/useSystemStats';
import { serviceApi, databaseApi } from '../services/api';
import { PageId } from '../store/useAppStore';

interface DashboardProps {
  stats: SystemStatus | null;
  history: HistoryPoint[];
  onNavigate: (page: PageId) => void;
  openTerminal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  stats,
  history,
  onNavigate,
  openTerminal,
}) => {
  const [services, setServices] = useState<ManagedServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState<boolean>(true);

  const fetchServices = async () => {
    try {
      const data = await serviceApi.list();
      setServices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleServiceAction = async (name: string, action: 'start' | 'stop' | 'restart') => {
    try {
      if (action === 'start') await serviceApi.start(name);
      else if (action === 'stop') await serviceApi.stop(name);
      else await serviceApi.restart(name);
      fetchServices();
    } catch (e) {
      console.error(e);
    }
  };

  const handleLaunchPMA = async () => {
    try {
      const res = await databaseApi.launchPhpMyAdmin();
      window.open(res.url || 'http://localhost:888', '_blank');
    } catch {
      window.open('http://localhost:888', '_blank');
    }
  };

  const formatUptime = (seconds: number = 0) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}d ${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Open Source & Quick Actions */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900/60 to-slate-900 border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              CROSSPANEL CORE
            </span>
            <span className="text-xs text-slate-400 font-mono">Multi-OS Ready: Linux • macOS • Windows</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">DevOps Control Center</h2>
          <p className="text-xs text-slate-400 max-w-xl mt-0.5">
            Monitor infrastructure, deploy microservices with Docker, run Vercel-like Git pipelines, and bypass NAT with built-in Cloudflare & Ngrok tunnels.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleLaunchPMA}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-950/40 transition-all"
          >
            <Database className="w-4 h-4" />
            <span>Launch phpMyAdmin (Port 888)</span>
          </button>

          <button
            onClick={() => onNavigate('library')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950/40 transition-all"
          >
            <Layers className="w-4 h-4" />
            <span>Deploy App</span>
          </button>

          <button
            onClick={openTerminal}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-all"
          >
            <Terminal className="w-4 h-4 text-emerald-400" />
            <span>Web Terminal</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CPU */}
        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium font-mono uppercase tracking-wider">CPU Usage</span>
            <Cpu className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{stats?.cpu_percent ?? 0}%</span>
            <span className="text-xs text-slate-400 font-mono">({stats?.cpu_count || 1} Cores)</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (stats?.cpu_percent ?? 0) > 80 ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(stats?.cpu_percent ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* RAM */}
        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium font-mono uppercase tracking-wider">Memory (RAM)</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{stats?.ram_percent ?? 0}%</span>
            <span className="text-xs text-slate-400 font-mono">
              {stats?.ram_used_gb ?? 0} / {stats?.ram_total_gb ?? 0} GB
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                (stats?.ram_percent ?? 0) > 85 ? 'bg-rose-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${Math.min(stats?.ram_percent ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium font-mono uppercase tracking-wider">Disk Storage</span>
            <HardDrive className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-white font-mono">{stats?.disk_percent ?? 0}%</span>
            <span className="text-xs text-slate-400 font-mono">
              {stats?.disk_used_gb ?? 0} / {stats?.disk_total_gb ?? 0} GB
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min(stats?.disk_percent ?? 0, 100)}%` }}
            />
          </div>
        </div>

        {/* System Uptime */}
        <div className="p-4 rounded-xl bg-[#101726] border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium font-mono uppercase tracking-wider">System Uptime</span>
            <Server className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {formatUptime(stats?.uptime_seconds)}
          </div>
          <p className="text-xs text-slate-400 font-mono mt-2 truncate">
            {stats?.platform_system} ({stats?.target_os?.toUpperCase()} Mode)
          </p>
        </div>
      </div>

      {/* Real-time Telemetry Graph */}
      <div className="p-5 rounded-2xl bg-[#101726] border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              Real-time Hardware Telemetry (CPU vs RAM)
            </h3>
            <p className="text-xs text-slate-400">Continuous live monitoring stream from OS kernel</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">CPU %</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
              <span className="text-slate-300">RAM %</span>
            </div>
          </div>
        </div>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={history}>
              <defs>
                <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="ramGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} />
              <YAxis domain={[0, 100]} stroke="#475569" fontSize={11} tickLine={false} unit="%" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '0.5rem',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              />
              <Area
                type="monotone"
                dataKey="cpu"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#cpuGradient)"
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="ram"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#ramGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Services Grid & Quick Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Services Widget */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-[#101726] border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Core Managed Services
              </h3>
              <p className="text-xs text-slate-400">Controls native OS daemons (systemd, brew, or Windows)</p>
            </div>
            <button
              onClick={() => onNavigate('services')}
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {services.map((svc) => (
              <div
                key={svc.name}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">{svc.display_name}</span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                        svc.is_active || svc.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {svc.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">Port: {svc.default_port || 'N/A'}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleServiceAction(svc.name, 'start')}
                    title="Start"
                    className="p-1.5 rounded-lg bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800/40"
                  >
                    <Play className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleServiceAction(svc.name, 'restart')}
                    title="Restart"
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleServiceAction(svc.name, 'stop')}
                    title="Stop"
                    className="p-1.5 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40"
                  >
                    <Square className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Highlights & Shortcuts */}
        <div className="p-5 rounded-2xl bg-[#101726] border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2 mb-1">
              <Radio className="w-4 h-4 text-cyan-400" />
              DevOps Feature Quick Access
            </h3>
            <p className="text-xs text-slate-400 mb-4">Enterprise-grade capabilities included free</p>

            <div className="space-y-2.5">
              <div
                onClick={() => onNavigate('git')}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Git Auto-Deploy (Vercel-like)</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Push-to-deploy, smart branch triggers, prod/preview envs.</p>
              </div>

              <div
                onClick={() => onNavigate('tunnels')}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Cloudflare & Ngrok Tunnels</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">Expose local services to external HTTPS without port-forwarding.</p>
              </div>

              <div
                onClick={() => onNavigate('automation')}
                className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-indigo-500/40 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">Jenkins CI/CD & Ansible IaC</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">One-click pipeline triggers & multi-server playbooks.</p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>Free Forever</span>
            <span className="text-emerald-400 font-semibold">100% Open Source</span>
          </div>
        </div>
      </div>
    </div>
  );
};
