import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, Boxes, Database, Server, Zap, Globe, Moon, Sun, Palette } from "lucide-react";
import { toast } from "sonner";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut } from "@/components/ui/command";
import { mainNav, mgmtNav } from "./nav";

const apps = ["WordPress", "FastAPI", "Node.js", "React", "Laravel", "Django", "Express", "PostgreSQL", "Redis", "MongoDB"];
const services = ["Nginx", "PHP-FPM", "MariaDB", "Docker", "Redis"];
const databases = ["wp_production", "api_core", "analytics", "shop_db"];
const tunnels = ["app.crosspanel.dev", "api.crosspanel.dev"];

function setTheme(t: string) {
  localStorage.setItem("cp-theme", t);
  document.documentElement.dataset["theme"] = t;
  document.documentElement.classList.toggle("dark", t !== "light");
  window.dispatchEvent(new Event("cp-theme"));
}

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const go = (to: string) => { setOpen(false); navigate({ to }); };
  const act = (msg: string) => { setOpen(false); toast(msg); };

  return (
    <>
      <button onClick={() => setOpen(true)} className="relative flex h-10 max-w-md flex-1 items-center gap-2 rounded-full border border-input bg-secondary/60 px-3 text-sm text-muted-foreground hover:bg-accent sm:px-4">
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">Search anything...</span>
        <kbd className="ml-auto hidden rounded border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] sm:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search pages, apps, services, databases, actions..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {[...mainNav, ...mgmtNav].map((p) => (
              <CommandItem key={p.url} value={`page ${p.title}`} onSelect={() => go(p.url)}><p.icon className="h-4 w-4" />{p.title}</CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Quick Actions">
            <CommandItem value="open phpmyadmin database" onSelect={() => act("Launching phpMyAdmin")}><Database className="h-4 w-4" />Launch phpMyAdmin<CommandShortcut>DB</CommandShortcut></CommandItem>
            <CommandItem value="new tunnel cloudflare ngrok" onSelect={() => go("/tunnels")}><Globe className="h-4 w-4" />Create Network Tunnel</CommandItem>
            <CommandItem value="deploy now git" onSelect={() => act("Deploy triggered")}><Zap className="h-4 w-4" />Deploy Now</CommandItem>
            <CommandItem value="theme dark mode" onSelect={() => { setTheme("dark"); setOpen(false); }}><Moon className="h-4 w-4" />Switch to Dark mode</CommandItem>
            <CommandItem value="theme light mode" onSelect={() => { setTheme("light"); setOpen(false); }}><Sun className="h-4 w-4" />Switch to Light mode</CommandItem>
            <CommandItem value="theme colorful mode" onSelect={() => { setTheme("colorful"); setOpen(false); }}><Palette className="h-4 w-4" />Switch to Colorful mode</CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Services">
            {services.map((s) => (
              <CommandItem key={s} value={`service restart ${s}`} onSelect={() => act(`Restarting ${s}`)}><Server className="h-4 w-4" />Restart {s}</CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Install App">
            {apps.map((a) => (
              <CommandItem key={a} value={`app install ${a}`} onSelect={() => act(`Installing ${a}`)}><Boxes className="h-4 w-4" />Install {a}</CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Databases">
            {databases.map((d) => (
              <CommandItem key={d} value={`database ${d}`} onSelect={() => go("/databases")}><Database className="h-4 w-4" /><span className="font-mono">{d}</span></CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Tunnels">
            {tunnels.map((t) => (
              <CommandItem key={t} value={`tunnel ${t}`} onSelect={() => go("/tunnels")}><Globe className="h-4 w-4" /><span className="font-mono">{t}</span></CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
