import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  Lock,
  Unlock,
  AlertTriangle,
  Info
} from 'lucide-react';
import { systemApi } from '../services/api';
import { FirewallRule } from '../types/system.types';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';

export const FirewallView: React.FC = () => {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form state
  const [name, setName] = useState<string>('Allow HTTP/HTTPS');
  const [port, setPort] = useState<string>('80, 443');
  const [protocol, setProtocol] = useState<string>('TCP');
  const [action, setAction] = useState<string>('ALLOW');
  const [direction, setDirection] = useState<string>('IN');
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const data = await systemApi.getFirewallRules();
      setRules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAddRule = async () => {
    if (!name.trim() || !port.trim()) return;
    setIsAdding(true);
    try {
      await systemApi.addFirewallRule({
        name: name.trim(),
        port: port.trim(),
        protocol,
        action,
        direction,
        enabled: true
      });
      setName('');
      fetchRules();
    } catch (e: any) {
      alert(`Error adding firewall rule: ${e.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteRule = async (ruleName: string) => {
    if (!confirm(`Delete firewall rule "${ruleName}"?`)) return;
    try {
      await systemApi.deleteFirewallRule(ruleName);
      fetchRules();
    } catch (e: any) {
      alert(`Error deleting rule: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          Smart Firewall Manager
        </h2>
        <p className="text-xs text-slate-400">
          Cross-platform port security automatically interfacing with UFW on Linux, Windows Defender Firewall on Windows, or pf on macOS.
        </p>
      </div>

      {/* Explainer */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-slate-300 space-y-1">
          <p className="font-semibold text-slate-200">Zero-Config Port Protection</p>
          <p className="text-slate-400">
            When you allow or deny ports in CrossPanel, the backend OS adapter executes the native security commands behind the scenes. No need to memorize syntax variations across different operating systems.
          </p>
        </div>
      </div>

      {/* Add Rule Card */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Add New Firewall Rule</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-4">
            <label className="block text-xs font-mono text-slate-400 mb-1">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Open Port 8000"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-400 mb-1">Port / Range</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="e.g. 80, 8000-8080"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-400 mb-1">Protocol</label>
            <select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="TCP">TCP</option>
              <option value="UDP">UDP</option>
              <option value="ANY">ANY</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-400 mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="ALLOW">ALLOW</option>
              <option value="DENY">DENY</option>
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end">
            <Button
              onClick={handleAddRule}
              isLoading={isAdding}
              variant="primary"
              className="w-full text-xs py-2 gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Apply Rule</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Rules Table */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Active Firewall Rules ({rules.length})</h3>
          <button
            onClick={fetchRules}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <Loader text="Querying OS Firewall Rules..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-medium">Rule Name</th>
                  <th className="pb-3 font-medium">Port / Range</th>
                  <th className="pb-3 font-medium">Protocol</th>
                  <th className="pb-3 font-medium">Direction</th>
                  <th className="pb-3 font-medium">Action</th>
                  <th className="pb-3 font-medium text-right">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {rules.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40">
                    <td className="py-3 font-semibold text-white truncate max-w-xs">{r.name}</td>
                    <td className="py-3 text-cyan-400 font-bold">{r.port}</td>
                    <td className="py-3 text-slate-300">{r.protocol}</td>
                    <td className="py-3 text-slate-400">{r.direction || 'IN'}</td>
                    <td className="py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                          r.action.toUpperCase() === 'ALLOW'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {r.action}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => handleDeleteRule(r.name)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
