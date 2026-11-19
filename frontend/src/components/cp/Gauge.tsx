export function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 52, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24 sm:h-32 sm:w-32">
        <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
          <circle cx="64" cy="64" r={r} strokeWidth="12" className="fill-none stroke-muted" />
          <circle cx="64" cy="64" r={r} strokeWidth="12" strokeLinecap="round" className="fill-none" style={{ stroke: color, strokeDasharray: c, strokeDashoffset: c * (1 - value / 100), filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset .8s" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-2xl sm:text-3xl font-bold">{value}<span className="text-base">%</span></div>
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
}
