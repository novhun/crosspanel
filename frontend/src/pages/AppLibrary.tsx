import React, { useState, useEffect } from 'react';
import {
  Layers,
  Box,
  Rocket,
  Globe,
  Database,
  Code2,
  Server,
  Link,
  Plus,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { deployApi } from '../services/api';
import { AppTemplate } from '../types/deploy.types';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { PageId } from '../store/useAppStore';

interface AppLibraryProps {
  onNavigate: (page: PageId) => void;
}

export const AppLibrary: React.FC<AppLibraryProps> = ({ onNavigate }) => {
  const [templates, setTemplates] = useState<Record<string, AppTemplate>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Deploy Modal
  const [deployModalOpen, setDeployModalOpen] = useState<boolean>(false);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [appName, setAppName] = useState<string>('');
  const [appPort, setAppPort] = useState<number>(8080);
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deployResult, setDeployResult] = useState<string | null>(null);

  // Custom Source URL state
  const [customUrl, setCustomUrl] = useState<string>('');
  const [customName, setCustomName] = useState<string>('');
  const [customPort, setCustomPort] = useState<number>(5000);
  const [isDeployingCustom, setIsDeployingCustom] = useState<boolean>(false);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const data = await deployApi.getTemplates();
        setTemplates(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const openDeployModal = (key: string, tpl: AppTemplate) => {
    setSelectedKey(key);
    setAppName(`${key}-app-${Math.floor(Math.random() * 900 + 100)}`);
    setAppPort(tpl.default_port);
    const envs = Object.entries(tpl.default_env || {}).map(([k, v]) => ({ key: k, value: v }));
    setEnvVars(envs);
    setDeployResult(null);
    setDeployModalOpen(true);
  };

  const handleDeploy = async () => {
    if (!appName.trim() || !appPort) return;
    setIsDeploying(true);
    setDeployResult(null);

    const envMap: Record<string, string> = {};
    envVars.forEach(ev => {
      if (ev.key.trim()) envMap[ev.key.trim()] = ev.value;
    });

    try {
      const res = await deployApi.deployOneClick({
        name: appName.trim(),
        template_name: selectedKey,
        port: Number(appPort),
        env_vars: envMap
      });
      setDeployResult(res.message || 'Application deployed successfully!');
      setTimeout(() => {
        setDeployModalOpen(false);
        onNavigate('docker');
      }, 1500);
    } catch (e: any) {
      setDeployResult(`Error: ${e.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleDeployCustomUrl = async () => {
    if (!customUrl.trim() || !customName.trim()) return;
    setIsDeployingCustom(true);
    try {
      await deployApi.deployOneClick({
        name: customName.trim(),
        template_name: 'custom',
        port: Number(customPort),
        source_url: customUrl.trim()
      });
      onNavigate('docker');
    } catch (e: any) {
      alert(`Deployment failed: ${e.message}`);
    } finally {
      setIsDeployingCustom(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-emerald-400" />
          App Library & 1-Click Catalog
        </h2>
        <p className="text-xs text-slate-400">
          Instant Docker deployment for popular web apps, databases, API frameworks, and custom source URLs.
        </p>
      </div>

      {/* Custom Source URL Box */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 to-[#101726] border border-cyan-500/20 space-y-3">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Deploy from Custom Source URL</h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
            Docker Hub • Git • Zip
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Enter any Docker image name (e.g. <code className="text-cyan-300">ghost:latest</code>), Git repository link, or Zip archive URL. CrossPanel automatically provisions the container.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="App Name (e.g. my-service)"
            className="sm:col-span-3 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          />
          <input
            type="text"
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            placeholder="Source URL / Docker Image (e.g. ghost:alpine or https://github.com/...)"
            className="sm:col-span-5 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          />
          <input
            type="number"
            value={customPort}
            onChange={(e) => setCustomPort(Number(e.target.value))}
            placeholder="Port"
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
          />
          <Button
            onClick={handleDeployCustomUrl}
            isLoading={isDeployingCustom}
            variant="primary"
            className="sm:col-span-2 text-xs"
          >
            Deploy Source
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <Loader text="Loading App Catalog..." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(templates).map(([key, tpl]) => (
            <div
              key={key}
              className="p-5 rounded-xl bg-[#101726] border border-slate-800 hover:border-emerald-500/40 transition-all shadow-sm flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors font-mono">
                      {tpl.name}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {tpl.category}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-400">
                    Port :{tpl.default_port}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{tpl.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] font-mono text-slate-500">Docker Powered</span>
                <button
                  onClick={() => openDeployModal(key, tpl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 text-xs font-medium transition-all shadow"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>1-Click Deploy</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deploy Modal */}
      <Modal
        isOpen={deployModalOpen}
        onClose={() => setDeployModalOpen(false)}
        title={`Deploy Template: ${selectedKey.toUpperCase()}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Application Name</label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Public Exposed Port</label>
            <input
              type="number"
              value={appPort}
              onChange={(e) => setAppPort(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-mono text-slate-400">Environment Variables</label>
              <button
                type="button"
                onClick={() => setEnvVars([...envVars, { key: '', value: '' }])}
                className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Var
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
              {envVars.map((ev, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="text"
                    value={ev.key}
                    placeholder="KEY"
                    onChange={(e) => {
                      const next = [...envVars];
                      next[idx].key = e.target.value;
                      setEnvVars(next);
                    }}
                    className="w-1/2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={ev.value}
                    placeholder="VALUE"
                    onChange={(e) => {
                      const next = [...envVars];
                      next[idx].value = e.target.value;
                      setEnvVars(next);
                    }}
                    className="w-1/2 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          {deployResult && (
            <div className="p-3 rounded-lg bg-slate-950 border border-emerald-500/40 text-emerald-400 text-xs font-mono whitespace-pre-wrap">
              {deployResult}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setDeployModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleDeploy}
              isLoading={isDeploying}
              className="gap-1.5"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Launch Now</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
