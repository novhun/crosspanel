import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Server, Lock, User, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { authApi } from "@/api/auth.api";
import { meta } from "@/components/cp/meta";

export const Route = createFileRoute("/login")({
  head: () => meta("Sign In", "Sign in to CrossPanel All-in-One DevOps Control Panel."),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillAdmin = () => {
    setUsername("admin");
    setPassword("admin123");
    setError(null);
  };

  const fillOperator = () => {
    setUsername("operator");
    setPassword("operator123");
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await authApi.login({
        username: username.trim(),
        password,
      });

      if (res && res.access_token) {
        localStorage.setItem("cp_token", res.access_token);
        if (res.user) {
          localStorage.setItem("cp_user", JSON.stringify(res.user));
        }
        toast.success(`Welcome back, ${res.user?.display_name || res.user?.username || "Admin"}!`);
        navigate({ to: "/" });
      } else {
        setError("Invalid response from authentication server.");
      }
    } catch (err: any) {
      setError(err?.message || "Invalid credentials. Please verify username and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-12 bg-background relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-[350px] h-[250px] bg-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo and Brand */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-primary shadow-glow mb-2">
            <Server className="h-8 w-8 text-white" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Cross<span className="text-cyan">Panel</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your server control panel
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-border bg-card/80 p-6 md:p-8 backdrop-blur-xl shadow-xl space-y-5">
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Username or Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin or user@domain.com"
                  className="w-full rounded-lg border border-border bg-background/50 pl-10 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-lg border border-border bg-background/50 pl-10 pr-10 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-primary py-2.5 px-4 font-semibold text-sm text-white shadow-glow hover:opacity-90 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </>
              ) : (
                <>
                  Sign In <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="pt-4 border-t border-border/60">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan" />
              <span>Quick Demo Accounts (SQLite Persisted)</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillAdmin}
                className="flex items-center justify-between text-left p-2 rounded-lg border border-border/80 bg-accent/40 hover:bg-accent hover:border-primary/50 transition-colors text-xs"
              >
                <div>
                  <span className="font-semibold block text-foreground">admin</span>
                  <span className="text-[10px] text-muted-foreground">admin123 (Full Admin)</span>
                </div>
                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
              </button>
              <button
                type="button"
                onClick={fillOperator}
                className="flex items-center justify-between text-left p-2 rounded-lg border border-border/80 bg-accent/40 hover:bg-accent hover:border-cyan/50 transition-colors text-xs"
              >
                <div>
                  <span className="font-semibold block text-foreground">operator</span>
                  <span className="text-[10px] text-muted-foreground">operator123</span>
                </div>
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan shrink-0" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-muted-foreground">
          Protected by PBKDF2-HMAC-SHA256 & JWT Bearer authentication.
        </p>
      </div>
    </div>
  );
}
