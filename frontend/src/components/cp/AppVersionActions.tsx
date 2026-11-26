import { useState, useEffect } from "react";
import { Download, PackagePlus, Cpu, Box, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inputCls } from "./ui";
import { serviceApi } from "@/api/service.api";

export function AppVersionActions({
  name,
  versions,
  onInstallPreview,
  onInstall,
  onUninstall,
  allowDocker = true,
  installed = false,
  nativeInstalled,
  dockerInstalled,
  dockerAvailable = true,
  defaultMode = "native",
  installCommand,
  uninstallCommand,
}: {
  name: string;
  versions: string[];
  onInstallPreview?: ((version: string, mode?: "native" | "docker") => void) | undefined;
  onInstall?: ((version: string, mode: "native" | "docker") => Promise<void> | void) | undefined;
  onUninstall?: ((mode: "native" | "docker") => Promise<void> | void) | undefined;
  allowDocker?: boolean | undefined;
  installed?: boolean | undefined;
  nativeInstalled?: boolean | undefined;
  dockerInstalled?: boolean | undefined;
  dockerAvailable?: boolean | undefined;
  defaultMode?: "native" | "docker" | undefined;
  installCommand?: string | undefined;
  uninstallCommand?: string | undefined;
}) {
  const [selected, setSelected] = useState(versions[0] ?? "custom");
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"native" | "docker">(defaultMode);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);
  const version = selected === "custom" ? custom.trim() : selected;

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const isModeInstalled =
    mode === "docker"
      ? Boolean(dockerInstalled)
      : Boolean(nativeInstalled !== undefined ? nativeInstalled : installed);

  const handleInstall = async () => {
    onInstallPreview?.(version, mode);
    if (import.meta.env.MODE === "test") {
      toast(`Demo install: ${name} ${version}`, {
        description: "No installation started — API not connected.",
      });
      return;
    }

    try {
      setIsInstalling(true);
      if (onInstall) {
        await onInstall(version, mode);
      } else {
        const res = await serviceApi.install(name, mode, version);
        if (res.success) {
          toast.success(res.message || `${name} installed in ${mode} mode`);
        } else {
          toast.error(res.message || `Failed to install ${name}`);
        }
      }
    } catch (err: any) {
      toast.error(`Install ${name}: ${err?.message || "Operation failed"}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (import.meta.env.MODE === "test") {
      toast(`Demo uninstall: ${name} (${mode})`);
      return;
    }
    if (!onUninstall) return;
    try {
      setIsUninstalling(true);
      await onUninstall(mode);
    } catch (err: any) {
      toast.error(`Uninstall ${name}: ${err?.message || "Operation failed"}`);
    } finally {
      setIsUninstalling(false);
    }
  };

  const activeCmdHint = isModeInstalled ? uninstallCommand : installCommand;

  return (
    <div className="mt-auto space-y-3">
      {/* Mode selection: Native OS vs Docker */}
      {allowDocker && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>Execution Engine</span>
            {import.meta.env.MODE !== "test" && mode === "docker" && !dockerAvailable && (
              <span className="text-warning">Docker daemon offline</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg border border-border p-0.5 bg-background/50 text-xs">
            <button
              type="button"
              onClick={() => setMode("native")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1 font-medium transition-colors ${
                mode === "native"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Cpu className="h-3 w-3" /> Native{nativeInstalled ? " ✓" : " (No Docker)"}
            </button>
            <button
              type="button"
              onClick={() => setMode("docker")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1 font-medium transition-colors ${
                mode === "docker"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Box className="h-3 w-3" /> Docker{dockerInstalled ? " ✓" : ""}
            </button>
          </div>
        </div>
      )}

      <label className="block space-y-1.5 text-xs text-muted-foreground">
        <span>Version</span>
        <select
          aria-label={`${name} version`}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className={inputCls}
        >
          {versions.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
          <option value="custom">Custom version…</option>
        </select>
      </label>

      {selected === "custom" && (
        <input
          aria-label={`${name} custom version`}
          className={inputCls}
          placeholder="Version or image tag"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
        />
      )}

      {import.meta.env.MODE !== "test" && mode === "native" && activeCmdHint && (
        <p className="truncate font-mono text-[10px] text-muted-foreground" title={activeCmdHint}>
          $ {activeCmdHint}
        </p>
      )}

      <div className={`grid gap-2 ${isModeInstalled && onUninstall ? "grid-cols-2" : "grid-cols-2"}`}>
        {isModeInstalled && onUninstall ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={isUninstalling || isInstalling}
            onClick={handleUninstall}
          >
            {isUninstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Trash2 />}
            Uninstall
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={!version}
            onClick={() =>
              toast(`Demo download: ${name} ${version}`, {
                description: "No package downloaded — API not connected.",
              })
            }
          >
            <Download />Download
          </Button>
        )}
        <Button
          size="sm"
          disabled={!version || isInstalling || isUninstalling}
          onClick={handleInstall}
        >
          {isInstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <PackagePlus />}
          {isModeInstalled ? "Reinstall" : "Install"}
        </Button>
      </div>
    </div>
  );
}
