import React, { useState, useEffect } from 'react';
import {
  Workflow,
  Play,
  RotateCw,
  Plus,
  Terminal,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layers,
  Server,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { automationApi } from '../services/api';
import { JenkinsJob, AnsiblePlaybook } from '../types/deploy.types';
import { Button } from '../components/common/Button';
import { Loader } from '../components/common/Loader';
import { Modal } from '../components/common/Modal';

export const Automation: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'jenkins' | 'ansible'>('jenkins');

  // Jenkins state
  const [jenkinsJobs, setJenkinsJobs] = useState<JenkinsJob[]>([]);
  const [loadingJenkins, setLoadingJenkins] = useState<boolean>(true);
  const [buildingJobs, setBuildingJobs] = useState<Record<number, boolean>>({});

  // Ansible state
  const [playbooks, setPlaybooks] = useState<AnsiblePlaybook[]>([]);
  const [selectedPlaybook, setSelectedPlaybook] = useState<AnsiblePlaybook | null>(null);
  const [runningPlaybook, setRunningPlaybook] = useState<boolean>(false);
  const [playbookOutput, setPlaybookOutput] = useState<string>('');
  const [loadingAnsible, setLoadingAnsible] = useState<boolean>(true);

  // New Ansible Playbook modal
  const [newPlaybookOpen, setNewPlaybookOpen] = useState<boolean>(false);
  const [pbName, setPbName] = useState<string>('');
  const [pbDesc, setPbDesc] = useState<string>('');
  const [pbContent, setPbContent] = useState<string>(`---
- name: Setup Web Cluster
  hosts: all
  tasks:
    - name: Ping nodes
      ping:
`);

  const fetchJenkins = async () => {
    setLoadingJenkins(true);
    try {
      const data = await automationApi.getJenkinsJobs();
      setJenkinsJobs(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingJenkins(false);
    }
  };

  const fetchAnsible = async () => {
    setLoadingAnsible(true);
    try {
      const data = await automationApi.getAnsiblePlaybooks();
      setPlaybooks(data);
      if (data.length > 0 && !selectedPlaybook) {
        setSelectedPlaybook(data[0]);
        setPlaybookOutput(data[0].last_output || '// Select or run playbook to view IaC output');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAnsible(false);
    }
  };

  useEffect(() => {
    fetchJenkins();
    fetchAnsible();
  }, []);

  const handleJenkinsBuild = async (jobId: number) => {
    setBuildingJobs(prev => ({ ...prev, [jobId]: true }));
    try {
      await automationApi.triggerJenkinsBuild(jobId);
      await fetchJenkins();
    } catch (e: any) {
      alert(`Error triggering Jenkins build: ${e.message}`);
    } finally {
      setBuildingJobs(prev => ({ ...prev, [jobId]: false }));
    }
  };

  const handleRunPlaybook = async () => {
    if (!selectedPlaybook) return;
    setRunningPlaybook(true);
    setPlaybookOutput(`[CrossPanel Ansible] Executing playbook: ${selectedPlaybook.name}...\n`);
    try {
      const res = await automationApi.runAnsiblePlaybook(selectedPlaybook.id);
      setPlaybookOutput(res.output || '[Ansible] Playbook execution completed.');
      fetchAnsible();
    } catch (e: any) {
      setPlaybookOutput(prev => prev + `\n[ERROR] Playbook execution failed: ${e.message}`);
    } finally {
      setRunningPlaybook(false);
    }
  };

  const handleCreatePlaybook = async () => {
    if (!pbName.trim() || !pbContent.trim()) return;
    try {
      await automationApi.createAnsiblePlaybook({
        name: pbName.trim(),
        description: pbDesc.trim(),
        content: pbContent
      });
      setNewPlaybookOpen(false);
      fetchAnsible();
    } catch (e: any) {
      alert(`Error creating playbook: ${e.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Workflow className="w-5 h-5 text-emerald-400" />
            DevOps Automation (Jenkins CI & Ansible IaC)
          </h2>
          <p className="text-xs text-slate-400">
            Trigger remote Jenkins CI/CD builds and execute Infrastructure as Code Ansible playbooks in 1 click.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-medium">
          <button
            onClick={() => setActiveTab('jenkins')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'jenkins'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Jenkins Pipelines
          </button>
          <button
            onClick={() => setActiveTab('ansible')}
            className={`px-3.5 py-1.5 rounded-lg transition-all ${
              activeTab === 'ansible'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Ansible Playbooks (IaC)
          </button>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'jenkins' ? (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
            <div className="text-xs text-slate-300">
              <span className="font-semibold text-white">Jenkins Remote Orchestration</span>: Connect and trigger pipeline stages with parameter injection and instant status feedback.
            </div>
            <button
              onClick={fetchJenkins}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loadingJenkins ? (
            <Loader text="Loading Jenkins Pipelines..." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {jenkinsJobs.map((job) => {
                const isBuilding = buildingJobs[job.id] || false;
                return (
                  <div
                    key={job.id}
                    className="p-5 rounded-xl bg-[#101726] border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-white font-mono">{job.name}</h3>
                          <p className="text-xs text-slate-400 font-mono">Job: {job.job_name}</p>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            job.last_status === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {job.last_status}
                        </span>
                      </div>

                      <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1">
                        <span>Last Duration: {job.last_duration || '35s'}</span>
                        <span className="text-slate-500 truncate max-w-[180px]">{job.url}</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 font-mono">CI/CD Remote Trigger</span>
                      <Button
                        onClick={() => handleJenkinsBuild(job.id)}
                        isLoading={isBuilding}
                        size="sm"
                        variant="primary"
                        className="gap-1.5 text-xs font-mono"
                      >
                        <Play className="w-3 h-3" />
                        <span>Build Now</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Ansible Playbooks Tab */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Select an Infrastructure as Code (IaC) playbook below, configure YAML tasks or inventory, and execute with 1-click.
            </p>
            <Button
              onClick={() => setNewPlaybookOpen(true)}
              size="sm"
              variant="secondary"
              className="gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Playbook</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Playbooks list (4 cols) */}
            <div className="lg:col-span-4 space-y-2">
              {playbooks.map((pb) => (
                <div
                  key={pb.id}
                  onClick={() => {
                    setSelectedPlaybook(pb);
                    setPlaybookOutput(pb.last_output || '// Click "Run Playbook" to execute');
                  }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selectedPlaybook?.id === pb.id
                      ? 'bg-emerald-950/30 border-emerald-500/50 text-white'
                      : 'bg-[#101726] border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold font-mono">{pb.name}</h4>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {pb.last_status}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{pb.description}</p>
                </div>
              ))}
            </div>

            {/* Editor & Output (8 cols) */}
            <div className="lg:col-span-8 p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
              {selectedPlaybook ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white font-mono">{selectedPlaybook.name}.yml</h3>
                      <p className="text-xs text-slate-400">{selectedPlaybook.description}</p>
                    </div>

                    <Button
                      onClick={handleRunPlaybook}
                      isLoading={runningPlaybook}
                      variant="primary"
                      size="sm"
                      className="gap-1.5 text-xs font-mono"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Run Playbook</span>
                    </Button>
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1">Playbook YAML</label>
                    <textarea
                      value={selectedPlaybook.content}
                      readOnly
                      rows={8}
                      className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none custom-scrollbar"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-slate-400" />
                      <span>Execution Logs & Play Recap</span>
                    </label>
                    <pre className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                      {playbookOutput}
                    </pre>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs font-mono">
                  No playbook selected.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Playbook Modal */}
      <Modal
        isOpen={newPlaybookOpen}
        onClose={() => setNewPlaybookOpen(false)}
        title="Create New Ansible Playbook"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Playbook Name</label>
            <input
              type="text"
              value={pbName}
              onChange={(e) => setPbName(e.target.value)}
              placeholder="e.g. configure-firewall"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Description</label>
            <input
              type="text"
              value={pbDesc}
              onChange={(e) => setPbDesc(e.target.value)}
              placeholder="Configures server rules"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">YAML Source</label>
            <textarea
              value={pbContent}
              onChange={(e) => setPbContent(e.target.value)}
              rows={10}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 focus:outline-none custom-scrollbar"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setNewPlaybookOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreatePlaybook}>
              Save Playbook
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
