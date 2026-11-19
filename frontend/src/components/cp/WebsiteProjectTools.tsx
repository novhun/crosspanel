import { Folder, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { inputCls } from "./ui";

export type WebsiteProjectSettings = { envEnabled: boolean; envContent: string; database: string };
export const emptyProjectSettings: WebsiteProjectSettings = { envEnabled: false, envContent: "# Demo values only — do not enter secrets\nAPP_ENV=production\nAPP_DEBUG=false", database: "None" };
export const sampleDatabases = ["None", "wordpress · MariaDB", "app_data · PostgreSQL", "staging · MongoDB"];

export function WebsiteEnvironment({ value, onChange }: { value: WebsiteProjectSettings; onChange: (value: WebsiteProjectSettings) => void }) {
  return <div className="space-y-4"><div className="flex items-center justify-between gap-3"><label htmlFor="website-env" className="text-sm">Use .env file</label><Switch id="website-env" checked={value.envEnabled} onCheckedChange={(envEnabled) => onChange({ ...value, envEnabled })} /></div>{value.envEnabled && <label className="block space-y-2 text-sm"><span>.env preview</span><textarea aria-label="Environment file" rows={9} spellCheck={false} className={`${inputCls} h-auto py-3 font-mono text-xs leading-6`} value={value.envContent} onChange={(e) => onChange({ ...value, envContent: e.target.value })} /></label>}<p className="text-xs text-muted-foreground">Demo values only. Do not enter passwords, tokens or real credentials. No .env file is read or written.</p></div>;
}

export function WebsiteDatabase({ value, onChange }: { value: WebsiteProjectSettings; onChange: (value: WebsiteProjectSettings) => void }) {
  return <div className="space-y-4"><label className="block space-y-2 text-sm"><span>Linked database preview</span><select aria-label="Linked database" className={inputCls} value={value.database} onChange={(e) => onChange({ ...value, database: e.target.value })}>{sampleDatabases.map((db) => <option key={db}>{db}</option>)}</select></label><p className="text-xs text-muted-foreground">Sample databases only · No connection, password or access permissions are created.</p></div>;
}

export function WebsiteFolderPreview({ root, runtime, envEnabled }: { root: string; runtime: string; envEnabled: boolean }) {
  const entries = [{ name: "public", folder: true }, { name: "logs", folder: true }, { name: runtime.startsWith("PHP") ? "index.php" : "index.html", folder: false }, ...(envEnabled ? [{ name: ".env", folder: false }] : [])];
  return <div><div className="mb-4 break-all font-mono text-xs text-muted-foreground">{root}</div><div className="divide-y divide-border">{entries.map((entry) => <div key={entry.name} className="flex items-center gap-3 py-3 text-sm">{entry.folder ? <Folder className="size-4 text-warning" /> : <FileText className="size-4 text-cyan" />}<span>{entry.name}</span><span className="ml-auto text-xs text-muted-foreground">Sample {entry.folder ? "folder" : "file"}</span></div>)}</div></div>;
}