import React, { useState, useEffect } from 'react';
import {
  Database,
  ExternalLink,
  ShieldCheck,
  Check,
  Copy,
  Server,
  Zap,
  KeyRound,
  Play,
  RotateCw,
  Cpu
} from 'lucide-react';
import { databaseApi } from '../services/api';
import { Button } from '../components/common/Button';

export const DatabaseManager: React.FC = () => {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [quickAccess, setQuickAccess] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLaunching, setIsLaunching] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [status, access] = await Promise.all([
          databaseApi.getStatus(),
          databaseApi.getQuickAccess()
        ]);
        setDbStatus(status);
        setQuickAccess(access);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleLaunchPMA = async () => {
    setIsLaunching(true);
    try {
      const res = await databaseApi.launchPhpMyAdmin();
      window.open(res.url || 'http://localhost:888', '_blank');
    } catch {
      window.open('http://localhost:888', '_blank');
    } finally {
      setIsLaunching(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-400" />
          Database Management & phpMyAdmin
        </h2>
        <p className="text-xs text-slate-400">
          Instant password-free database management interface on Port 888 and direct access connection strings.
        </p>
      </div>

      {/* Hero Banner: phpMyAdmin 1-Click Launch */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-[#101726] border border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-emerald-950/20">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
            <Zap className="w-3.5 h-3.5" />
            <span>Automatic & 100% Free - No Pro Subscription Needed</span>
          </div>
          <h3 className="text-xl font-bold text-white">
            Launch phpMyAdmin (Automatic, Password-Free)
          </h3>
          <p className="text-xs text-slate-400 max-w-xl">
            CrossPanel resolves the painful password login barrier by automatically authenticating your session on public emergency Port 888. Zero licensing lockouts.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <Button
            onClick={handleLaunchPMA}
            isLoading={isLaunching}
            size="lg"
            variant="primary"
            className="text-sm font-semibold px-6 py-3 gap-2"
          >
            <Database className="w-4 h-4" />
            <span>Launch phpMyAdmin (Port 888)</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
          </Button>

          <a
            href="http://localhost:888"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-medium border border-slate-700 transition-all flex items-center gap-1.5"
          >
            <span>Direct Port 888</span>
            <ExternalLink className="w-3 h-3 text-slate-400" />
          </a>
        </div>
      </div>

      {/* Database Engines Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* MariaDB / MySQL */}
        <div className="p-5 rounded-xl bg-[#101726] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white font-mono">MariaDB / MySQL Engine</h4>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              PORT 3306
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Primary relational database running on native system or container service.
          </p>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Default Superuser:</span>
            <span className="text-slate-200">root (password-free on local/pma)</span>
          </div>
        </div>

        {/* PostgreSQL */}
        <div className="p-5 rounded-xl bg-[#101726] border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <h4 className="text-sm font-bold text-white font-mono">PostgreSQL Engine</h4>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              PORT 5432
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Advanced object-relational SQL database for robust enterprise microservices.
          </p>
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500">Default Superuser:</span>
            <span className="text-slate-200">postgres</span>
          </div>
        </div>
      </div>

      {/* Direct Access Connection Strings */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-400" />
          Direct Access Connection Snippets
        </h3>
        <p className="text-xs text-slate-400">
          Copy-paste ready snippets to connect your backend services and CLI tools.
        </p>

        {quickAccess?.connection_strings && (
          <div className="space-y-3">
            {Object.entries(quickAccess.connection_strings).map(([lang, snippet]: any) => (
              <div
                key={lang}
                className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-between gap-4 font-mono text-xs"
              >
                <div className="space-y-1 overflow-hidden">
                  <span className="text-[10px] uppercase font-bold text-slate-500">{lang.replace('_', ' ')}</span>
                  <p className="text-emerald-400 truncate">{snippet}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(snippet, lang)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white shrink-0 transition-colors"
                >
                  {copiedKey === lang ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
