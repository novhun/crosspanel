import { useEffect, useRef } from "react";
import type { Terminal as XTermType } from "@xterm/xterm";
import type { FitAddon as FitAddonType } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface XTermActions {
  clear: () => void;
  focus: () => void;
  copySelection: () => void;
}

interface XTermTerminalProps {
  active: boolean;
  enabled?: boolean;
  fontSize?: number;
  cwd?: string | undefined;
  initialCommand?: string | undefined;
  reconnectNonce?: number;
  className?: string | undefined;
  onStatusChange?: ((connected: boolean) => void) | undefined;
  onRegisterActions?: ((actions: XTermActions | null) => void) | undefined;
}

export function XTermTerminal({
  active,
  enabled = true,
  fontSize = 13,
  cwd,
  initialCommand,
  reconnectNonce = 0,
  className,
  onStatusChange,
  onRegisterActions,
}: XTermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTermType | null>(null);
  const fitRef = useRef<FitAddonType | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;

    async function init() {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: "block",
        fontSize,
        lineHeight: 1.25,
        scrollback: 5000,
        fontFamily:
          '"JetBrains Mono", "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        theme: {
          background: "#0B0F19",
          foreground: "#E2E8F0",
          cursor: "#38BDF8",
          selectionBackground: "rgba(56, 189, 248, 0.28)",
          black: "#1E293B",
          red: "#F87171",
          green: "#4ADE80",
          yellow: "#FACC15",
          blue: "#60A5FA",
          magenta: "#C084FC",
          cyan: "#22D3EE",
          white: "#F1F5F9",
          brightBlack: "#475569",
          brightRed: "#FCA5A5",
          brightGreen: "#86EFAC",
          brightYellow: "#FDE047",
          brightBlue: "#93C5FD",
          brightMagenta: "#D8B4FE",
          brightCyan: "#67E8F9",
          brightWhite: "#FFFFFF",
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current);

      try {
        fitAddon.fit();
      } catch {
        // container may be hidden initially
      }

      termRef.current = term;
      fitRef.current = fitAddon;

      onRegisterActions?.({
        clear: () => term.clear(),
        focus: () => term.focus(),
        copySelection: () => {
          const text = term.getSelection();
          if (text && navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => toast.success("Copied selection"));
          } else {
            toast.info("Select text in the terminal first to copy.");
          }
        },
      });

      if (!enabled) {
        term.writeln("\x1b[33m[CrossPanel] Web Terminal is disabled. Enable the toggle above to connect.\x1b[0m");
        onStatusChange?.(false);
        return;
      }

      const sendResize = (cols: number, rows: number) => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      };

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      const params = new URLSearchParams({
        cols: String(cols),
        rows: String(rows),
      });
      if (cwd) {
        params.set("cwd", cwd);
      }
      const wsUrl = `${protocol}//${host}/api/terminal/ws?${params.toString()}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        onStatusChange?.(true);
        try {
          fitAddon.fit();
          sendResize(term.cols, term.rows);
        } catch {
          // ignore
        }
        if (initialCommand && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data: `${initialCommand}\n` }));
        }
        term.focus();
      };

      ws.onmessage = (event) => {
        if (!disposed && typeof event.data === "string") {
          term.write(event.data);
        }
      };

      ws.onerror = () => {
        if (!disposed) {
          onStatusChange?.(false);
        }
      };

      ws.onclose = () => {
        if (!disposed) {
          onStatusChange?.(false);
          term.writeln("\r\n\x1b[90m[Session disconnected — click Reconnect to start a new PTY shell]\x1b[0m");
        }
      };

      term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "input", data }));
        }
      });

      term.onResize(({ cols: nextCols, rows: nextRows }) => {
        sendResize(nextCols, nextRows);
      });

      term.attachCustomKeyEventHandler((ev) => {
        if (ev.type === "keydown" && ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === "c") {
          const sel = term.getSelection();
          if (sel && navigator.clipboard) {
            navigator.clipboard.writeText(sel).catch(() => {});
          }
          return false;
        }
        if (ev.type === "keydown" && ev.ctrlKey && ev.shiftKey && ev.key.toLowerCase() === "v") {
          if (navigator.clipboard && ws.readyState === WebSocket.OPEN) {
            navigator.clipboard
              .readText()
              .then((text) => {
                if (text && ws.readyState === WebSocket.OPEN) {
                  ws.send(JSON.stringify({ type: "input", data: text }));
                }
              })
              .catch(() => {});
          }
          return false;
        }
        return true;
      });

      resizeObserver = new ResizeObserver(() => {
        if (!disposed && fitRef.current && containerRef.current && containerRef.current.offsetParent !== null) {
          try {
            fitRef.current.fit();
          } catch {
            // ignore
          }
        }
      });
      resizeObserver.observe(containerRef.current);
    }

    init();

    return () => {
      disposed = true;
      onRegisterActions?.(null);
      resizeObserver?.disconnect();
      wsRef.current?.close();
      wsRef.current = null;
      termRef.current?.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reconnectNonce, cwd]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      if (active && fitRef.current) {
        try {
          fitRef.current.fit();
        } catch {
          // ignore
        }
      }
    }
  }, [fontSize, active]);

  useEffect(() => {
    if (active && fitRef.current && termRef.current) {
      const timer = setTimeout(() => {
        try {
          fitRef.current?.fit();
          termRef.current?.focus();
        } catch {
          // ignore
        }
      }, 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [active]);

  return (
    <div
      ref={containerRef}
      onClick={() => termRef.current?.focus()}
      className={cn(
        "h-full w-full overflow-hidden p-2",
        !active && "hidden",
        !enabled && "opacity-50",
        className
      )}
    />
  );
}
