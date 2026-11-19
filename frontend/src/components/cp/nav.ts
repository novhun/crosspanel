import { Home, Boxes, Database, Rocket, SquareTerminal, Globe, Workflow, ShieldCheck, FolderOpen, Settings, Info, PanelsTopLeft, ServerCog, Archive, Users, Clock, FileText, Bot } from "lucide-react";
export const mainNav = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Applications", url: "/applications", icon: Boxes },
  { title: "Website", url: "/website", icon: PanelsTopLeft },
  { title: "Service", url: "/service", icon: ServerCog },
  { title: "Databases", url: "/databases", icon: Database },
  { title: "Deployments", url: "/deployments", icon: Rocket },
  { title: "Web Terminal", url: "/terminal", icon: SquareTerminal },
  { title: "Network Tunnels", url: "/tunnels", icon: Globe },
  { title: "Automation", url: "/automation", icon: Workflow },
  { title: "AI", url: "/ai", icon: Bot },
] as const;
export const mgmtNav = [
  { title: "WAF", url: "/waf", icon: ShieldCheck },
  { title: "Logs", url: "/logs", icon: FileText },
  { title: "Backup & Restore", url: "/backups", icon: Archive },
  { title: "User Management", url: "/users", icon: Users },
  { title: "Sub Accounts", url: "/sub-accounts", icon: Users },
  { title: "Cron Jobs", url: "/cron", icon: Clock },
  { title: "Security", url: "/security", icon: ShieldCheck },
  { title: "File Manager", url: "/files", icon: FolderOpen },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "About", url: "/about", icon: Info },
] as const;
