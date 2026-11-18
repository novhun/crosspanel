import React, { useState } from 'react';
import {
  Monitor,
  Terminal,
  Database,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  Shield,
  Layers
} from 'lucide-react';
import { systemApi, databaseApi } from '../../services/api';
import { SystemStatus } from '../../types/system.types';

interface TopbarProps {
  stats: SystemStatus | null;
  targetOS: string;
  onTargetOSChange: (os: string) => void;
  openTerminal: () => void;
  onRefresh?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  stats,
  targetOS,
  onTargetOSChange,
  openTerminal,
  onRefresh,
}) => {
  const [isSwitchingOS, setIsSwitchingOS] = useState(false);
  const [isLaunchingPMA, setIsLaunchingPMA] = useState(false);

  const handleOSChange = async (newOS: string) => {
    setIsSwitchingOS(true);
    try {
      await systemApi.setTargetOS(newOS);
      onTargetOSChange(newOS);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSwitchingOS(false);
    }
  };

  const handleLaunchPMA = async () => {
    setIsLaunchingPMA(true);
    try {
      const res = await databaseApi.launchPhpMyAdmin();
      window.open(res.url || 'http://localhost:888', '_blank');
    } catch (e) {
      console.error(e);
      window.open('http://localhost:888', '_blank');
    } finally {
      setIsLaunchingPMA(false);
    }
  };

  const osIcons: Record<string, string> = {
    windows: '🪟 Windows',
    linux: '🐧 Linux (systemd/ufw)',
    mac: '🍎 macOS (brew/pf)',
    auto: '⚡ Auto Detect'
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-[#0C111D]/80 backdrop-blur-md px-6 flex items-center justify-between z-20">
      {/* Left: Current Node & OS Target */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-mono text-slate-300 font-semibold">{stats?.hostname || 'Host Server'}</span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400 font-mono text-[11px]">{stats?.os_name || 'Multi-OS'}</span>
        </div>

        {/* Target OS Dropdown */}
        <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
          <span className="text-slate-400 mr-2 text-[11px] font-mono">Target OS:</span>
          <select
            value={targetOS}
            onChange={(e) => handleOSChange(e.target.value)}
            disabled={isSwitchingOS}
            aria-label="Target OS"
            className="bg-transparent text-emerald-400 font-semibold focus:outline-none cursor-pointer pr-2 text-xs"
          >
            <option value="auto" className="bg-slate-900 text-slate-200">⚡ Auto Detect</option>
            <option value="windows" className="bg-slate-900 text-slate-200">🪟 Windows</option>
            <option value="linux" className="bg-slate-900 text-slate-200">🐧 Linux</option>
            <option value="mac" className="bg-slate-900 text-slate-200">🍎 macOS</option>
          </select>
        </div>
      </div>

      {/* Right: Quick Action Buttons */}
      <div className="flex items-center space-x-3">
        {/* Quick Launch phpMyAdmin Password-Free Button */}
        <button
          onClick={handleLaunchPMA}
          disabled={isLaunchingPMA}
          title="Direct Access Port 888"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/40 text-xs font-medium transition-all shadow"
        >
          <Database className="w-3.5 h-3.5 text-cyan-400" />
          <span>Launch phpMyAdmin (Port 888)</span>
        </button>

        {/* Web Terminal Button */}
        <button
          onClick={openTerminal}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/40 text-xs font-medium transition-all shadow"
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Web Terminal</span>
        </button>

        {/* Live Metrics Pill */}
        {stats && (
          <div className="hidden lg:flex items-center space-x-3 px-3 py-1 bg-slate-900/80 border border-slate-800 rounded-lg text-xs font-mono">
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-slate-500">CPU</span>
              <span className={`${stats.cpu_percent > 80 ? 'text-rose-400' : 'text-emerald-400'} font-bold`}>
                {stats.cpu_percent}%
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <span className="text-slate-500">RAM</span>
              <span className={`${stats.ram_percent > 85 ? 'text-rose-400' : 'text-emerald-400'} font-bold`}>
                {stats.ram_percent}%
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
