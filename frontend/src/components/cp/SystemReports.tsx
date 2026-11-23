import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, HardDrive, Network, Pause, Play, Activity } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Btn, inputCls, Panel, Pill } from "@/components/cp/ui";
import { demoDisks, reportPoint, type NetworkScope } from "@/components/cp/report-data";
import { useSystemStats } from "@/hooks/useSystemStats";

function ReportChart({ data, series, unit }: {
  data: ReturnType<typeof reportPoint>[];
  series: { key: "upstream" | "downstream" | "read" | "write"; name: string; color: string }[];
  unit: string;
}) {
  return (
    <div className="h-40 min-w-0" role="img" aria-label={`${series.map(s => s.name).join(" and ")} chart in ${unit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="tick" hide />
          <YAxis width={32} domain={[0, "auto"]} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip content={({ active, payload }) => active && payload?.length ? (
            <div className="rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-glow">
              {payload.map(item => <div key={String(item.dataKey)}>{item.name}: {Number(item.value).toFixed(2)} {unit}</div>)}
            </div>
          ) : null} />
          {series.map(s => <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SystemReports() {
  const { stats, isLive } = useSystemStats(3000);
  const [scope, setScope] = useState<NetworkScope>("All");
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => setTick(value => value + 1), 2000);
    return () => clearInterval(timer);
  }, [paused]);

  const data = Array.from({ length: 30 }, (_, index) => reportPoint(scope, tick - 29 + index));
  const current = reportPoint(scope, tick);

  const displayDisks = (isLive && stats)
    ? [
        {
          name: stats.platform_system === "Windows" ? "System Drive (C:)" : "Root (/) ",
          device: stats.platform_system === "Windows" ? "C:\\" : "/dev/root",
          used: stats.disk_used_gb,
          capacity: stats.disk_total_gb
        }
      ]
    : demoDisks;

  const used = displayDisks.reduce((sum, disk) => sum + disk.used, 0);
  const capacity = displayDisks.reduce((sum, disk) => sum + disk.capacity, 0);

  const totalSentGb = (isLive && stats?.net_bytes_sent_mb) ? (stats.net_bytes_sent_mb / 1024) : current.sent;
  const totalRecvGb = (isLive && stats?.net_bytes_recv_mb) ? (stats.net_bytes_recv_mb / 1024) : current.received;

  return (
    <div className="xl:col-span-12">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Resource Reports</h2>
        <div className="flex items-center gap-2">
          <Pill tone={isLive ? "success" : "muted"}>
            {isLive ? "● Connected (Live Host PC)" : "Demo · Not connected"}
          </Pill>
          <Btn variant="ghost" className="h-8 w-8 p-0" aria-label={paused ? "Resume reports" : "Pause reports"} title={paused ? "Resume reports" : "Pause reports"} onClick={() => setPaused(value => !value)}>
            {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          </Btn>
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-12">
        <Panel title="Disk Usage" icon={HardDrive} className="xl:col-span-3">
          <div className="mb-5 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-semibold">{capacity > 0 ? Math.round(used / capacity * 100) : 0}%</span>
            <span className="text-xs text-muted-foreground">used</span>
          </div>
          <div className="space-y-5">
            {displayDisks.map(disk => <div key={disk.name}>
              <div className="mb-1 flex justify-between gap-2 text-sm">
                <span className="font-mono">{disk.name}</span>
                <span className="text-muted-foreground">{disk.capacity > 0 ? (disk.used / disk.capacity * 100).toFixed(1) : 0}%</span>
              </div>
              <progress className="h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-chart-3 [&::-moz-progress-bar]:bg-chart-3" value={disk.used} max={disk.capacity} aria-label={`${disk.name} disk usage`} />
              <div className="mt-1 flex flex-wrap justify-between gap-1 text-xs text-muted-foreground">
                <span>{disk.device}</span>
                <span>{disk.used.toFixed(1)} / {disk.capacity.toFixed(1)} GB</span>
              </div>
            </div>)}
          </div>
          <div className="mt-5 flex justify-between border-t border-border pt-3 text-xs text-muted-foreground">
            <span>Available</span>
            <span className="font-mono text-foreground">{Math.max(0, capacity - used).toFixed(1)} GB</span>
          </div>
        </Panel>
        <Panel title="Traffic" icon={Network} className="xl:col-span-5" action={
          <div className="flex items-center gap-1.5 text-xs">
            <label htmlFor="report-network" className="text-muted-foreground">Net:</label>
            <select id="report-network" className={`${inputCls} h-8 w-20 px-2`} value={scope} onChange={event => { const value = event.target.value; if (value === "All" || value === "eth0" || value === "lo") setScope(value); }}>
              <option>All</option>
              <option>eth0</option>
              <option>lo</option>
            </select>
          </div>
        }>
          <div className="mb-2 grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-1 text-xs text-chart-1"><ArrowUp className="h-3.5 w-3.5" />Upstream</div>
              <div className="mt-1 font-mono text-xl font-semibold">{current.upstream.toFixed(2)} <span className="text-xs text-muted-foreground">KB/s</span></div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs text-chart-2"><ArrowDown className="h-3.5 w-3.5" />Downstream</div>
              <div className="mt-1 font-mono text-xl font-semibold">{current.downstream.toFixed(2)} <span className="text-xs text-muted-foreground">KB/s</span></div>
            </div>
          </div>
          <ReportChart data={data} unit="KB/s" series={[{ key: "upstream", name: "Upstream", color: "var(--chart-1)" }, { key: "downstream", name: "Downstream", color: "var(--chart-2)" }]} />
          <div className="mt-3 grid grid-cols-2 gap-4 border-t border-border pt-3">
            <div>
              <div className="text-xs text-muted-foreground">Total sent</div>
              <div className="mt-1 font-mono font-semibold">{totalSentGb.toFixed(2)} GB</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total received</div>
              <div className="mt-1 font-mono font-semibold">{totalRecvGb.toFixed(2)} GB</div>
            </div>
          </div>
        </Panel>
        <Panel title="Disk IO" icon={Activity} className="lg:col-span-2 xl:col-span-4" action={<span className="whitespace-nowrap text-xs text-muted-foreground">{paused ? "Paused" : "Realtime · 2s"}</span>}>
          <div className="mb-2 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-chart-3">Read</div>
              <div className="mt-1 font-mono text-xl font-semibold">{current.read.toFixed(2)} <span className="text-xs text-muted-foreground">MB/s</span></div>
            </div>
            <div>
              <div className="text-xs text-chart-4">Write</div>
              <div className="mt-1 font-mono text-xl font-semibold">{current.write.toFixed(2)} <span className="text-xs text-muted-foreground">MB/s</span></div>
            </div>
          </div>
          <ReportChart data={data} unit="MB/s" series={[{ key: "read", name: "Read", color: "var(--chart-3)" }, { key: "write", name: "Write", color: "var(--chart-4)" }]} />
          <div className="mt-3 flex justify-between gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>Disk: All</span>
            <span>Last 60 seconds</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}