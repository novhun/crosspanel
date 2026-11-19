import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings, Server, Play, Square, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Panel, PageHeader, Btn, Pill, Table, inputCls } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";
import { SettingsSecurity } from "@/components/cp/SettingsSecurity";

export const Route = createFileRoute("/settings")({
  head: () => meta("Settings", "CrossPanel preferences, services and admin password and login path configuration previews."),
  component: Page,
});

const svcs = [
  { n: "Nginx", m: "systemd", s: "Running" }, { n: "PHP-FPM", m: "systemd", s: "Running" },
  { n: "MariaDB", m: "systemd", s: "Running" }, { n: "Docker", m: "systemd", s: "Running" }, { n: "Redis", m: "systemd", s: "Stopped" },
];

function Page() {
  const [timezone, setTimezone] = useState("UTC");
  const [savedTimezone, setSavedTimezone] = useState("UTC");
  return (
    <>
      <PageHeader title="Settings" desc="Configure CrossPanel and manage system services." />
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsSecurity />
        <Panel title="General" icon={Settings}>
          <div className="space-y-3">
            <label className="block text-sm">Panel name<input className={inputCls + " mt-1"} defaultValue="CrossPanel" /></label>
            <label className="block text-sm">Panel port<input className={inputCls + " mt-1"} defaultValue="7800" /></label>
            <label className="block text-sm">Target OS<select className={inputCls + " mt-1"}><option>Linux (systemd)</option><option>macOS (brew services)</option><option>Windows (Services)</option></select></label>
            <label className="block text-sm">Timezone<select aria-label="Timezone" className={inputCls + " mt-1"} value={timezone} onChange={(e) => setTimezone(e.target.value)}>{["UTC", "Asia/Phnom_Penh", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "Australia/Sydney"].map((zone) => <option key={zone}>{zone}</option>)}</select></label>
            <p className="text-xs text-muted-foreground">Selected timezone: {savedTimezone} · Demo setting</p>
            {["Enable Web Terminal", "Two-factor authentication", "Auto updates"].map((l) => <label key={l} className="flex items-center justify-between text-sm">{l}<input type="checkbox" defaultChecked className="h-4 w-4 accent-primary" /></label>)}
            <Btn className="w-full" onClick={() => { setSavedTimezone(timezone); toast.success("Settings saved in preview"); }}>Save Changes</Btn>
          </div>
        </Panel>
        <Panel title="All Services" icon={Server}>
          <Table head={["Service", "Manager", "Status", ""]} rows={svcs.map((s) => [
            s.n, <span className="font-mono text-xs">{s.m}</span>, <Pill tone={s.s === "Running" ? "success" : "danger"}>{s.s}</Pill>,
            <div className="flex justify-end gap-1"><button className="rounded bg-primary p-1.5"><Play className="h-3 w-3" /></button><button className="rounded bg-destructive p-1.5"><Square className="h-3 w-3" /></button><button className="rounded bg-primary/70 p-1.5"><RotateCw className="h-3 w-3" /></button></div>,
          ])} />
        </Panel>
      </div>
    </>
  );
}
