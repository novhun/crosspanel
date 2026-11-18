import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  Folder,
  File,
  FileCode,
  FileText,
  Plus,
  Trash2,
  Archive,
  RefreshCw,
  Edit,
  Save,
  ArrowUp,
  KeyRound,
  CheckCircle2,
  FolderPlus,
  FilePlus
} from 'lucide-react';
import { fileApi } from '../services/api';
import { FileItem } from '../types/deploy.types';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { Loader } from '../components/common/Loader';

export const FileManagerView: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Editor modal
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editingPath, setEditingPath] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New Folder / File modal
  const [newModalOpen, setNewModalOpen] = useState<boolean>(false);
  const [newType, setNewType] = useState<'file' | 'folder'>('file');
  const [newName, setNewName] = useState<string>('');

  // Zip / Unzip modal
  const [zipModalOpen, setZipModalOpen] = useState<boolean>(false);
  const [zipTarget, setZipTarget] = useState<string>('');
  const [selectedItemForZip, setSelectedItemForZip] = useState<string>('');

  const fetchFiles = async (path: string = currentPath) => {
    setLoading(true);
    try {
      const data = await fileApi.list(path);
      setItems(data.items);
      setCurrentPath(data.current_path);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles('');
  }, []);

  const navigateTo = (path: string) => {
    fetchFiles(path);
  };

  const navigateUp = () => {
    if (!currentPath) return;
    const parts = currentPath.replace(/\\/g, '/').split('/').filter(Boolean);
    parts.pop();
    const upPath = parts.join('/');
    fetchFiles(upPath);
  };

  const handleOpenFile = async (item: FileItem) => {
    if (item.is_dir) {
      navigateTo(item.path);
      return;
    }
    setEditingPath(item.path);
    setSaveSuccess(false);
    try {
      const res = await fileApi.read(item.path);
      setFileContent(res.content);
      setEditorOpen(true);
    } catch (e: any) {
      alert(`Cannot open file: ${e.message}`);
    }
  };

  const handleSaveFile = async () => {
    setIsSaving(true);
    try {
      await fileApi.write(editingPath, fileContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      fetchFiles(currentPath);
    } catch (e: any) {
      alert(`Error saving file: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newName.trim()) return;
    const fullPath = `${currentPath}/${newName.trim()}`;
    try {
      if (newType === 'folder') {
        await fileApi.mkdir(fullPath);
      } else {
        await fileApi.write(fullPath, '');
      }
      setNewModalOpen(false);
      setNewName('');
      fetchFiles(currentPath);
    } catch (e: any) {
      alert(`Error creating ${newType}: ${e.message}`);
    }
  };

  const handleDelete = async (path: string) => {
    if (!confirm(`Are you sure you want to delete ${path}?`)) return;
    try {
      await fileApi.delete(path);
      fetchFiles(currentPath);
    } catch (e: any) {
      alert(`Error deleting item: ${e.message}`);
    }
  };

  const handleZip = async () => {
    if (!zipTarget.trim()) return;
    try {
      await fileApi.zip(selectedItemForZip, zipTarget.trim());
      setZipModalOpen(false);
      fetchFiles(currentPath);
    } catch (e: any) {
      alert(`Error creating zip: ${e.message}`);
    }
  };

  const handleUnzip = async (zipPath: string) => {
    const extractTo = prompt('Extract to path:', currentPath || '.');
    if (!extractTo) return;
    try {
      await fileApi.unzip(zipPath, extractTo);
      fetchFiles(currentPath);
    } catch (e: any) {
      alert(`Error unzipping archive: ${e.message}`);
    }
  };

  const handleChmod = async (path: string, currentMode: string) => {
    const newMode = prompt(`Enter new octal permissions (e.g. 0755, 0644):`, currentMode);
    if (!newMode) return;
    try {
      await fileApi.chmod(path, newMode);
      fetchFiles(currentPath);
    } catch (e: any) {
      alert(`Error updating permissions: ${e.message}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-emerald-400" />
            Advanced Web File Manager
          </h2>
          <p className="text-xs text-slate-400">
            Browse files, edit source code on the web, compress/extract zip archives, and inspect file permissions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setNewType('file');
              setNewName('');
              setNewModalOpen(true);
            }}
            size="sm"
            variant="secondary"
            className="gap-1 text-xs"
          >
            <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New File</span>
          </Button>

          <Button
            onClick={() => {
              setNewType('folder');
              setNewName('');
              setNewModalOpen(true);
            }}
            size="sm"
            variant="secondary"
            className="gap-1 text-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-cyan-400" />
            <span>New Folder</span>
          </Button>

          <button
            onClick={() => fetchFiles(currentPath)}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Refresh Directory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Directory Browser */}
      <div className="p-6 rounded-2xl bg-[#101726] border border-slate-800 space-y-4">
        {/* Breadcrumb Path Bar */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-2 font-mono text-xs">
          <button
            onClick={navigateUp}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Go to Parent Folder"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-500">Path:</span>
          <span className="text-emerald-400 font-bold truncate">
            {currentPath || '/ (Root Project)'}
          </span>
        </div>

        {/* Files Table */}
        {loading ? (
          <Loader text="Loading directory contents..." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Size</th>
                  <th className="pb-3 font-medium">Permissions</th>
                  <th className="pb-3 font-medium">Last Modified</th>
                  <th className="pb-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {items.map((item) => (
                  <tr
                    key={item.name}
                    className="hover:bg-slate-900/40 cursor-pointer group"
                    onDoubleClick={() => handleOpenFile(item)}
                  >
                    <td className="py-3 flex items-center gap-2 font-medium text-slate-200">
                      {item.is_dir ? (
                        <Folder className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <span
                        onClick={() => handleOpenFile(item)}
                        className="hover:underline hover:text-emerald-400"
                      >
                        {item.name}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{formatSize(item.size)}</td>
                    <td className="py-3">
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChmod(item.path, item.permissions);
                        }}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 hover:border-emerald-500/40 cursor-pointer"
                        title="Click to change CHMOD"
                      >
                        {item.permissions}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400">{item.modified}</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {!item.is_dir && (
                          <button
                            onClick={() => handleOpenFile(item)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-400"
                            title="Edit Code"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {item.name.endsWith('.zip') && (
                          <button
                            onClick={() => handleUnzip(item.path)}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-400"
                            title="Unzip Archive"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedItemForZip(item.path);
                            setZipTarget(`${item.path}.zip`);
                            setZipModalOpen(true);
                          }}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-indigo-400"
                          title="Compress to ZIP"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.path)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Code Editor Modal */}
      <Modal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        title={`Web Code Editor: ${editingPath}`}
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          <textarea
            value={fileContent}
            onChange={(e) => setFileContent(e.target.value)}
            rows={18}
            className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300 focus:outline-none focus:border-emerald-500 custom-scrollbar leading-relaxed"
          />

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <div>
              {saveSuccess && (
                <span className="text-xs text-emerald-400 font-mono inline-flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved successfully!
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditorOpen(false)}>
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveFile}
                isLoading={isSaving}
                className="gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* New File / Folder Modal */}
      <Modal
        isOpen={newModalOpen}
        onClose={() => setNewModalOpen(false)}
        title={`Create New ${newType === 'folder' ? 'Folder' : 'File'}`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">
              {newType === 'folder' ? 'Folder Name' : 'File Name (with extension)'}
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={newType === 'folder' ? 'my-dir' : 'server.py or config.json'}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setNewModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleCreateNew}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Zip Modal */}
      <Modal
        isOpen={zipModalOpen}
        onClose={() => setZipModalOpen(false)}
        title="Compress to ZIP Archive"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">Destination ZIP Path</label>
            <input
              type="text"
              value={zipTarget}
              onChange={(e) => setZipTarget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
            <Button variant="secondary" size="sm" onClick={() => setZipModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleZip}>
              Compress Now
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
