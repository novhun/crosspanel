import { useState } from "react";
import { Download, PackagePlus, Cpu, Box, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inputCls } from "./ui";
import { serviceApi } from "@/api/service.api";

export function AppVersionActions({
  name,
  versions,
  onInstallPreview,
  allowDocker = true,
}: {
  name: string;
  versions: string[];
  onInstallPreview?: (version: string, mode?: "native" | "docker") => void;
  allowDocker?: boolean;
}) {
  const [selected, setSelected] = useState(versions[0] ?? "custom");
  const [custom, setCustom] = useState("");
  const [mode, setMode] = useState<"native" | "docker">("native");
  const [isInstalling, setIsInstalling] = useState(false);
  const version = selected === "custom" ? custom.trim() : selected;

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
      const res = await serviceApi.install(name, mode, version);
      toast.success(res.message || `${name} installed in ${mode} mode`);
    } catch (err: any) {
      toast.info(`Native install ${name}: ${err?.message || "Prepared on host"}`);
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <div className="mt-auto space-y-3">
      {/* Mode selection: Native OS vs Docker */}
      {allowDocker && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">Execution Engine</span>
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
              <Cpu className="h-3 w-3" /> Native (No Docker)
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
              <Box className="h-3 w-3" /> Docker
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

      <div className="grid grid-cols-2 gap-2">
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
        <Button
          size="sm"
          disabled={!version || isInstalling}
          onClick={handleInstall}
        >
          {isInstalling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <PackagePlus />}
          Install
        </Button>
      </div>
    </div>
  );
}
