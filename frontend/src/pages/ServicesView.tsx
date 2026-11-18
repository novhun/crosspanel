import React, { useState, useEffect } from 'react';
import {
  Server,
  Play,
  RotateCw,
  Square,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  Cpu,
  Layers,
  Info
} from 'lucide-react';
import { serviceApi } from '../services/api';
import { ManagedServiceItem } from '../types/system.types';
import { Loader } from '../components/common/Loader';

export const ServicesView: React.FC = () => {
  const [services, setServices] = useState<ManagedServiceItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<string | null>(null);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const data = await serviceApi.list();
      setServices(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleAction = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setActionLoading(prev => ({ ...prev, [serviceName]: true }));
    setMessage(null);
    try {
      let res;
      if (action === 'start') res = await serviceApi.start(serviceName);
      else if (action === 'stop') res = await serviceApi.stop(serviceName);
      else res = await serviceApi.restart(serviceName);
      
      setMessage(res.message || `Action ${action} executed.`);
      await fetchServices();
    } catch (e: any) {
      setMessage(`Error: ${e.message || 'Operation failed'}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [serviceName]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-400" />
            System Service Control
          </h2>
          <p className="text-xs text-slate-400">
            Native OS-level service management adapting automatically to Linux (systemd), macOS (brew), or Windows (Services).
          </p>
        </div>

        <button
          onClick={fetchServices}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Status</span>
        </button>
      </div>

      {/* OS Intelligence Callout */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200">Cross-Platform Service Orchestrator</p>
          <p className="text-slate-400">
            CrossPanel eliminates platform fragmentation. Whether your node is on Ubuntu, Debian, macOS, or Windows Server,
            commands like <code className="text-emerald-400">start</code> and <code className="text-emerald-400">restart</code> translate directly to the host operating system's native daemon controller with zero manual configuration.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          {message}
        </div>
      )}

      {/* Services Cards */}
      {loading ? (
        <Loader text="Querying OS Service Controller..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {services.map((svc) => {
            const isLoading = actionLoading[svc.name] || false;
            const isRunning = svc.is_active || svc.status === 'running';

            return (
              <div
                key={svc.name}
                className="p-5 rounded-xl bg-[#101726] border border-slate-800 hover:border-slate-700 transition-all shadow-sm space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white font-mono">{svc.display_name}</h3>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          isRunning
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {svc.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{svc.description}</p>
                  </div>
                  <div className="text-right font-mono text-[11px] text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      Port: {svc.default_port || 'Standard'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-500 font-mono text-[11px]">
                    OS Target: <span className="text-slate-300">{svc.os_environment}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAction(svc.name, 'start')}
                      disabled={isLoading || isRunning}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-medium disabled:opacity-40"
                    >
                      <Play className="w-3 h-3" />
                      <span>Start</span>
                    </button>

                    <button
                      onClick={() => handleAction(svc.name, 'restart')}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium disabled:opacity-40"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>Restart</span>
                    </button>

                    <button
                      onClick={() => handleAction(svc.name, 'stop')}
                      disabled={isLoading || !isRunning}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 text-xs font-medium disabled:opacity-40"
                    >
                      <Square className="w-3 h-3" />
                      <span>Stop</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
