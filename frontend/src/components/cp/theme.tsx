import { useEffect, useState } from "react";
import { Moon, Sun, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export const themes = [
  { id: "dark", label: "Dark", icon: Moon },
  { id: "light", label: "Light", icon: Sun },
  { id: "colorful", label: "Colorful", icon: Palette },
] as const;
export type ThemeId = (typeof themes)[number]["id"];

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("dark");
  useEffect(() => {
    const saved = localStorage.getItem("cp-theme") as ThemeId | null;
    if (saved && themes.some((t) => t.id === saved)) setTheme(saved);
    const sync = () => setTheme((localStorage.getItem("cp-theme") as ThemeId) || "dark");
    window.addEventListener("cp-theme", sync);
    return () => window.removeEventListener("cp-theme", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset["theme"] = theme;
    document.documentElement.classList.toggle("dark", theme !== "light");
    localStorage.setItem("cp-theme", theme);
  }, [theme]);
  return (
    <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label="Color mode">
      {themes.map((t) => (
        <button key={t.id} role="radio" aria-checked={theme === t.id} title={t.label} onClick={() => setTheme(t.id)}
          className={cn("rounded-md p-1.5 transition", theme === t.id ? "bg-gradient-primary text-primary-foreground" : "hover:bg-accent")}>
          <t.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
