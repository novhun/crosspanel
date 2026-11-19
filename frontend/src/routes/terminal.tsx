import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { SquareTerminal, Plus, X, RefreshCw } from "lucide-react";
import { PageHeader, Pill } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/terminal")({
  head: () => meta("Web Terminal", "Run shell commands on your server directly in the browser."),
  component: Page,
});

function Page() {
  const [enabled, setEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lines, setLines] = useState<string[]>([
    "CrossPanel Web Terminal v1.0 — Initializing...",
  ]);
  const [cmd, setCmd] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const connectWs = () => {
    if (typeof window === "undefined" || !enabled) return;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/terminal/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        const text: string = event.data;
        // Split by lines if multiple
        const splitLines = text.split("\r\n");
        setLines((prev) => [...prev, ...splitLines.filter((l) => l.length > 0)]);
      };

      ws.onerror = () => {
        setIsConnected(false);
      };

      ws.onclose = () => {
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch {
      setIsConnected(false);
    }
  };

  useEffect(() => {
    connectWs();
    return () => {
      wsRef.current?.close();
    };
  }, [enabled]);

  const run = () => {
    if (cmd === "clear") {
      setLines([]);
      setCmd("");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(cmd + "\r\n");
      setCmd("");
      return;
    }

    // Local simulated fallback when API is not running
    const out =
      cmd === "help"
        ? ["Available commands: help, clear, whoami, uptime, docker ps, service --status-all"]
        : cmd === "whoami"
        ? ["root (administrator)"]
        : cmd === "uptime"
        ? ["up 12 days, 4:21, 1 user, load average: 0.18, 0.22, 0.19"]
        : cmd === "docker ps"
        ? [
            "CONTAINER ID   IMAGE          COMMAND       STATUS         PORTS",
            "f1a2b3c4d5e6   nginx:alpine   nginx -g...   Up 3 hours     0.0.0.0:80->80/tcp",
            "a9b8c7d6e5f4   mariadb:10.11  docker-en...  Up 3 hours     0.0.0.0:3306->3306/tcp",
          ]
        : cmd
        ? [`[simulated fallback] ${cmd}: command executed (connect backend for live shell)`]
        : [];

    setLines((l) => [...l, `crosspanel:~# ${cmd}`, ...out]);
    setCmd("");
  };

  return (
    <>
      <PageHeader
        title="Interactive Web Terminal"
        desc="Direct server shell access via WebSocket. Toggle off anytime for security."
        action={
          <div className="flex items-center gap-3">
            <Pill tone={isConnected ? "success" : "muted"}>
              {isConnected ? "● Live Shell Connected" : "● Offline / Fallback"}
            </Pill>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-xs text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
            </label>
            <button
              onClick={connectWs}
              title="Reconnect Terminal"
              className="rounded-lg border border-border p-1.5 transition hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        }
      />
      <div className="glass overflow-hidden rounded-2xl border border-border">
        <div className="flex items-center gap-1 border-b border-border bg-secondary/60 px-3 py-2 text-sm">
          <span className="flex items-center gap-2 rounded-md bg-background/70 px-3 py-1 font-mono text-xs">
            <SquareTerminal className="h-4 w-4 text-success" />
            {isConnected ? "crosspanel-pty (active)" : "crosspanel-local (preview)"}
            <X className="h-3 w-3 text-muted-foreground cursor-pointer" onClick={() => setLines([])} />
          </span>
          <button className="rounded-md p-1 hover:bg-accent" onClick={() => setLines([])} title="Clear terminal">
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn("h-[60vh] overflow-y-auto bg-background/95 p-4 font-mono text-xs leading-5", !enabled && "opacity-40")}
          onClick={() => document.getElementById("cmd")?.focus()}
        >
          {lines.map((l, i) => (
            <div
              key={i}
              className={
                l.startsWith("crosspanel:") || l.startsWith("root@")
                  ? "text-success font-semibold"
                  : l.includes("Error") || l.includes("failed")
                  ? "text-destructive"
                  : "text-foreground/90"
              }
            >
              {l || "\u00a0"}
            </div>
          ))}
          <div className="mt-1 flex items-center">
            <span className="text-success font-semibold">crosspanel:~#&nbsp;</span>
            <input
              id="cmd"
              disabled={!enabled}
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              className="flex-1 bg-transparent outline-none text-foreground"
              autoFocus
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div ref={end} />
        </div>
      </div>
    </>
  );
}
