import type { ReactNode, ComponentType } from "react";
import { cn } from "@/lib/utils";

export function Panel({ title, icon: Icon, action, className, children }: { title?: string; icon?: ComponentType<{ className?: string }>; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("glass min-w-0 rounded-2xl p-4 sm:p-5", className)}>
      {title && (
        <div className="mb-4 flex items-center gap-3">
          {Icon && <Icon className="h-5 w-5 text-cyan" />}
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <div className="ml-auto">{action}</div>
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, desc, action }: { title: string; desc: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      {action}
    </div>
  );
}

export function Pill({ tone = "success", children }: { tone?: "success" | "danger" | "warning" | "muted" | "primary"; children: ReactNode }) {
  const t = {
    success: "border-success/50 bg-success/15 text-success",
    danger: "border-destructive/50 bg-destructive/15 text-destructive",
    warning: "border-warning/50 bg-warning/15 text-warning",
    muted: "border-border bg-muted text-muted-foreground",
    primary: "border-primary/50 bg-primary/15 text-cyan",
  }[tone];
  return <span className={cn("inline-flex items-center rounded-full border px-3 py-0.5 text-xs font-semibold", t)}>{children}</span>;
}

export function Btn({ variant = "primary", className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "success" | "danger" }) {
  const v = {
    primary: "bg-gradient-primary text-primary-foreground shadow-glow hover:brightness-110",
    ghost: "border border-border bg-secondary/60 hover:bg-accent",
    success: "bg-gradient-success text-primary-foreground hover:brightness-110",
    danger: "bg-destructive text-destructive-foreground hover:brightness-110",
  }[variant];
  return <button {...p} className={cn("inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition", v, className)}>{children}</button>;
}

export const inputCls = "h-10 w-full rounded-lg border border-input bg-secondary/60 px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-accent/30">{r.map((c, j) => <td key={j} className="px-3 py-3">{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
