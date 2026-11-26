import { useEffect, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Clipboard,
  Copy,
  Download,
  FilePlus,
  FileText,
  FileWarning,
  Folder,
  FolderOpen,
  FolderPlus,
  Grid2X2,
  HardDrive,
  Image as ImageIcon,
  Info,
  KeyRound,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Scissors,
  Search,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { filesApi } from "@/api/files.api";
import type { OsPlaceItem, OsTrashItem } from "@/types/files.types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { PageHeader, Pill, inputCls } from "./ui";
import { descendants, entryPath, fileEntries, pasteEntries, validateEntryName, type ExplorerEntry } from "./file-data";

type FileDialog = { type: "folder" | "file" | "rename" | "permissions" | "properties"; entry?: WorkspaceEntry | undefined };

type WorkspaceEntry = ExplorerEntry & {
  realPath?: string;
  sizeBytes?: number;
  isSymlink?: boolean;
};

const isTestMode = import.meta.env.MODE === "test";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".bmp",
  ".ico",
  ".avif",
]);

const UNSUPPORTED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".dat",
  ".iso",
  ".img",
  ".dmg",
  ".deb",
  ".rpm",
  ".apk",
  ".tar",
  ".gz",
  ".bz2",
  ".xz",
  ".7z",
  ".rar",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".mp3",
  ".wav",
  ".ogg",
  ".flac",
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".webm",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".sqlite",
  ".db",
  ".pyc",
  ".class",
  ".o",
  ".a",
]);

function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  if (idx <= 0) return "";
  return name.slice(idx).toLowerCase();
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

function isUnsupportedFile(name: string): boolean {
  return UNSUPPORTED_EXTENSIONS.has(getFileExtension(name));
}

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
};

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let val = bytes / 1024;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val >= 10 ? val.toFixed(0) : val.toFixed(1)} ${units[idx]}`;
}

function joinOsPath(dirPath: string, name: string): string {
  const cleanDir = dirPath.replace(/\/+$/, "");
  if (!cleanDir) return `/${name}`;
  return `${cleanDir}/${name}`;
}

function parentOsPath(itemPath: string): string {
  const idx = itemPath.lastIndexOf("/");
  if (idx <= 0) return "/";
  return itemPath.slice(0, idx);
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === "object") {
    const record = err as { detail?: unknown; message?: unknown };
    if (record.detail && typeof record.detail === "object" && "detail" in record.detail) {
      const inner = (record.detail as { detail?: unknown }).detail;
      if (typeof inner === "string" && inner) return inner;
      if (Array.isArray(inner) && inner.length > 0) {
        const firstMsg = (inner[0] as { msg?: unknown })?.msg;
        if (typeof firstMsg === "string" && firstMsg) return firstMsg;
      }
    }
    if (typeof record.detail === "string" && record.detail) return record.detail;
    if (typeof record.message === "string" && record.message) return record.message;
  }
  return fallback;
}

function FileIcon({ entry, large = false }: { entry: WorkspaceEntry; large?: boolean }) {
  const image = !entry.directory && isImageFile(entry.name);
  const zip = !entry.directory && entry.name.toLowerCase().endsWith(".zip");
  const unsupported = !entry.directory && isUnsupportedFile(entry.name);
  const Icon = entry.directory
    ? Folder
    : zip
    ? Archive
    : image
    ? ImageIcon
    : unsupported
    ? FileWarning
    : FileText;
  return (
    <Icon
      className={`${large ? "size-10" : "size-4"} shrink-0 ${
        entry.directory
          ? "text-warning"
          : zip
          ? "text-success"
          : image
          ? "text-primary"
          : unsupported
          ? "text-muted-foreground"
          : "text-cyan"
      }`}
    />
  );
}

export function FilesWorkspace() {
  // Demo/Test state (used in Vitest unit tests when backend is mocked/absent)
  const [entries, setEntries] = useState<WorkspaceEntry[]>(fileEntries);
  const [history, setHistory] = useState<number[]>([4]);
  const [position, setPosition] = useState(0);
  const current = history[position] ?? 4;
  const demoFolder = entries.find((entry) => entry.id === current);

  // Live OS state
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(!isTestMode);
  const [busy, setBusy] = useState(false);
  const [liveItems, setLiveItems] = useState<WorkspaceEntry[]>([]);
  const [currentOsPath, setCurrentOsPath] = useState("");
  const [parentOsDir, setParentOsDir] = useState<string | null>(null);
  const [places, setPlaces] = useState<OsPlaceItem[]>([]);
  const [osHistory, setOsHistory] = useState<string[]>([]);
  const [osPosition, setOsPosition] = useState(0);

  // Trash state
  const [trashMode, setTrashMode] = useState(false);
  const [trashItems, setTrashItems] = useState<OsTrashItem[]>([]);
  const [trashCount, setTrashCount] = useState(0);
  const [selectedTrash, setSelectedTrash] = useState<string[]>([]);
  const [emptyTrashConfirm, setEmptyTrashConfirm] = useState(false);
  const [demoTrash, setDemoTrash] = useState<WorkspaceEntry[]>([]);

  // Shared UI state
  const [pathDraft, setPathDraft] = useState(isTestMode ? "/var/www/shop" : "");
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState(true);
  const [view, setView] = useState("list");
  const [sort, setSort] = useState("Name");
  const [descending, setDescending] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [clipboard, setClipboard] = useState<{ ids: number[]; paths: string[]; move: boolean }>();
  const [dialog, setDialog] = useState<FileDialog>();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState<WorkspaceEntry[]>();
  const [editor, setEditor] = useState<WorkspaceEntry>();
  const [content, setContent] = useState("");
  const [imagePreview, setImagePreview] = useState<{ entry: WorkspaceEntry; zoom: number; src: string }>();
  const [unsupportedFile, setUnsupportedFile] = useState<{ entry: WorkspaceEntry; reason: string }>();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  async function loadOsDirectory(targetPath = "", pushHistory = true) {
    setLoading(true);
    setTrashMode(false);
    try {
      const data = await filesApi.list(targetPath);
      const mapped: WorkspaceEntry[] = data.items.map((item, idx) => ({
        id: idx + 1,
        parent: null,
        name: item.name,
        directory: item.is_dir,
        size: item.is_dir ? "—" : formatBytes(item.size),
        sizeBytes: item.size,
        permissions: item.permissions,
        owner: item.owner || "user",
        modified: item.modified,
        content: "",
        realPath: item.path,
        isSymlink: Boolean(item.is_symlink),
      }));
      setLiveItems(mapped);
      setCurrentOsPath(data.current_path);
      setParentOsDir(data.parent_path);
      if (data.places) setPlaces(data.places);
      if (typeof data.trash_count === "number") setTrashCount(data.trash_count);
      setPathDraft(data.current_path);
      setSelected([]);
      setQuery("");
      setIsLive(true);

      if (pushHistory) {
        setOsHistory((prev) => {
          const base = prev.slice(0, osPosition + 1);
          if (base[base.length - 1] === data.current_path) {
            setOsPosition(base.length - 1);
            return base;
          }
          const next = [...base, data.current_path];
          setOsPosition(next.length - 1);
          return next;
        });
      }
    } catch (err) {
      if (!isLive && osHistory.length === 0) {
        setIsLive(false);
      }
      toast.error(getErrorMessage(err, "Failed to load directory from OS API."));
    } finally {
      setLoading(false);
    }
  }

  async function openTrashView() {
    setTrashMode(true);
    setSelectedTrash([]);
    setQuery("");
    if (!isLive) return;
    setLoading(true);
    try {
      const res = await filesApi.listTrash();
      setTrashItems(res.items);
      setTrashCount(res.items.length);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to load Trash."));
    } finally {
      setLoading(false);
    }
  }

  async function handleRestoreTrash(ids: string[]) {
    if (!ids.length) return;
    if (!isLive) {
      const idSet = new Set(ids.map((id) => Number(id)));
      const restoring = demoTrash.filter((item) => idSet.has(item.id));
      setEntries((prev) => [...prev, ...restoring]);
      setDemoTrash((prev) => prev.filter((item) => !idSet.has(item.id)));
      setSelectedTrash([]);
      toast("Restored items from preview trash");
      return;
    }
    setBusy(true);
    try {
      const res = await filesApi.restoreTrash(ids);
      toast.success(res.message);
      setSelectedTrash([]);
      await openTrashView();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to restore item(s)."));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTrashPermanent(ids: string[]) {
    if (!ids.length) return;
    if (!isLive) {
      const idSet = new Set(ids.map((id) => Number(id)));
      setDemoTrash((prev) => prev.filter((item) => !idSet.has(item.id)));
      setSelectedTrash([]);
      toast("Permanently deleted items from preview trash");
      return;
    }
    setBusy(true);
    try {
      const res = await filesApi.deleteTrash(ids);
      toast.success(res.message);
      setSelectedTrash([]);
      await openTrashView();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to permanently delete item(s)."));
    } finally {
      setBusy(false);
    }
  }

  async function handleEmptyTrash() {
    if (!isLive) {
      setDemoTrash([]);
      setSelectedTrash([]);
      setEmptyTrashConfirm(false);
      toast("Preview trash emptied");
      return;
    }
    setBusy(true);
    try {
      const res = await filesApi.emptyTrash();
      toast.success(res.message);
      setTrashItems([]);
      setTrashCount(0);
      setSelectedTrash([]);
      setEmptyTrashConfirm(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to empty Trash."));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!isTestMode) {
      loadOsDirectory("", true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function navigateDemo(id: number) {
    if (!entries.some((entry) => entry.id === id && entry.directory)) return;
    setHistory((items) => [...items.slice(0, position + 1), id]);
    setPosition(position + 1);
    setPathDraft(entryPath(entries, id));
    setSelected([]);
    setQuery("");
  }

  function travel(offset: number) {
    if (isLive) {
      const nextPos = osPosition + offset;
      const target = osHistory[nextPos];
      if (!target) return;
      setOsPosition(nextPos);
      loadOsDirectory(target, false);
      return;
    }
    const id = history[position + offset];
    if (id === undefined || !entries.some((entry) => entry.id === id)) return;
    setPosition(position + offset);
    setPathDraft(entryPath(entries, id));
    setSelected([]);
    setQuery("");
  }

  async function openTextEditor(entry: WorkspaceEntry) {
    if (isLive && entry.realPath) {
      setBusy(true);
      try {
        const res = await filesApi.read(entry.realPath);
        setEditor({ ...entry, content: res.content });
        setContent(res.content);
      } catch (err) {
        const reason = getErrorMessage(err, `This file type is not supported for viewing or editing.`);
        const lower = reason.toLowerCase();
        if (lower.includes("binary") || lower.includes("exceeds") || lower.includes("not supported")) {
          setUnsupportedFile({ entry, reason });
          toast.error(`Not supported: cannot open ${entry.name}`);
        } else {
          toast.error(reason);
        }
      } finally {
        setBusy(false);
      }
      return;
    }
    setEditor(entry);
    setContent(entry.content);
  }

  function closeImagePreview() {
    setImagePreview((prev) => {
      if (prev?.src.startsWith("blob:")) URL.revokeObjectURL(prev.src);
      return undefined;
    });
  }

  async function openImageViewer(entry: WorkspaceEntry) {
    if (!isLive || !entry.realPath) {
      setImagePreview({ entry, zoom: 1, src: "" });
      return;
    }
    setBusy(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("cp_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      let response = await fetch(filesApi.viewUrl(entry.realPath), headers ? { headers } : undefined);
      if (response.status === 404) {
        response = await fetch(filesApi.downloadUrl(entry.realPath), headers ? { headers } : undefined);
      }
      if (!response.ok) {
        let detail = response.statusText || `HTTP ${response.status}`;
        try {
          const body = (await response.json()) as { detail?: string };
          if (body?.detail) detail = body.detail;
        } catch {
          // ignore
        }
        throw new Error(detail);
      }
      const rawBlob = await response.blob();
      const mime = IMAGE_MIME_BY_EXT[getFileExtension(entry.name)] || rawBlob.type || "image/png";
      const typedBlob = rawBlob.type === mime ? rawBlob : new Blob([rawBlob], { type: mime });
      const blobUrl = URL.createObjectURL(typedBlob);
      setImagePreview((prev) => {
        if (prev?.src.startsWith("blob:")) URL.revokeObjectURL(prev.src);
        return { entry, zoom: 1, src: blobUrl };
      });
    } catch (err) {
      setUnsupportedFile({
        entry,
        reason: getErrorMessage(err, "Failed to load image file from host OS."),
      });
      toast.error(`Cannot open ${entry.name}`);
    } finally {
      setBusy(false);
    }
  }

  async function openEntry(entry: WorkspaceEntry) {
    if (isLive && entry.realPath) {
      if (entry.directory) {
        await loadOsDirectory(entry.realPath, true);
        return;
      }
      if (entry.name.toLowerCase().endsWith(".zip")) {
        showDialog("properties", entry);
        return;
      }
      if (isImageFile(entry.name)) {
        await openImageViewer(entry);
        return;
      }
      if (isUnsupportedFile(entry.name)) {
        setUnsupportedFile({
          entry,
          reason: `File format "${getFileExtension(entry.name) || "binary"}" is not supported for in-app preview.`,
        });
        toast.error(`Not supported: cannot open ${entry.name}`);
        return;
      }
      await openTextEditor(entry);
      return;
    }

    if (entry.directory) navigateDemo(entry.id);
    else if (entry.name.endsWith(".zip")) showDialog("properties", entry);
    else if (isImageFile(entry.name)) await openImageViewer(entry);
    else if (isUnsupportedFile(entry.name)) {
      setUnsupportedFile({
        entry,
        reason: `File format "${getFileExtension(entry.name) || "binary"}" is not supported for in-app preview.`,
      });
    } else {
      setEditor(entry);
      setContent(entry.content);
    }
  }

  function showDialog(type: FileDialog["type"], entry?: WorkspaceEntry) {
    setDialog({ type, entry });
    setValue(type === "permissions" ? entry?.permissions ?? "644" : type === "rename" ? entry?.name ?? "" : "");
    setError("");
  }

  function setClipboardFromEntries(items: WorkspaceEntry[], move: boolean) {
    setClipboard({
      ids: items.map((item) => item.id),
      paths: items.map((item) => item.realPath || "").filter(Boolean),
      move,
    });
  }

  async function paste() {
    if (!clipboard) return;
    if (isLive) {
      if (!clipboard.paths.length) return;
      setBusy(true);
      try {
        const res = clipboard.move
          ? await filesApi.move(clipboard.paths, currentOsPath)
          : await filesApi.copy(clipboard.paths, currentOsPath);
        toast.success(res.message || "Paste completed");
        if (clipboard.move) setClipboard(undefined);
        await loadOsDirectory(currentOsPath, false);
      } catch (err) {
        toast.error(getErrorMessage(err, "Cannot paste selected items."));
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      setEntries(pasteEntries(entries, clipboard.ids, current, clipboard.move));
      setClipboard(undefined);
      setSelected([]);
      toast("Items pasted into preview", { description: "Demo only — no real files read, written or uploaded." });
    } catch (issue) {
      toast.error(issue instanceof Error ? issue.message : "Cannot paste these items.");
    }
  }

  async function handleZip(entry: WorkspaceEntry) {
    if (!isLive || !entry.realPath) {
      toast(`Archive preview: ${entry.name}`, { description: "Demo only — no archive created." });
      return;
    }
    setBusy(true);
    try {
      const targetZip = `${entry.realPath}.zip`;
      const res = await filesApi.zip(entry.realPath, targetZip);
      toast.success(res.message);
      await loadOsDirectory(currentOsPath, false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create zip archive."));
    } finally {
      setBusy(false);
    }
  }

  async function handleUnzip(entry: WorkspaceEntry) {
    if (!isLive || !entry.realPath) return;
    setBusy(true);
    try {
      const res = await filesApi.unzip(entry.realPath, currentOsPath);
      toast.success(res.message);
      await loadOsDirectory(currentOsPath, false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to extract archive."));
    } finally {
      setBusy(false);
    }
  }

  function handleDownload(entry: WorkspaceEntry) {
    if (!isLive || !entry.realPath) {
      toast(`Download preview: ${entry.name}`, { description: "Demo only — no file downloaded." });
      return;
    }
    if (entry.directory) {
      toast.info("Create a .zip archive first to download a folder.");
      return;
    }
    const link = document.createElement("a");
    link.href = filesApi.downloadUrl(entry.realPath);
    link.download = entry.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  const activeItems: WorkspaceEntry[] = isLive
    ? liveItems
    : entries.filter((entry) => entry.parent === current);

  const visible = activeItems
    .filter(
      (entry) =>
        (hidden || !entry.name.startsWith(".")) &&
        entry.name.toLowerCase().includes(query.toLowerCase())
    )
    .sort((a, b) => {
      const dirOrder = Number(b.directory) - Number(a.directory);
      if (dirOrder !== 0) return dirOrder;
      const factor = descending ? -1 : 1;
      if (sort === "Type") {
        const ta = a.directory ? "Folder" : a.name.split(".").pop() ?? "";
        const tb = b.directory ? "Folder" : b.name.split(".").pop() ?? "";
        return factor * ta.localeCompare(tb);
      }
      if (sort === "Owner") return factor * a.owner.localeCompare(b.owner);
      if (sort === "Size") return factor * ((a.sizeBytes ?? 0) - (b.sizeBytes ?? 0));
      if (sort === "Modified") return factor * a.modified.localeCompare(b.modified);
      return factor * a.name.localeCompare(b.name);
    });

  const selectedEntries = visible.filter((entry) => selected.includes(entry.id));
  const firstSelected = selectedEntries[0];
  const demoFolders = entries.filter((entry) => entry.directory);
  const activePathDisplay = isLive ? currentOsPath : entryPath(entries, current);
  const canBack = isLive ? osPosition > 0 : position > 0;
  const canForward = isLive ? osPosition < osHistory.length - 1 : position < history.length - 1;
  const canUp = isLive ? parentOsDir !== null : demoFolder?.parent !== null;

  function menuItems(entry: WorkspaceEntry) {
    const defer = (fn: () => void) => () => setTimeout(fn, 0);
    const items = [
      { label: "Open", icon: FolderOpen, action: () => openEntry(entry) },
      { label: "Rename", icon: Pencil, action: defer(() => showDialog("rename", entry)) },
      { label: "Copy", icon: Copy, action: () => setClipboardFromEntries([entry], false) },
      { label: "Cut", icon: Scissors, action: () => setClipboardFromEntries([entry], true) },
      { label: "Permissions", icon: KeyRound, action: defer(() => showDialog("permissions", entry)) },
      { label: "Properties", icon: Info, action: defer(() => showDialog("properties", entry)) },
      { label: "Compress (.zip)", icon: Archive, action: () => handleZip(entry) },
    ];
    if (isLive && entry.name.toLowerCase().endsWith(".zip") && !entry.directory) {
      items.push({ label: "Extract here", icon: Archive, action: () => handleUnzip(entry) });
    }
    if (!entry.directory) {
      items.push({ label: "Download", icon: Download, action: () => handleDownload(entry) });
    }
    items.push({ label: "Delete", icon: Trash2, action: defer(() => setRemoving([entry])) });
    return items;
  }

  return (
    <>
      <PageHeader
        title="File Manager"
        desc="Server folders & project files"
        action={
          <Pill tone={isLive ? "success" : "muted"}>
            {isLive ? "● Connected (OS Filesystem)" : "Demo · Not connected"}
          </Pill>
        }
      />

      <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
          {trashMode ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setTrashMode(false);
                  if (isLive) loadOsDirectory(currentOsPath, false);
                }}
              >
                <ArrowLeft />
                Back to Files
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!selectedTrash.length || busy}
                onClick={() => handleRestoreTrash(selectedTrash)}
              >
                <RotateCcw />
                Restore Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                disabled={!selectedTrash.length || busy}
                onClick={() => handleDeleteTrashPermanent(selectedTrash)}
              >
                <Trash2 />
                Delete Permanently
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="ml-auto"
                disabled={(isLive ? trashItems.length === 0 : demoTrash.length === 0) || busy}
                onClick={() => setEmptyTrashConfirm(true)}
              >
                <Trash2 />
                Empty Trash
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => showDialog("folder")}>
                <FolderPlus />
                New Folder
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => showDialog("file")}>
                <FilePlus />
                New File
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setUploadOpen(true);
                  setUploadFiles([]);
                }}
              >
                <Upload />
                Upload
              </Button>
              <span className="mx-1 hidden h-5 border-l border-border sm:block" />
              {[
                {
                  label: "Cut",
                  icon: Scissors,
                  action: () => setClipboardFromEntries(selectedEntries, true),
                  disabled: !selectedEntries.length,
                },
                {
                  label: "Copy",
                  icon: Copy,
                  action: () => setClipboardFromEntries(selectedEntries, false),
                  disabled: !selectedEntries.length,
                },
                {
                  label: "Paste",
                  icon: Clipboard,
                  action: paste,
                  disabled: !clipboard || busy,
                },
                {
                  label: "Rename",
                  icon: Pencil,
                  action: () => {
                    if (firstSelected) showDialog("rename", firstSelected);
                  },
                  disabled: selectedEntries.length !== 1 || busy,
                },
                {
                  label: "Delete",
                  icon: Trash2,
                  action: () => setRemoving(selectedEntries),
                  disabled: !selectedEntries.length || busy,
                },
              ].map((action) => (
                <Button
                  key={action.label}
                  size="icon"
                  variant="ghost"
                  aria-label={action.label}
                  title={action.label}
                  disabled={action.disabled}
                  onClick={action.action}
                >
                  <action.icon />
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                onClick={openTrashView}
              >
                <Trash2 className="text-warning" />
                Trash ({isLive ? trashCount : demoTrash.length})
              </Button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-border p-2">
          <Button size="icon" variant="ghost" aria-label="Back" title="Back" disabled={!canBack || loading} onClick={() => travel(-1)}>
            <ArrowLeft />
          </Button>
          <Button size="icon" variant="ghost" aria-label="Forward" title="Forward" disabled={!canForward || loading} onClick={() => travel(1)}>
            <ArrowRight />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Up one folder"
            title="Up one folder"
            disabled={!canUp || loading}
            onClick={() => {
              if (isLive) {
                if (parentOsDir) loadOsDirectory(parentOsDir, true);
              } else if (demoFolder?.parent !== null && demoFolder?.parent !== undefined) {
                navigateDemo(demoFolder.parent);
              }
            }}
          >
            <ArrowUp />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Refresh folder"
            title="Refresh folder"
            disabled={loading}
            onClick={() => {
              if (trashMode) openTrashView();
              else if (isLive) loadOsDirectory(currentOsPath, false);
              else toast("Sample folder refreshed", { description: "Demo only — no real files read, written or uploaded." });
            }}
          >
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
          <form
            className="min-w-0 flex-1 basis-44"
            onSubmit={(event) => {
              event.preventDefault();
              const target = pathDraft.trim();
              if (isLive) {
                loadOsDirectory(target || "/", true);
                return;
              }
              const match = demoFolders.find(
                (entry) => entryPath(entries, entry.id) === target.replace(/\/$/, "") || (entry.parent === null && target === "/")
              );
              if (match) navigateDemo(match.id);
              else toast.error("Folder not found in this preview.");
            }}
          >
            <input
              aria-label="Folder path"
              className={`${inputCls} font-mono text-xs`}
              value={pathDraft}
              onChange={(event) => setPathDraft(event.target.value)}
            />
          </form>
          <label className="relative w-full sm:w-44">
            <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <input
              aria-label="Search current folder"
              className={`${inputCls} pl-9`}
              value={query}
              placeholder="Search this folder"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2 text-xs">
          <span className="min-w-0 break-all font-mono text-muted-foreground">
            {trashMode ? "Trash (~/.local/share/Trash)" : activePathDisplay || "Loading..."}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-muted-foreground">
              Hidden files
              <Switch aria-label="Show hidden files" checked={hidden} onCheckedChange={setHidden} />
            </label>
            <select
              aria-label="Sort files"
              className="h-8 rounded-md border border-input bg-secondary px-2 text-xs"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              {["Name", "Size", "Type", "Owner", "Modified"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <Button size="icon" variant="ghost" aria-label="Reverse sort" title="Reverse sort" onClick={() => setDescending(!descending)}>
              <ArrowDown className={descending ? "rotate-180 transition-transform" : "transition-transform"} />
            </Button>
            <Button size="icon" variant={view === "list" ? "secondary" : "ghost"} aria-label="List view" title="List view" onClick={() => setView("list")}>
              <List />
            </Button>
            <Button size="icon" variant={view === "grid" ? "secondary" : "ghost"} aria-label="Grid view" title="Grid view" onClick={() => setView("grid")}>
              <Grid2X2 />
            </Button>
          </div>
        </div>

        <div className="grid min-h-[440px] min-w-0 lg:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="hidden border-r border-border p-3 lg:block">
            {isLive ? (
              <>
                <p className="mb-3 px-2 text-xs font-semibold text-muted-foreground">OS PLACES</p>
                <div className="space-y-1">
                  {places.map((place) => (
                    <Button
                      key={place.path}
                      size="sm"
                      variant={!trashMode && currentOsPath === place.path ? "secondary" : "ghost"}
                      className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                      onClick={() => loadOsDirectory(place.path, true)}
                    >
                      <HardDrive className="size-4 shrink-0 text-cyan" />
                      <span className="min-w-0 break-all">{place.name}</span>
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant={trashMode ? "secondary" : "ghost"}
                    className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                    onClick={openTrashView}
                  >
                    <Trash2 className="size-4 shrink-0 text-warning" />
                    <span className="min-w-0 flex-1 break-all">Trash</span>
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {trashCount}
                    </span>
                  </Button>
                </div>
                {liveItems.some((item) => item.directory) && (
                  <>
                    <p className="mb-2 mt-5 px-2 text-xs font-semibold text-muted-foreground">SUBFOLDERS</p>
                    <div className="max-h-60 space-y-1 overflow-y-auto">
                      {liveItems
                        .filter((item) => item.directory && (hidden || !item.name.startsWith(".")))
                        .slice(0, 30)
                        .map((dir) => (
                          <Button
                            key={dir.realPath}
                            size="sm"
                            variant="ghost"
                            className="h-auto w-full justify-start whitespace-normal py-1.5 text-left text-xs"
                            onClick={() => dir.realPath && loadOsDirectory(dir.realPath, true)}
                          >
                            <Folder className="size-3.5 shrink-0 text-warning" />
                            <span className="min-w-0 break-all">{dir.name}</span>
                          </Button>
                        ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="mb-3 px-2 text-xs font-semibold text-muted-foreground">FOLDERS</p>
                <div className="space-y-1">
                  {demoFolders.map((entry) => (
                    <Button
                      key={entry.id}
                      size="sm"
                      variant={current === entry.id ? "secondary" : "ghost"}
                      className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                      onClick={() => navigateDemo(entry.id)}
                    >
                      <Folder className="text-warning" />
                      <span className="min-w-0 break-all">
                        {entry.name === "/" ? "Server root" : entryPath(entries, entry.id).slice(1)}
                      </span>
                    </Button>
                  ))}
                </div>
              </>
            )}
          </aside>

          <div className="min-w-0">
            {trashMode ? (
              <>
                {(() => {
                  const activeTrashRows: OsTrashItem[] = isLive
                    ? trashItems.filter((item) =>
                        item.name.toLowerCase().includes(query.toLowerCase()) ||
                        item.original_path.toLowerCase().includes(query.toLowerCase())
                      )
                    : demoTrash
                        .filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
                        .map((item) => ({
                          trash_id: String(item.id),
                          name: item.name,
                          original_path: entryPath(entries, item.id),
                          deleted_at: item.modified,
                          is_dir: item.directory,
                          size: item.sizeBytes ?? 0,
                          permissions: item.permissions,
                          owner: item.owner,
                        }));
                  return (
                    <>
                      <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                        <input
                          aria-label="Select all trashed items"
                          type="checkbox"
                          checked={
                            activeTrashRows.length > 0 &&
                            activeTrashRows.every((item) => selectedTrash.includes(item.trash_id))
                          }
                          onChange={(event) =>
                            setSelectedTrash(
                              event.target.checked ? activeTrashRows.map((item) => item.trash_id) : []
                            )
                          }
                        />
                        <span>
                          {selectedTrash.length
                            ? `${selectedTrash.length} selected in Trash`
                            : `${activeTrashRows.length} item(s) in Trash`}
                        </span>
                      </div>

                      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_80px_145px_auto] gap-3 border-b border-border px-12 py-2 text-xs text-muted-foreground xl:grid">
                        <span>Name</span>
                        <span>Original Location</span>
                        <span>Size</span>
                        <span>Deleted</span>
                        <span>Actions</span>
                      </div>

                      <div className="divide-y divide-border">
                        {activeTrashRows.map((item) => (
                          <div
                            key={item.trash_id}
                            className={`flex min-w-0 flex-wrap items-center gap-3 px-3 py-3 ${
                              selectedTrash.includes(item.trash_id) ? "bg-primary/15" : "hover:bg-accent/30"
                            }`}
                          >
                            <input
                              aria-label={`Select ${item.name}`}
                              type="checkbox"
                              className="shrink-0"
                              checked={selectedTrash.includes(item.trash_id)}
                              onChange={(event) =>
                                setSelectedTrash((ids) =>
                                  event.target.checked
                                    ? [...ids, item.trash_id]
                                    : ids.filter((id) => id !== item.trash_id)
                                )
                              }
                            />
                            {item.is_dir ? (
                              <Folder className="size-4 shrink-0 text-warning" />
                            ) : (
                              <FileText className="size-4 shrink-0 text-cyan" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="break-all text-xs font-medium">{item.name}</p>
                              <p className="break-all font-mono text-[11px] text-muted-foreground">
                                {item.original_path || "Unknown origin"}
                              </p>
                            </div>
                            <span className="hidden w-[80px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                              {item.is_dir ? "Folder" : formatBytes(item.size)}
                            </span>
                            <span className="hidden w-[145px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                              {item.deleted_at}
                            </span>
                            <div className="flex shrink-0 items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() => handleRestoreTrash([item.trash_id])}
                              >
                                <RotateCcw />
                                Restore
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                aria-label={`Delete ${item.name} permanently`}
                                title="Delete permanently"
                                disabled={busy}
                                onClick={() => handleDeleteTrashPermanent([item.trash_id])}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {!loading && activeTrashRows.length === 0 && (
                        <div className="py-20 text-center">
                          <Trash2 className="mx-auto mb-3 size-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Trash is empty</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <>
            <div className="flex items-center gap-3 border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <input
                aria-label="Select all files"
                type="checkbox"
                checked={visible.length > 0 && visible.every((entry) => selected.includes(entry.id))}
                onChange={(event) => setSelected(event.target.checked ? visible.map((entry) => entry.id) : [])}
              />
              <span>{selected.length ? `${selected.length} selected` : `${visible.length} items`}</span>
              {clipboard && (
                <span className="ml-auto">
                  {clipboard.ids.length} {clipboard.move ? "cut" : "copied"}
                </span>
              )}
            </div>

            {view === "list" && (
              <div className="hidden grid-cols-[minmax(0,1fr)_80px_80px_90px_145px] gap-3 border-b border-border px-12 py-2 text-xs text-muted-foreground xl:grid">
                <span>Name</span>
                <span>Size</span>
                <span>Permissions</span>
                <span>Owner</span>
                <span>Modified</span>
              </div>
            )}

            <div className={view === "grid" ? "grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 xl:grid-cols-4" : "divide-y divide-border"}>
              {visible.map((entry) => (
                <ContextMenu key={entry.realPath || entry.id}>
                  <ContextMenuTrigger asChild>
                    <div
                      className={`${selected.includes(entry.id) ? "bg-primary/15" : "hover:bg-accent/30"} ${
                        view === "grid"
                          ? "relative flex min-w-0 flex-col items-center rounded-md border border-border p-3"
                          : "flex min-w-0 items-center gap-3 px-3 py-3"
                      }`}
                    >
                      <input
                        aria-label={`Select ${entry.name}`}
                        type="checkbox"
                        className={view === "grid" ? "absolute left-2 top-2" : "shrink-0"}
                        checked={selected.includes(entry.id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked ? [...ids, entry.id] : ids.filter((id) => id !== entry.id)
                          )
                        }
                      />
                      <Button
                        variant="ghost"
                        className={
                          view === "grid"
                            ? "mt-5 h-auto w-full flex-col gap-3 whitespace-normal p-0"
                            : "h-auto min-w-0 flex-1 justify-start whitespace-normal p-0 text-left"
                        }
                        onClick={() => {
                          setSelected([entry.id]);
                          openEntry(entry);
                        }}
                      >
                        <FileIcon entry={entry} large={view === "grid"} />
                        <span className="min-w-0 break-all text-xs">{entry.name}</span>
                      </Button>

                      {view === "list" ? (
                        <>
                          <span className="hidden w-[80px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                            {entry.size}
                          </span>
                          <span className="hidden w-20 shrink-0 font-mono text-xs text-muted-foreground xl:block">
                            {entry.permissions}
                          </span>
                          <span className="hidden w-[90px] shrink-0 truncate text-xs text-muted-foreground xl:block">
                            {entry.owner}
                          </span>
                          <span className="hidden w-[145px] shrink-0 font-mono text-xs text-muted-foreground xl:block">
                            {entry.modified}
                          </span>
                        </>
                      ) : (
                        <span className="mt-2 text-xs text-muted-foreground">
                          {entry.directory ? "Folder" : entry.size}
                        </span>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className={view === "grid" ? "absolute right-1 top-1" : "shrink-0"}
                            aria-label={`Actions for ${entry.name}`}
                            title="File actions"
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {menuItems(entry).map((item) => (
                            <DropdownMenuItem key={item.label} onSelect={item.action}>
                              <item.icon />
                              {item.label}
                            </DropdownMenuItem>
                          ))}
                          {!isLive && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onSelect={() => handleDownload(entry)}>
                                Download preview
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {menuItems(entry).map((item, idx) => (
                      <div key={item.label}>
                        {idx === menuItems(entry).length - 1 && <ContextMenuSeparator />}
                        <ContextMenuItem onSelect={item.action}>{item.label}</ContextMenuItem>
                      </div>
                    ))}
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </div>

            {!loading && visible.length === 0 && (
              <div className="py-20 text-center">
                <Folder className="mx-auto mb-3 size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{query ? "No matching files" : "This folder is empty"}</p>
              </div>
            )}
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-border px-3 py-3 text-xs text-muted-foreground">
          <span>
            {visible.filter((entry) => entry.directory).length} folders ·{" "}
            {visible.filter((entry) => !entry.directory).length} files
          </span>
          <span>
            {isLive ? "Live host OS filesystem via FastAPI" : "Sample filesystem · Changes stay in this preview"}
          </span>
        </div>
      </div>

      {/* Create / Rename / Permissions / Properties Dialog */}
      <Dialog
        open={dialog !== undefined}
        onOpenChange={(open) => {
          if (!open) setDialog(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === "folder"
                ? "New Folder"
                : dialog?.type === "file"
                ? "New File"
                : dialog?.type === "rename"
                ? "Rename Item"
                : dialog?.type === "permissions"
                ? "Permissions"
                : "Properties"}
            </DialogTitle>
            <DialogDescription>
              {isLive ? "Live host OS filesystem operation." : "Demo file details — no server filesystem connected."}
            </DialogDescription>
          </DialogHeader>

          {dialog?.type === "properties" ? (
            <dl className="space-y-4 text-sm">
              {[
                {
                  label: "Path",
                  value: dialog.entry
                    ? isLive
                      ? dialog.entry.realPath
                      : entryPath(entries, dialog.entry.id)
                    : "",
                },
                { label: "Type", value: dialog.entry?.directory ? "Folder" : "File" },
                { label: "Size", value: dialog.entry?.size },
                { label: "Permissions", value: dialog.entry?.permissions },
                { label: "Owner", value: dialog.entry?.owner },
                { label: "Modified", value: dialog.entry?.modified },
              ].map((field) => (
                <div key={field.label}>
                  <dt className="text-xs text-muted-foreground">{field.label}</dt>
                  <dd className="mt-1 break-all font-mono">{field.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!dialog) return;

                if (isLive) {
                  const trimmed = value.trim();
                  if (dialog.type === "permissions") {
                    if (!/^[0-7]{3,4}$/.test(trimmed)) {
                      setError("Enter a 3 or 4 digit octal permission value.");
                      return;
                    }
                    if (!dialog.entry?.realPath) return;
                    setBusy(true);
                    try {
                      const res = await filesApi.chmod(dialog.entry.realPath, trimmed);
                      toast.success(res.message);
                      setDialog(undefined);
                      await loadOsDirectory(currentOsPath, false);
                    } catch (err) {
                      setError(getErrorMessage(err, "Failed to update permissions."));
                    } finally {
                      setBusy(false);
                    }
                    return;
                  }

                  if (!trimmed || trimmed === "." || trimmed === ".." || /[/\\\u0000-\u001f]/.test(trimmed)) {
                    setError("Enter a valid name without slashes or control characters.");
                    return;
                  }

                  setBusy(true);
                  try {
                    if (dialog.type === "folder") {
                      const res = await filesApi.mkdir(joinOsPath(currentOsPath, trimmed));
                      toast.success(res.message);
                    } else if (dialog.type === "file") {
                      const res = await filesApi.write(joinOsPath(currentOsPath, trimmed), "", true);
                      toast.success(res.message);
                    } else if (dialog.type === "rename" && dialog.entry?.realPath) {
                      const res = await filesApi.rename(
                        dialog.entry.realPath,
                        joinOsPath(parentOsPath(dialog.entry.realPath), trimmed)
                      );
                      toast.success(res.message);
                    }
                    setDialog(undefined);
                    await loadOsDirectory(currentOsPath, false);
                  } catch (err) {
                    setError(getErrorMessage(err, "Filesystem operation failed."));
                  } finally {
                    setBusy(false);
                  }
                  return;
                }

                // Demo / test mode
                if (dialog.type === "permissions") {
                  if (!/^[0-7]{3,4}$/.test(value)) {
                    setError("Enter a 3 or 4 digit octal permission value.");
                    return;
                  }
                  setEntries((items) =>
                    items.map((entry) => (entry.id === dialog.entry?.id ? { ...entry, permissions: value } : entry))
                  );
                } else {
                  const parent = dialog.entry?.parent ?? current;
                  const issue = validateEntryName(entries, parent, value, dialog.entry?.id);
                  if (issue) {
                    setError(issue);
                    return;
                  }
                  setEntries((items) =>
                    dialog.type === "rename"
                      ? items.map((entry) =>
                          entry.id === dialog.entry?.id
                            ? { ...entry, name: value, modified: "Just now · preview" }
                            : entry
                        )
                      : [
                          ...items,
                          {
                            id: Math.max(0, ...items.map((entry) => entry.id)) + 1,
                            parent: current,
                            name: value,
                            directory: dialog.type === "folder",
                            size: dialog.type === "folder" ? "—" : "0 B",
                            permissions: dialog.type === "folder" ? "755" : "644",
                            owner: "www-data",
                            modified: "Just now · preview",
                            content: "",
                          },
                        ]
                  );
                }
                setDialog(undefined);
                toast("File draft updated", { description: "Demo only — no real files read, written or uploaded." });
              }}
              className="space-y-4"
            >
              <label className="block space-y-2 text-sm">
                <span>{dialog?.type === "permissions" ? "Permission mode" : "Name"}</span>
                <input
                  aria-label={dialog?.type === "permissions" ? "Permission mode" : "Name"}
                  className={inputCls}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  autoFocus
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDialog(undefined)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy}>
                  Save
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* File Editor Dialog */}
      <Dialog
        open={editor !== undefined}
        onOpenChange={(open) => {
          if (!open) setEditor(undefined);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-all">{editor?.name}</DialogTitle>
            <DialogDescription>
              {isLive
                ? `Editing ${editor?.realPath}`
                : "Demo text editor · Never paste passwords or private keys. No real file is opened."}
            </DialogDescription>
          </DialogHeader>
          <textarea
            aria-label="File content"
            spellCheck={false}
            className="min-h-80 w-full rounded-md border border-input bg-secondary/60 p-3 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-ring"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {content.split("\n").length} lines · {content.length} characters
              {content !== editor?.content ? " · Unsaved" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditor(undefined)}>
                Close
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (!editor) return;
                  if (isLive && editor.realPath) {
                    setBusy(true);
                    try {
                      const res = await filesApi.write(editor.realPath, content);
                      setEditor({ ...editor, content });
                      toast.success(res.message);
                      await loadOsDirectory(currentOsPath, false);
                    } catch (err) {
                      toast.error(getErrorMessage(err, "Failed to save file."));
                    } finally {
                      setBusy(false);
                    }
                    return;
                  }
                  setEntries((items) =>
                    items.map((entry) =>
                      entry.id === editor.id
                        ? {
                            ...entry,
                            content,
                            size: `${new TextEncoder().encode(content).length} B`,
                            modified: "Just now · preview",
                          }
                        : entry
                    )
                  );
                  setEditor({ ...editor, content });
                  toast("File content saved in preview", {
                    description: "Demo only — no real files read, written or uploaded.",
                  });
                }}
              >
                <Save />
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog (Move to Trash or Delete Permanently) */}
      <Dialog
        open={removing !== undefined}
        onOpenChange={(open) => {
          if (!open) setRemoving(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected items?</DialogTitle>
            <DialogDescription>
              {isLive
                ? `Move ${removing?.length} item(s) to Trash (can be restored later) or delete permanently from disk.`
                : `${removing?.length} items and their nested contents will be moved to preview trash or removed permanently.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setRemoving(undefined)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!removing) return;
                if (isLive) {
                  const targets = removing.map((item) => item.realPath || "").filter(Boolean);
                  setBusy(true);
                  try {
                    const res = await filesApi.remove(targets, true);
                    toast.success(res.message);
                    setSelected([]);
                    setClipboard(undefined);
                    setRemoving(undefined);
                    await loadOsDirectory(currentOsPath, false);
                  } catch (err) {
                    toast.error(getErrorMessage(err, "Failed to permanently delete items."));
                  } finally {
                    setBusy(false);
                  }
                  return;
                }
                const removed = new Set(removing.flatMap((item) => descendants(entries, item.id)));
                setEntries((items) => items.filter((entry) => !removed.has(entry.id)));
                setSelected([]);
                setClipboard(undefined);
                setRemoving(undefined);
                toast("Items permanently removed from preview", {
                  description: "Demo only — no real files read, written or uploaded.",
                });
              }}
            >
              Delete Permanently
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!removing) return;
                if (isLive) {
                  const targets = removing.map((item) => item.realPath || "").filter(Boolean);
                  setBusy(true);
                  try {
                    const res = await filesApi.moveToTrash(targets);
                    toast.success(res.message);
                    setSelected([]);
                    setClipboard(undefined);
                    setRemoving(undefined);
                    await loadOsDirectory(currentOsPath, false);
                  } catch (err) {
                    const status = (err as { status?: number })?.status;
                    if (status === 404) {
                      toast.error("Trash endpoint not loaded on running backend. Restart uvicorn on port 8000.");
                    } else {
                      toast.error(getErrorMessage(err, "Failed to move items to Trash."));
                    }
                  } finally {
                    setBusy(false);
                  }
                  return;
                }
                const removed = new Set(removing.flatMap((item) => descendants(entries, item.id)));
                const trashed = entries.filter((entry) => removed.has(entry.id));
                setDemoTrash((prev) => [...trashed, ...prev]);
                setEntries((items) => items.filter((entry) => !removed.has(entry.id)));
                setSelected([]);
                setClipboard(undefined);
                setRemoving(undefined);
                toast("Moved items to preview trash", {
                  description: "Demo only — no real files read, written or uploaded.",
                });
              }}
            >
              <Trash2 />
              Move to Trash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Empty Trash Confirmation Dialog */}
      <Dialog open={emptyTrashConfirm} onOpenChange={setEmptyTrashConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty Trash permanently?</DialogTitle>
            <DialogDescription>
              All {isLive ? trashItems.length : demoTrash.length} item(s) in Trash will be permanently deleted and cannot be restored.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEmptyTrashConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={handleEmptyTrash}>
              Empty Trash
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isLive ? "Upload Files" : "Upload preview"}</DialogTitle>
            <DialogDescription>
              {isLive
                ? `Files will be uploaded into ${currentOsPath}.`
                : "Only filenames are added to the demo folder. File contents are never read or uploaded."}
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="Choose upload files"
            type="file"
            multiple
            onChange={(event) => setUploadFiles(Array.from(event.target.files ?? []))}
            className="w-full text-sm"
          />
          <ul className="space-y-2 text-sm">
            {uploadFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="break-all">
                {file.name} {isLive && <span className="text-xs text-muted-foreground">({formatBytes(file.size)})</span>}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!uploadFiles.length || busy}
              onClick={async () => {
                if (isLive) {
                  setBusy(true);
                  try {
                    const res = await filesApi.upload(currentOsPath, uploadFiles);
                    toast.success(res.message);
                    setUploadOpen(false);
                    setUploadFiles([]);
                    await loadOsDirectory(currentOsPath, false);
                  } catch (err) {
                    toast.error(getErrorMessage(err, "Upload failed."));
                  } finally {
                    setBusy(false);
                  }
                  return;
                }
                const next = [...entries];
                for (const file of uploadFiles) {
                  const issue = validateEntryName(next, current, file.name);
                  if (issue) {
                    toast.error(`${file.name}: ${issue}`);
                    return;
                  }
                  next.push({
                    id: Math.max(0, ...next.map((entry) => entry.id)) + 1,
                    parent: current,
                    name: file.name,
                    directory: false,
                    size: "0 B · placeholder",
                    permissions: "644",
                    owner: "www-data",
                    modified: "Just now · preview",
                    content: "# Upload filename placeholder — original contents not read",
                  });
                }
                setEntries(next);
                setUploadOpen(false);
                toast("Upload filenames added to preview", {
                  description: "Demo only — no real files read, written or uploaded.",
                });
              }}
            >
              {isLive ? "Upload" : "Add to Preview"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog
        open={imagePreview !== undefined}
        onOpenChange={(open) => {
          if (!open) closeImagePreview();
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="break-all">{imagePreview?.entry.name}</DialogTitle>
            <DialogDescription>
              {imagePreview?.entry.realPath || "Image preview"} · {imagePreview?.entry.size}
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-[260px] max-h-[65dvh] items-center justify-center overflow-auto rounded-md border border-border bg-secondary/40 p-4">
            {imagePreview && (
              <img
                src={imagePreview.src}
                alt={imagePreview.entry.name}
                style={{ transform: `scale(${imagePreview.zoom})`, transformOrigin: "center" }}
                className="max-h-[58dvh] max-w-full rounded object-contain transition-transform"
                onError={() => {
                  const failedEntry = imagePreview.entry;
                  closeImagePreview();
                  setUnsupportedFile({
                    entry: failedEntry,
                    reason: "Unable to decode this image file for preview.",
                  });
                }}
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setImagePreview((prev) =>
                    prev ? { ...prev, zoom: Math.max(0.25, Number((prev.zoom - 0.25).toFixed(2))) } : prev
                  )
                }
              >
                <ZoomOut />
                Zoom Out
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setImagePreview((prev) =>
                    prev ? { ...prev, zoom: Math.min(3, Number((prev.zoom + 0.25).toFixed(2))) } : prev
                  )
                }
              >
                <ZoomIn />
                Zoom In
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setImagePreview((prev) => (prev ? { ...prev, zoom: 1 } : prev))
                }
              >
                <RotateCcw />
                {Math.round((imagePreview?.zoom ?? 1) * 100)}%
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {imagePreview?.entry.name.toLowerCase().endsWith(".svg") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const target = imagePreview.entry;
                    closeImagePreview();
                    openTextEditor(target);
                  }}
                >
                  Edit Source
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => {
                  if (imagePreview) handleDownload(imagePreview.entry);
                }}
              >
                <Download />
                Download
              </Button>
              <Button onClick={closeImagePreview}>Close</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unsupported File Dialog */}
      <Dialog
        open={unsupportedFile !== undefined}
        onOpenChange={(open) => {
          if (!open) setUnsupportedFile(undefined);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 break-all">
              <FileWarning className="size-5 shrink-0 text-warning" />
              Cannot Open File
            </DialogTitle>
            <DialogDescription>
              Previewing or editing <span className="font-mono font-semibold">{unsupportedFile?.entry.name}</span> is not supported.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 rounded-md border border-border bg-secondary/40 p-3 text-xs">
            <p className="text-foreground">{unsupportedFile?.reason}</p>
            <div className="space-y-1 text-muted-foreground">
              <p className="break-all font-mono">
                Path: {unsupportedFile?.entry.realPath || unsupportedFile?.entry.name}
              </p>
              <p>
                Size: {unsupportedFile?.entry.size} · Permissions: {unsupportedFile?.entry.permissions}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnsupportedFile(undefined)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (unsupportedFile) handleDownload(unsupportedFile.entry);
              }}
            >
              <Download />
              Download File
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
