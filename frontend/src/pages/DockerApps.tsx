import React, { useState, useEffect } from 'react';
import {
  Box,
  Play,
  RotateCw,
  Square,
  Trash2,
  Terminal,
  FileCode,
  RefreshCw,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { deployApi } from '../services/api';
import { DeployedApp } from '../types/deploy.types';
import { Modal } from '../components/common/Modal';
import { Loader } from '../components/common/Loader';
import { Button } from '../components/common/Button';

export const DockerApps: React.FC = () => {
  const [apps, setApps] = useState<DeployedApp[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'apps' | 'compose'>('apps');

  // Logs modal
  const [logsModalOpen, setLogsModalOpen] = useState<boolean>(false);
  const [logsTitle, setLogsTitle] = useState<string>('');
  const [logsContent, setLogsContent] = useState<string>('');
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);

  // Custom compose state
  const [composeName, setComposeName] = useState<string>('custom-stack');
  const [composeYaml, setComposeYaml] = useState<string>(`version: '3.8'
services:
  web:
    image: nginx:alpine
    ports:
      - "8085:80"
    restart: always
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
`);
  const [isDeployingCompose, setIsDeployingCompose] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const data = await deployApi.getApps();
      setApps(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleRestart = async (id: number) => {
    try {
      await deployApi.restartApp(id);
      fetchApps();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStop = async (id: number) => {
    try {
      await deployApi.stopApp(id);
      fetchApps();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to remove this application?')) return;
    try {
      await deployApi.deleteApp(id);
      fetchApps();
    } catch (e) {
      console.error(e);
    }
  };

  const handleViewLogs = async (id: number, name: string) => {
    setLogsTitle(`Container Logs: ${name}`);
    setLogsModalOpen(true);
    setLoadingLogs(true);
    try {
      const res = await deployApi.getLogs(id);
      setLogsContent(res.logs || 'No output recorded.');
    } catch (e: any) {
      setLogsContent(`Error retrieving logs: ${e.message}`);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleDeployCompose = async () => {
    if (!composeName.trim() || !composeYaml.trim()) return;
    setIsDeployingCompose(true);
    setStatusMessage(null);
    try {
      const res = await deployApi.deployCustomCompose({
        name: composeName,
        compose_yaml: composeYaml
      });
      setStatusMessage(res.message || 'Custom stack deployed.');
      setActiveTab('apps');
      fetchApps();
    } catch (e: any) {
      setStatusMessage(`Error: ${e.message}`);
    } finally {
      setIsDeployingCompose(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Box className="w-5 h-5 text-emerald-400" />
            Docker Applications & Stacks
          </h2>
          <p className="text-xs text-slate-400">
            Manage active containers, view real-time runtime logs, or deploy custom Docker Compose templates.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
          <button
            onClick={() => setActiveTab('apps')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'apps'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Applications ({apps.length})
          </button>
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'compose'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Run Custom Compose
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs font-mono">
          {statusMessage}
        </div>
      )}

      {/* Content */}
      {activeTab === 'apps' ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={fetchApps}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Apps</span>
            </button>
          </div>

          {loading ? (
            <Loader text="Loading Docker Applications..." />
          ) : apps.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-[#101726] border border-slate-800 space-y-3">
              <Box className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-sm font-semibold text-slate-300">No Applications Deployed Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Visit the App Library to deploy WordPress, FastAPI, Node, or Laravel with 1-click, or use Custom Compose.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className="p-5 rounded-xl bg-[#101726] border border-slate-800 hover:border-slate-700 transition-all shadow-sm flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-white font-mono">{app.name}</h3>
                        <span className="text-[10px] font-mono uppercase text-emerald-400">
                          Template: {app.template_name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                          app.status === 'running'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 font-mono text-[11px]">
                      {app.port && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Exposed Port:</span>
                          <a
                            href={`http://localhost:${app.port}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1"
                          >
                            <span>:{app.port}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                      {app.git_branch && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Branch:</span>
                          <span className="text-slate-300">{app.git_branch}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <button
                      onClick={() => handleViewLogs(app.id, app.name)}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white"
                    >
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>Logs</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestart(app.id)}
                        title="Restart"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleStop(app.id)}
                        title="Stop"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rose-400"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(app.id)}
                        title="Delete"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Custom Compose Tab */
        <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Custom Docker Compose Runner</h3>
            <p className="text-xs text-slate-400">
              Run any multi-container Docker compose specification directly on this machine.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Stack Name</label>
              <input
                type="text"
                value={composeName}
                onChange={(e) => setComposeName(e.target.value)}
                className="w-full sm:w-1/2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                placeholder="e.g. analytics-stack"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">docker-compose.yml</label>
              <textarea
                value={composeYaml}
                onChange={(e) => setComposeYaml(e.target.value)}
                rows={12}
                className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 custom-scrollbar"
                placeholder="version: '3.8'..."
              />
            </div>

            <Button
              onClick={handleDeployCompose}
              isLoading={isDeployingCompose}
              variant="primary"
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              <span>Deploy Custom Stack</span>
            </Button>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      <Modal
        isOpen={logsModalOpen}
        onClose={() => setLogsModalOpen(false)}
        title={logsTitle}
        maxWidth="max-w-3xl"
      >
        <div className="space-y-3">
          {loadingLogs ? (
            <Loader text="Streaming container logs..." />
          ) : (
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-300 max-h-[60vh] overflow-y-auto whitespace-pre-wrap">
              {logsContent}
            </pre>
          )}
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => setLogsModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
