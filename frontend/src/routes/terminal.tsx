import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  Copy,
  Eraser,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  SquareTerminal,
  X,
} from "lucide-react";
import { PageHeader, Pill } from "@/components/cp/ui";
import { meta } from "@/components/cp/meta";
import { XTermTerminal, type XTermActions } from "@/components/cp/XTermTerminal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/terminal")({
  head: () => meta("Web Terminal", "Real PTY shell access supporting vi, vim, nano, htop, colors and resize."),
  component: TerminalPage,
});

interface TerminalTab {
  id: number;
  title: string;
  connected: boolean;
  reconnectNonce: number;
}

function TerminalPage() {
  const [enabled, setEnabled] = useState(true);
  const [fontSize, setFontSize] = useState(13);
  const [fullscreen, setFullscreen] = useState(false);
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 1, title: "bash (PTY 1)", connected: false, reconnectNonce: 0 },
  ]);
  const [activeId, setActiveId] = useState(1);
  const nextIdRef = useRef(2);
  const actionsRef = useRef<Record<number, XTermActions>>({});

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const handleStatusChange = (tabId: number, connected: boolean) => {
    setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, connected } : t)));
  };

  const handleRegisterActions = (tabId: number, actions: XTermActions | null) => {
    if (actions) actionsRef.current[tabId] = actions;
    else delete actionsRef.current[tabId];
  };

  const addTab = () => {
    const id = nextIdRef.current++;
    setTabs((prev) => [...prev, { id, title: `bash (PTY ${id})`, connected: false, reconnectNonce: 0 }]);
    setActiveId(id);
  };

  const closeTab = (id: number) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const filtered = prev.filter((t) => t.id !== id);
      if (activeId === id && filtered[0]) {
        setActiveId(filtered[0].id);
      }
      return filtered;
    });
  };

  const reconnectActive = () => {
    if (!activeTab) return;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTab.id ? { ...t, reconnectNonce: t.reconnectNonce + 1 } : t))
    );
  };

  return (
    <>
      <PageHeader
        title="Interactive Web Terminal"
        desc="Full PTY terminal (xterm-256color) supporting vi, vim, nano, htop, less, Ctrl+C and resizing."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={activeTab?.connected ? "success" : "muted"}>
              {activeTab?.connected ? "● Live PTY Connected" : "● Disconnected"}
            </Pill>
            <label className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1 text-xs">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-3.5 w-3.5 accent-primary"
              />
              <span className="text-muted-foreground">{enabled ? "Enabled" : "Disabled"}</span>
            </label>
            <button
              onClick={() => activeTab && actionsRef.current[activeTab.id]?.copySelection()}
              title="Copy selected text (Ctrl+Shift+C)"
              className="rounded-lg border border-border p-1.5 transition hover:bg-secondary"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => activeTab && actionsRef.current[activeTab.id]?.clear()}
              title="Clear terminal screen"
              className="rounded-lg border border-border p-1.5 transition hover:bg-secondary"
            >
              <Eraser className="h-4 w-4" />
            </button>
            <button
              onClick={reconnectActive}
              title="Reconnect active PTY session"
              className="rounded-lg border border-border p-1.5 transition hover:bg-secondary"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setFullscreen((v) => !v)}
              title={fullscreen ? "Exit expanded view" : "Expand terminal"}
              className="rounded-lg border border-border p-1.5 transition hover:bg-secondary"
            >
              {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        }
      />

      <div
        className={cn(
          "glass flex flex-col overflow-hidden rounded-2xl border border-border bg-[#0B0F19]",
          fullscreen && "fixed inset-3 z-50 shadow-2xl"
        )}
      >
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-secondary/60 px-3 py-2 text-sm">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              onClick={() => setActiveId(tab.id)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-3 py-1 font-mono text-xs transition",
                tab.id === activeTab?.id
                  ? "bg-[#0B0F19] text-foreground ring-1 ring-border"
                  : "text-muted-foreground hover:bg-background/50"
              )}
            >
              <SquareTerminal
                className={cn("h-3.5 w-3.5", tab.connected ? "text-success" : "text-muted-foreground")}
              />
              <span>{tab.title}</span>
              {tabs.length > 1 && (
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addTab}
            title="New Terminal Tab"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>

          <div className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.max(10, s - 1))}
              className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
              title="Decrease font size"
            >
              A-
            </button>
            <span className="font-mono text-[11px]">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize((s) => Math.min(22, s + 1))}
              className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
              title="Increase font size"
            >
              A+
            </button>
            {fullscreen && (
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="ml-2 rounded px-2 py-0.5 text-xs hover:bg-accent hover:text-foreground"
              >
                Exit Fullscreen
              </button>
            )}
          </div>
        </div>

        <div className={cn("relative w-full bg-[#0B0F19]", fullscreen ? "flex-1" : "h-[68vh]")}>
          {tabs.map((tab) => (
            <XTermTerminal
              key={tab.id}
              active={tab.id === activeTab?.id}
              enabled={enabled}
              fontSize={fontSize}
              reconnectNonce={tab.reconnectNonce}
              onStatusChange={(connected) => handleStatusChange(tab.id, connected)}
              onRegisterActions={(actions) => handleRegisterActions(tab.id, actions)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
