import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { SquareTerminal, Plus, X } from "lucide-react";
import { PageHeader, Pill } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/terminal")({
  head: () => meta("Web Terminal", "Run shell commands on your server directly in the browser."),
  component: Page,
});

function Page() {
  const [enabled, setEnabled] = useState(true);
  const [lines, setLines] = useState<string[]>(["CrossPanel Web Terminal v1.0 — connected to localhost (Linux)", "Type 'help' to see available commands.", ""]);
  const [cmd, setCmd] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView(); }, [lines]);
  const run = () => {
    const out = cmd === "help" ? ["help, clear, whoami, uptime, docker ps"] : cmd === "whoami" ? ["root"] : cmd === "uptime" ? ["up 12 days, 4:21, load average: 0.24, 0.31, 0.29"] : cmd === "docker ps" ? ["CONTAINER ID  IMAGE          STATUS", "f1a2b3c4d5e6  nginx:alpine   Up 3 hours", "a9b8c7d6e5f4  mariadb:11     Up 3 hours"] : cmd ? [`(UI preview) command will run when the API is connected`] : [];
    if (cmd === "clear") return setLines([]), setCmd("");
    setLines((l) => [...l, `root@crosspanel:~# ${cmd}`, ...out]);
    setCmd("");
  };
  return (
    <>
      <PageHeader title="Web Terminal" desc="Direct shell access from your browser. Disable it anytime for security." action={
        <label className="flex items-center gap-2 text-sm">{enabled ? <Pill>Enabled</Pill> : <Pill tone="danger">Disabled</Pill>}<input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 accent-primary" /></label>
      } />
      <div className="glass overflow-hidden rounded-2xl">
        <div className="flex items-center gap-1 border-b border-border bg-secondary/60 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-1"><SquareTerminal className="h-4 w-4 text-success" />bash — root<X className="h-3 w-3 text-muted-foreground" /></span>
          <button className="rounded-md p-1 hover:bg-accent"><Plus className="h-4 w-4" /></button>
        </div>
        <div className={cn("h-[60vh] overflow-y-auto bg-background/80 p-4 font-mono text-sm", !enabled && "opacity-40")} onClick={() => document.getElementById("cmd")?.focus()}>
          {lines.map((l, i) => <div key={i} className={l.startsWith("root@") ? "text-success" : "text-foreground/90"}>{l || "\u00a0"}</div>)}
          <div className="flex"><span className="text-success">root@crosspanel:~#&nbsp;</span>
            <input id="cmd" disabled={!enabled} value={cmd} onChange={(e) => setCmd(e.target.value)} onKeyDown={(e) => e.key === "Enter" && run()} className="flex-1 bg-transparent outline-none" autoFocus />
          </div>
          <div ref={end} />
        </div>
      </div>
    </>
  );
}
