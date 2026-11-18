import React, { useState, useEffect } from 'react';
import {
  Radio,
  ExternalLink,
  Plus,
  ShieldCheck,
  Copy,
  Check,
  Trash2,
  Lock,
  Globe,
  RefreshCw,
  Zap
} from 'lucide-react';
import { tunnelApi } from '../services/api';
import { TunnelItem } from '../types/deploy.types';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';

export const Tunnels: React.FC = () => {
  const [tunnels, setTunnels] = useState<TunnelItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form state
  const [name, setName] = useState<string>('api-service');
  const [tunnelType, setTunnelType] = useState<'cloudflare' | 'ngrok'>('cloudflare');
  const [localPort, setLocalPort] = useState<number>(8000);
  const [authToken, setAuthToken] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchTunnels = async () => {
    setLoading(true);
    try {
      const data = await tunnelApi.list();
      setTunnels(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTunnels();
  }, []);

  const handleCreate = async () => {
    if (!name.trim() || !localPort) return;
    setIsCreating(true);
    try {
      await tunnelApi.create({
        name: name.trim(),
        tunnel_type: tunnelType,
        local_port: Number(localPort),
        auth_token: authToken
      });
      setName('');
      fetchTunnels();
    } catch (e: any) {
      alert(`Error creating tunnel: ${e.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await tunnelApi.stop(id);
      fetchTunnels();
    } catch (e) {
      console.error(e);
    }
  };

  const copyUrl = (url: string, id: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Radio className="w-5 h-5 text-emerald-400" />
          Network Tunnels & NAT Bypass (Cloudflare & Ngrok)
        </h2>
        <p className="text-xs text-slate-400">
          Expose your local development and microservices to the public web with instant HTTPS without configuring router port-forwarding or exposing your firewall.
        </p>
      </div>

      {/* Feature Explainer */}
      <div className="p-5 rounded-2xl bg-[#101726] border border-cyan-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold">
              ZERO-TRUST INGRESS
            </span>
            <span className="text-xs text-slate-400 font-mono">End-to-End Encrypted Tunneling</span>
          </div>
          <h3 className="text-sm font-semibold text-white">How CrossPanel NAT Bypass Works</h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Outgoing TLS tunnels to Cloudflare Edge or Ngrok securely relay traffic to your local port. No open ports on your ISP, no dynamic DNS headaches, and automatic HTTPS certificates out of the box.
          </p>
        </div>
      </div>

      {/* Tunnel Creation Form */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Plus className="w-4 h-4 text-emerald-400" />
          <span>Launch New Tunnel</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <div className="sm:col-span-3">
            <label className="block text-xs font-mono text-slate-400 mb-1">Tunnel Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. backend-api"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-xs font-mono text-slate-400 mb-1">Tunnel Provider</label>
            <select
              value={tunnelType}
              onChange={(e) => setTunnelType(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
            >
              <option value="cloudflare">Cloudflare Tunnel (trycloudflare)</option>
              <option value="ngrok">Ngrok (ngrok-free.app)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-mono text-slate-400 mb-1">Local Port</label>
            <input
              type="number"
              value={localPort}
              onChange={(e) => setLocalPort(Number(e.target.value))}
              placeholder="8000"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-4 flex items-end">
            <Button
              onClick={handleCreate}
              isLoading={isCreating}
              variant="primary"
              className="w-full text-xs py-2 gap-1.5"
            >
              <Zap className="w-4 h-4" />
              <span>Start Ingress Tunnel</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Active Tunnels List */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Active Ingress Tunnels ({tunnels.length})</h3>
          <button
            onClick={fetchTunnels}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {loading ? (
          <Loader text="Querying Active Ingress Tunnels..." />
        ) : tunnels.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
            <Radio className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No active tunnels currently running.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tunnels.map((t) => (
              <div
                key={t.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{t.name}</span>
                    <span className="px-2 py-0.2 rounded text-[10px] uppercase font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      {t.tunnel_type}
                    </span>
                    <span className="text-slate-500">Local Port :{t.local_port}</span>
                  </div>
                  <a
                    href={t.remote_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 hover:underline flex items-center gap-1.5"
                  >
                    <span>{t.remote_url}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    onClick={() => copyUrl(t.remote_url, t.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Copy Public URL"
                  >
                    {copiedId === t.id ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleStop(t.id)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300"
                    title="Stop Tunnel"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
