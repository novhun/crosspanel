import React from 'react';
import {
  LayoutDashboard,
  Server,
  Box,
  Layers,
  GitBranch,
  Database,
  Radio,
  Workflow,
  ShieldCheck,
  FolderTree,
  Terminal,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { PageId } from '../../store/useAppStore';

interface SidebarProps {
  currentPage: PageId;
  onSelectPage: (page: PageId) => void;
  openTerminal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onSelectPage,
  openTerminal
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'services', label: 'System Services', icon: Server },
    { id: 'docker', label: 'Docker Apps', icon: Box },
    { id: 'library', label: 'App Library', icon: Layers },
    { id: 'git', label: 'Git Auto-Deploy', icon: GitBranch, badge: 'Vercel-like' },
    { id: 'database', label: 'Database & PMA', icon: Database, badge: 'Auto Auth' },
    { id: 'tunnels', label: 'Network Tunnels', icon: Radio, badge: 'NAT Bypass' },
    { id: 'automation', label: 'DevOps Automation', icon: Workflow },
    { id: 'firewall', label: 'Smart Firewall', icon: ShieldCheck },
    { id: 'files', label: 'File Manager', icon: FolderTree },
    { id: 'terminal', label: 'Web Terminal', icon: Terminal },
  ];

  return (
    <aside className="w-64 bg-[#0D1321] border-r border-slate-800/80 flex flex-col h-screen select-none">
      {/* Brand */}
      <div className="p-5 border-b border-slate-800/70">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-[2px] shadow-lg shadow-emerald-950/50">
            <div className="h-full w-full bg-[#0D1321] rounded-[10px] flex items-center justify-center">
              <Box className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              CrossPanel
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">v1.0</span>
            </h1>
            <p className="text-xs text-slate-400">All-in-One DevOps Workspace</p>
          </div>
        </div>

        {/* Open-Source Badge */}
        <div className="mt-3 py-1.5 px-2.5 rounded-lg bg-emerald-950/40 border border-emerald-700/30 flex items-center justify-between text-[11px] text-emerald-300">
          <span className="flex items-center gap-1 font-medium">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Open-Source & Free Forever
          </span>
          <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-mono font-semibold">100% Free</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectPage(item.id as PageId)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-normal ${
                  isActive ? 'bg-emerald-500/25 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Terminal Quick Button & Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/30 space-y-2">
        <button
          onClick={openTerminal}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium border border-slate-700/80 transition-all shadow"
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-400" />
          <span>Launch Web Terminal</span>
        </button>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Multi-OS Control Panel</span>
          <span className="font-mono text-emerald-400">Online</span>
        </div>
      </div>
    </aside>
  );
};
