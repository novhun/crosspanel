import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Home, Boxes, Rocket, SquareTerminal, LayoutGrid } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { mainNav, mgmtNav } from "./nav";
import { ThemeSwitcher } from "./theme";
import { cn } from "@/lib/utils";

const tabs = [
  { title: "Home", url: "/", icon: Home },
  { title: "Apps", url: "/applications", icon: Boxes },
  { title: "Deploy", url: "/deployments", icon: Rocket },
  { title: "Terminal", url: "/terminal", icon: SquareTerminal },
] as const;

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const path = useRouterState({ select: (r) => r.location.pathname });
  const inTabs = tabs.some((t) => t.url === path);
  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sidebar-border bg-sidebar pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden" aria-label="Mobile menu">
        <div className="grid grid-cols-5">
          {tabs.map((t) => {
            const active = path === t.url;
            return (
              <Link key={t.url} to={t.url} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <span className={cn("grid h-8 w-12 place-items-center rounded-full transition", active && "bg-gradient-primary text-primary-foreground shadow-glow")}><t.icon className="h-5 w-5" /></span>
                {t.title}
              </Link>
            );
          })}
          <button onClick={() => setOpen(true)} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium", !inTabs ? "text-primary" : "text-muted-foreground")}>
            <span className={cn("grid h-8 w-12 place-items-center rounded-full", !inTabs && "bg-gradient-primary text-primary-foreground shadow-glow")}><LayoutGrid className="h-5 w-5" /></span>
            More
          </button>
        </div>
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl border-sidebar-border bg-popover">
          <SheetHeader><SheetTitle className="font-display">All Menus</SheetTitle></SheetHeader>
          <div className="grid grid-cols-3 gap-3 px-4 pb-4">
            {[...mainNav, ...mgmtNav].map((i) => (
              <Link key={i.url} to={i.url} onClick={() => setOpen(false)} className={cn("flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-xs font-medium", path === i.url ? "border-primary bg-primary/20" : "border-border bg-secondary/50")}>
                <i.icon className="h-6 w-6 text-cyan" />{i.title}
              </Link>
            ))}
          </div>
          <div className="flex items-center justify-between px-4 pb-6 text-sm">Color mode <ThemeSwitcher /></div>
        </SheetContent>
      </Sheet>
    </>
  );
}
