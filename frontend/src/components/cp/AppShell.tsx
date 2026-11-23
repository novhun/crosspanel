import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Menu, SquareTerminal, Bell, Server, Sprout, Heart } from "lucide-react";
import { mainNav, mgmtNav } from "./nav";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "./theme";
import { SearchPalette } from "./SearchPalette";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";

function NavItem({ item, collapsed, active }: { item: (typeof mainNav)[number] | (typeof mgmtNav)[number]; collapsed: boolean; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.url}
      title={item.title}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-sidebar-foreground hover:bg-sidebar-accent",
        collapsed && "justify-center px-2",
      )}
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{item.title}</span>}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });

  if (path === "/login") {
    return <main className="min-h-screen w-full">{children}</main>;
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-all md:flex", collapsed ? "w-[76px]" : "w-60")}>
        <div className="flex flex-col items-center gap-1 px-4 py-5">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Server className="h-6 w-6 text-primary-foreground" />
          </div>
          {!collapsed && (
            <>
              <div className="font-display text-xl font-bold">Cross<span className="text-cyan">Panel</span></div>
              <div className="text-[11px] text-muted-foreground">All-in-One DevOps Workspace</div>
            </>
          )}
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {mainNav.map((i) => <NavItem key={i.url} item={i} collapsed={collapsed} active={path === i.url} />)}
          <div className={cn("pt-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", collapsed ? "text-center" : "px-3")}>{collapsed ? "•" : "Management"}</div>
          {mgmtNav.map((i) => <NavItem key={i.url} item={i} collapsed={collapsed} active={path === i.url} />)}
        </nav>
        {!collapsed && (
          <div className="m-3 rounded-xl border border-success/40 bg-success/10 p-3">
            <div className="flex items-center gap-2 font-display font-bold text-success"><Sprout className="h-4 w-4" /> Open-Source</div>
            <div className="text-sm">Free Forever</div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">Build. Deploy. Grow. <Heart className="h-3.5 w-3.5 text-success" /></div>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/60 px-3 md:h-16 md:gap-3 md:px-4 backdrop-blur-xl">
          <button onClick={() => setCollapsed((c) => !c)} className="hidden rounded-lg p-2 hover:bg-accent md:block" aria-label="Toggle sidebar" ><Menu className="h-5 w-5" /></button>
          <Link to="/" className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow md:hidden" aria-label="CrossPanel home"><Server className="h-5 w-5 text-primary-foreground" /></Link>
          <SearchPalette />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Link to="/terminal" className="hidden items-center gap-2 rounded-full border border-success bg-success/10 px-4 py-2 text-sm font-semibold shadow-glow-success lg:flex">
              <SquareTerminal className="h-4 w-4 text-success" /> Web Terminal
            </Link>
            <button className="relative rounded-lg border border-border p-2 hover:bg-accent" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-destructive text-[10px] font-bold">3</span>
            </button>
            <div className="hidden sm:block"><ThemeSwitcher /></div>
            <UserMenu />
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 pb-28 sm:p-4 md:p-6 md:pb-6">{children}</main>
        <MobileNav />
      </div>
    </div>
  );
}
