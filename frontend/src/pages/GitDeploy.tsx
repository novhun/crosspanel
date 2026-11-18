import React, { useState } from 'react';
import {
  GitBranch,
  Github,
  Gitlab,
  Rocket,
  Terminal,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Code2,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';
import { deployApi } from '../services/api';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';

interface DeploymentHistory {
  id: string;
  name: string;
  branch: string;
  commit: string;
  env: string;
  status: 'READY' | 'BUILDING' | 'FAILED';
  time: string;
}

export const GitDeploy: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/facebook/react');
  const [projectName, setProjectName] = useState<string>('my-react-app');
  const [branch, setBranch] = useState<string>('main');
  const [buildCommand, setBuildCommand] = useState<string>('npm install && npm run build');
  const [port, setPort] = useState<number>(3000);
  const [envType, setEnvType] = useState<'production' | 'preview'>('production');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: 'API_BASE_URL', value: 'https://api.crosspanel.dev' },
    { key: 'NODE_ENV', value: 'production' }
  ]);

  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [buildLogs, setBuildLogs] = useState<string>('');
  const [deployments, setDeployments] = useState<DeploymentHistory[]>([
    {
      id: 'dep-101',
      name: 'ecommerce-storefront',
      branch: 'main',
      commit: '7a8f9c2 - feat: update product catalog',
      env: 'production',
      status: 'READY',
      time: '12 minutes ago'
    },
    {
      id: 'dep-102',
      name: 'auth-service',
      branch: 'preview-oauth',
      commit: 'b3e4102 - chore: add jwt rotation',
      env: 'preview',
      status: 'READY',
      time: '1 hour ago'
    }
  ]);

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, idx) => idx !== index));
  };

  const handleDeploy = async () => {
    if (!projectName.trim() || !repoUrl.trim()) return;
    setIsDeploying(true);
    setBuildLogs(`[CrossPanel CI] Initializing deployment pipeline for ${projectName}...\n[CrossPanel CI] Connecting to repository: ${repoUrl}\n[CrossPanel CI] Target Branch: ${branch} (${envType.toUpperCase()} MODE)\n`);

    const envMap: Record<string, string> = {};
    envVars.forEach(ev => {
      if (ev.key.trim()) envMap[ev.key.trim()] = ev.value;
    });

    try {
      const res = await deployApi.deployGit({
        name: projectName.trim(),
        repo_url: repoUrl.trim(),
        branch: branch.trim(),
        env_type: envType,
        build_command: buildCommand,
        port: Number(port),
        env_vars: envMap
      });

      const logs = res.build_logs || `[CrossPanel CI] Build and deployment finished successfully.\n[CrossPanel CI] Commit: ${res.last_commit || 'HEAD'}`;
      setBuildLogs(logs);

      // Add to deployment history
      setDeployments(prev => [
        {
          id: `dep-${Math.floor(Math.random() * 9000 + 1000)}`,
          name: projectName,
          branch: branch,
          commit: res.last_commit || 'HEAD',
          env: envType,
          status: 'READY',
          time: 'Just now'
        },
        ...prev
      ]);
    } catch (e: any) {
      setBuildLogs(prev => prev + `\n[ERROR] Deployment failed: ${e.message}`);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-emerald-400" />
          Git Auto-Deploy (Vercel-like CI/CD)
        </h2>
        <p className="text-xs text-slate-400">
          Connect your GitHub or GitLab repositories with smart branch triggers, isolated environment variables, and automated continuous deployment.
        </p>
      </div>

      {/* Main Deployment Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Configuration form (7 cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Github className="w-4 h-4 text-slate-300" />
              <span>Connect & Configure Repository</span>
            </h3>

            {/* Prod / Preview toggle */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setEnvType('production')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  envType === 'production'
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Production
              </button>
              <button
                type="button"
                onClick={() => setEnvType('preview')}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  envType === 'preview'
                    ? 'bg-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Preview Mode
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                placeholder="my-cool-app"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Git Branch Trigger</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                placeholder="main"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Repository URL (GitHub / GitLab / Self-hosted)</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              placeholder="https://github.com/username/repository.git"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Build Command</label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-emerald-400 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1">Exposed Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Environment Variables */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Environment Variables ({envType.toUpperCase()})
              </span>
              <button
                type="button"
                onClick={handleAddEnvVar}
                className="text-[11px] font-mono text-emerald-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Var
              </button>
            </div>

            <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
              {envVars.map((ev, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ev.key}
                    placeholder="VARIABLE_NAME"
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
                  <button
                    type="button"
                    onClick={() => handleRemoveEnvVar(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <Button
              onClick={handleDeploy}
              isLoading={isDeploying}
              variant="primary"
              className="gap-2 text-xs"
            >
              <Rocket className="w-4 h-4" />
              <span>Deploy to {envType.toUpperCase()}</span>
            </Button>
          </div>
        </div>

        {/* Right: Live Build Logs Stream (5 cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl bg-[#101726] border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Live Build & CI Terminal</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-500">Auto Scroll</span>
            </div>

            <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-300 h-80 overflow-y-auto whitespace-pre-wrap custom-scrollbar leading-relaxed">
              {buildLogs || '// Waiting for deployment trigger...\n// Push to branch or click "Deploy to Production" above.'}
            </pre>
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between font-mono">
            <span>Branch Trigger Status</span>
            <span className="text-emerald-400">Listening to Webhooks</span>
          </div>
        </div>
      </div>

      {/* Deployments History Table */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        <h3 className="text-sm font-semibold text-white">Recent Continuous Deployments</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-medium">Project</th>
                <th className="pb-3 font-medium">Environment</th>
                <th className="pb-3 font-medium">Commit</th>
                <th className="pb-3 font-medium">Branch</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Deployed</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {deployments.map((d) => (
                <tr key={d.id} className="hover:bg-slate-900/40">
                  <td className="py-3 font-semibold text-white">{d.name}</td>
                  <td className="py-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                      d.env === 'production' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-cyan-500/20 text-cyan-400'
                    }`}>
                      {d.env}
                    </span>
                  </td>
                  <td className="py-3 text-slate-300 truncate max-w-xs">{d.commit}</td>
                  <td className="py-3 text-slate-400">{d.branch}</td>
                  <td className="py-3">
                    <span className="inline-flex items-center gap-1 text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {d.status}
                    </span>
                  </td>
                  <td className="py-3 text-slate-400">{d.time}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={handleDeploy}
                      className="text-xs text-slate-400 hover:text-emerald-400 inline-flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3" /> Redeploy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
