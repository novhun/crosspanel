import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Terminal as TerminalIcon,
  ShieldCheck,
  ShieldAlert,
  RotateCw,
  Trash2,
  Maximize2,
  Sparkles
} from 'lucide-react';
import { systemApi } from '../services/api';

export const TerminalView: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState<boolean>(false);
  const [terminalEnabled, setTerminalEnabled] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const initTerminal = () => {
    if (!terminalRef.current) return;

    if (xtermInstance.current) {
      xtermInstance.current.dispose();
    }
    if (wsRef.current) {
      wsRef.current.close();
    }

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      theme: {
        background: '#090D16',
        foreground: '#E2E8F0',
        cursor: '#10b981',
        selectionBackground: '#047857',
        black: '#1E293B',
        red: '#F43F5E',
        green: '#10B981',
        yellow: '#F59E0B',
        blue: '#3B82F6',
        magenta: '#EC4899',
        cyan: '#06B6D4',
        white: '#F8FAFC'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Connect through Vite proxy /api/terminal/ws or fallback to port 8000
    const host = window.location.port === '5173' ? 'localhost:8000' : window.location.host;
    const wsUrl = `${protocol}//${host}/api/terminal/ws`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      setConnected(false);
      term.write('\r\n\x1b[33m[CrossPanel] Terminal connection closed.\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setConnected(false);
      term.write('\r\n\x1b[31m[CrossPanel] Unable to connect to backend shell.\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  };

  useEffect(() => {
    initTerminal();
    return () => {
      if (wsRef.current) wsRef.current.close();
      if (xtermInstance.current) xtermInstance.current.dispose();
    };
  }, []);

  const handleToggleTerminal = async () => {
    setIsToggling(true);
    try {
      const res = await systemApi.toggleTerminal();
      setTerminalEnabled(res.terminal_enabled);
      initTerminal();
    } catch (e) {
      console.error(e);
    } finally {
      setIsToggling(false);
    }
  };

  const handleClear = () => {
    if (xtermInstance.current) {
      xtermInstance.current.clear();
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-7rem)] flex flex-col">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-emerald-400" />
            Interactive Web Terminal
          </h2>
          <p className="text-xs text-slate-400">
            Direct authenticated command-line shell to the host node via WebSockets with ANSI color support.
          </p>
        </div>

        {/* Security Toggle & Controls */}
        <div className="flex items-center gap-2">
          {/* Security Toggle */}
          <button
            onClick={handleToggleTerminal}
            disabled={isToggling}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-all ${
              terminalEnabled
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border-rose-500/40 text-rose-300'
            }`}
          >
            {terminalEnabled ? (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Security: Terminal ON</span>
              </>
            ) : (
              <>
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Security: Terminal OFF</span>
              </>
            )}
          </button>

          <button
            onClick={initTerminal}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs"
            title="Reconnect Shell"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClear}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs"
            title="Clear Buffer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className="flex-1 rounded-2xl bg-[#090D16] border border-slate-800 overflow-hidden flex flex-col shadow-2xl relative">
        {/* Terminal Titlebar */}
        <div className="h-9 bg-[#0E1524] border-b border-slate-800 px-4 flex items-center justify-between text-xs font-mono text-slate-400 select-none">
          <div className="flex items-center space-x-2">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-semibold text-slate-300">bash / powershell</span>
          </div>

          <div className="flex items-center space-x-3 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <Sparkles className="w-3 h-3" />
              Open-Source & Free Forever
            </span>
            <span className="text-slate-600">|</span>
            <span className={connected ? 'text-emerald-400' : 'text-rose-400'}>
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
        </div>

        {/* XTerm Container */}
        <div ref={terminalRef} className="flex-1 p-3 overflow-hidden" />
      </div>
    </div>
  );
};
