import { useState } from "react";
import { Download, PackagePlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inputCls } from "./ui";

export function AppVersionActions({ name, versions, onInstallPreview }: { name: string; versions: string[]; onInstallPreview?: (version: string) => void }) {
  const [selected, setSelected] = useState(versions[0] ?? "custom");
  const [custom, setCustom] = useState("");
  const version = selected === "custom" ? custom.trim() : selected;
  return <div className="mt-auto space-y-3">
    <label className="block space-y-1.5 text-xs text-muted-foreground">
      <span>Version</span>
      <select aria-label={`${name} version`} value={selected} onChange={(e) => setSelected(e.target.value)} className={inputCls}>
        {versions.map((v) => <option key={v} value={v}>{v}</option>)}
        <option value="custom">Custom version…</option>
      </select>
    </label>
    {selected === "custom" && <input aria-label={`${name} custom version`} className={inputCls} placeholder="Version or image tag" value={custom} onChange={(e) => setCustom(e.target.value)} />}
    <div className="grid grid-cols-2 gap-2">
      <Button size="sm" variant="outline" disabled={!version} onClick={() => toast(`Demo download: ${name} ${version}`, { description: "No package downloaded — API not connected." })}><Download />Download</Button>
      <Button size="sm" disabled={!version} onClick={() => { onInstallPreview?.(version); toast(`Demo install: ${name} ${version}`, { description: "No installation started — API not connected." }); }}><PackagePlus />Install</Button>
    </div>
  </div>;
}