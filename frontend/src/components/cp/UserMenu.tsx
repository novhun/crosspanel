import { useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { User, Shield, Settings, LogOut, ChevronDown, CheckCircle2, KeyRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authApi, UserProfile } from "@/api/auth.api";
import { toast } from "sonner";

export function UserMenu() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const stored = localStorage.getItem("cp_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (import.meta.env.MODE === "test") return;
    const token = localStorage.getItem("cp_token");
    if (token) {
      authApi
        .getMe()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem("cp_user", JSON.stringify(res.user));
          }
        })
        .catch(() => {
          // Token might be expired or invalid
        });
    } else {
      // If no token in storage, check me anyway (dev fallback)
      authApi
        .getMe()
        .then((res) => {
          if (res?.user) {
            setUser(res.user);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("cp_token");
    localStorage.removeItem("cp_user");
    setUser(null);
    toast.success("Logged out successfully");
    navigate({ to: "/login" as any });
  };

  const displayName = user?.display_name || "Nov Hun";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "NH";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-accent transition-colors outline-none focus:ring-1 focus:ring-primary text-left"
          aria-label="User profile and menu"
        >
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-primary font-bold text-white text-xs shadow-glow">
            {initials}
          </div>
          <div className="hidden leading-tight lg:block">
            <div className="text-sm font-semibold text-foreground truncate max-w-[120px]">
              {displayName}
            </div>
            <div className="flex items-center gap-1 text-[11px] text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              {user?.role || "Administrator"}
            </div>
          </div>
          <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user?.email || "admin@crosspanel.internal"}
            </p>
            <div className="pt-1 flex items-center gap-1 text-[11px] font-mono text-cyan">
              <Shield className="h-3 w-3" />
              <span>{user?.role || "Administrator"}</span>
              {user?.two_factor_enabled && (
                <span className="ml-auto inline-flex items-center text-[10px] text-success">
                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> 2FA
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link to="/users" className="flex items-center cursor-pointer">
              <User className="mr-2 h-4 w-4 text-cyan" />
              <span>User Management</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings" className="flex items-center cursor-pointer">
              <Settings className="mr-2 h-4 w-4 text-primary" />
              <span>Security & Settings</span>
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/login" className="flex items-center cursor-pointer">
              <KeyRound className="mr-2 h-4 w-4 text-warning" />
              <span>Switch / Sign In</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
