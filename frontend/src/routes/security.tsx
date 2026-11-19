import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Plus, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { Panel, PageHeader, Btn, Pill, Table, inputCls } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/security")({
  head: () => meta("Security", "Smart firewall for UFW, Windows Defender Firewall and pf."),
  component: Page,
});

const rules = [
  { p: "22", proto: "TCP", a: "Allow", n: "SSH" }, { p: "80", proto: "TCP", a: "Allow", n: "HTTP" },
  { p: "443", proto: "TCP", a: "Allow", n: "HTTPS" }, { p: "888", proto: "TCP", a: "Deny", n: "phpMyAdmin public" },
  { p: "3306", proto: "TCP", a: "Deny", n: "MariaDB" },
];

function Page() {
  return (
    <>
      <PageHeader title="Security & Firewall" desc="One firewall UI — CrossPanel maps rules to UFW, Windows Defender Firewall, or pf automatically." action={<Pill>Backend: UFW (Linux)</Pill>} />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Firewall Rules" icon={ShieldCheck} className="lg:col-span-2">
          <Table head={["Port", "Protocol", "Action", "Note", ""]} rows={rules.map((r) => [
            <span className="font-mono">{r.p}</span>, r.proto, <Pill tone={r.a === "Allow" ? "success" : "danger"}>{r.a}</Pill>, r.n,
            <button className="rounded-md p-1.5 text-destructive hover:bg-destructive/15"><Trash2 className="h-4 w-4" /></button>,
          ])} />
        </Panel>
        <div className="space-y-5">
          <Panel title="Add Rule" icon={Plus}>
            <div className="space-y-3">
              <input className={inputCls} placeholder="Port or range" />
              <div className="grid grid-cols-2 gap-2"><select className={inputCls}><option>TCP</option><option>UDP</option></select><select className={inputCls}><option>Allow</option><option>Deny</option></select></div>
              <Btn className="w-full" onClick={() => toast.success("Rule added")}>Add Rule</Btn>
            </div>
          </Panel>
          <Panel title="Blocked IPs" icon={Ban}>
            {["45.33.12.8", "185.220.101.4"].map((ip) => <div key={ip} className="flex justify-between py-1 font-mono text-sm">{ip}<Pill tone="danger">Blocked</Pill></div>)}
          </Panel>
        </div>
      </div>
    </>
  );
}
