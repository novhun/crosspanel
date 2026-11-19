import { createFileRoute } from "@tanstack/react-router";
import { Github, Heart, Monitor, Apple, Terminal } from "lucide-react";
import { Panel, PageHeader, Btn, Pill } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/about")({
  head: () => meta("About", "CrossPanel is an open-source, free forever, cross-platform DevOps workspace."),
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader title="About CrossPanel" desc="All-in-One DevOps Workspace — Open-Source & Free Forever." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <h2 className="font-display text-xl font-semibold">Freedom to build anywhere</h2>
          <p className="mt-3 text-muted-foreground">CrossPanel is more than a hosting control panel. It's a complete DevOps workspace that runs on Linux, macOS and Windows — with no paid Pro tiers and no OS lock-in.</p>
          <div className="mt-5 flex flex-wrap gap-2"><Pill>Open-Source</Pill><Pill tone="primary">MIT License</Pill><Pill tone="muted">v1.0.0</Pill></div>
          <div className="mt-6 flex gap-3"><Btn><Github className="h-4 w-4" />View on GitHub</Btn><Btn variant="ghost"><Heart className="h-4 w-4" />Sponsor</Btn></div>
        </Panel>
        <Panel title="Supported Platforms">
          {[{ n: "Linux", i: Terminal, m: "systemd · UFW" }, { n: "macOS", i: Apple, m: "brew services · pf" }, { n: "Windows", i: Monitor, m: "Services · Defender Firewall" }].map((o) => (
            <div key={o.n} className="flex items-center gap-3 py-2"><o.i className="h-6 w-6 text-cyan" /><div><div className="font-semibold">{o.n}</div><div className="text-xs text-muted-foreground">{o.m}</div></div></div>
          ))}
        </Panel>
      </div>
    </>
  );
}
