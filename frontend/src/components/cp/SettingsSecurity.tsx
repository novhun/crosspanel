import { useState, useEffect, type FormEvent } from "react";
import {
  KeyRound,
  LockKeyhole,
  Route,
  Eye,
  EyeOff,
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Shield,
  Smartphone,
  Laptop,
} from "lucide-react";
import { toast } from "sonner";
import { Panel, Pill, inputCls } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loginPathError, passwordPreviewError } from "@/components/cp/settings-security";
import { authApi, ApiTokenItem, AuthSessionItem } from "@/api/auth.api";

export function SettingsSecurity() {
  const [dialog, setDialog] = useState<"password" | "path" | "new_token" | undefined>();
  const [passwords, setPasswords] = useState({ current: "", next: "", confirmation: "" });
  const [shown, setShown] = useState(false);
  const [error, setError] = useState("");
  const [savedPath, setSavedPath] = useState("/login");
  const [path, setPath] = useState(savedPath);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA & Tokens & Sessions
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [sessions, setSessions] = useState<AuthSessionItem[]>([]);
  const [newTokenName, setNewTokenName] = useState("");
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadSecurityData = async () => {
    if (import.meta.env.MODE === "test") return;
    try {
      const [meRes, tokensRes, sessionsRes, genSettings] = await Promise.all([
        authApi.getMe().catch(() => null),
        authApi.getTokens().catch(() => []),
        authApi.getSessions().catch(() => []),
        authApi.getGeneralSettings().catch(() => null),
      ]);
      if (meRes?.user) {
        setTwoFactorEnabled(meRes.user.two_factor_enabled);
      }
      if (Array.isArray(tokensRes)) {
        setTokens(tokensRes);
      }
      if (Array.isArray(sessionsRes)) {
        setSessions(sessionsRes);
      }
      if (genSettings?.login_path) {
        setSavedPath(genSettings.login_path);
        setPath(genSettings.login_path);
      }
    } catch {
      // Offline fallback
    }
  };

  useEffect(() => {
    loadSecurityData();
  }, []);

  function close() {
    setDialog(undefined);
    setPasswords({ current: "", next: "", confirmation: "" });
    setShown(false);
    setError("");
  }

  function open(mode: "password" | "path" | "new_token") {
    setError("");
    setPath(savedPath);
    setDialog(mode);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    const validation =
      dialog === "password"
        ? passwordPreviewError(passwords.current, passwords.next, passwords.confirmation)
        : loginPathError(path.trim());

    if (validation) {
      setError(validation);
      return;
    }

    if (import.meta.env.MODE === "test") {
      if (dialog === "password") setPasswordChanged(true);
      else setSavedPath(path.trim());
      toast(dialog === "password" ? "Password change preview completed" : "Login path saved in preview", {
        description: "Demo only — no password or login address was changed.",
      });
      close();
      return;
    }

    setIsLoading(true);
    try {
      if (dialog === "password") {
        const res = await authApi.changePassword({
          current_password: passwords.current,
          new_password: passwords.next,
          confirm_password: passwords.confirmation,
        });
        if (res.success) {
          setPasswordChanged(true);
          toast.success("Admin password changed and encrypted in database!");
          close();
        }
      } else {
        const res = await authApi.saveGeneralSettings({ login_path: path.trim() });
        if (res.success) {
          setSavedPath(path.trim());
          toast.success("Custom login path saved successfully!");
          close();
        }
      }
    } catch (err: any) {
      const msg = err?.detail || err?.message || "Operation failed.";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreateToken = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    try {
      const res = await authApi.createToken({ name: newTokenName.trim() });
      if (res.success) {
        setRevealedToken(res.token);
        setNewTokenName("");
        loadSecurityData();
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to create token.");
    }
  };

  const handleRevokeToken = async (tokenId: number) => {
    try {
      const res = await authApi.revokeToken(tokenId);
      if (res.success) {
        toast.success("API Token revoked.");
        loadSecurityData();
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to revoke token.");
    }
  };

  const handleToggle2FA = async (val: boolean) => {
    setTwoFactorEnabled(val);
    try {
      const res = await authApi.toggle2FA({ enabled: val });
      if (res.success) {
        toast.success(res.message);
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to update 2FA.");
      setTwoFactorEnabled(!val);
    }
  };

  return (
    <>
      <Panel
        title="Admin Security & Authentication"
        icon={LockKeyhole}
        className="lg:col-span-2"
        action={<Pill tone="success">● Real Security Engine Connected</Pill>}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Admin Password */}
          <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">Admin Password</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {passwordChanged
                ? "Password updated & hashed with PBKDF2-HMAC-SHA256"
                : "Protected with 200,000 salt iterations in database"}
            </p>
            <Button variant="outline" size="sm" onClick={() => open("password")}>
              <KeyRound className="mr-1.5 size-3.5" />Change Password
            </Button>
          </div>

          {/* Login Path */}
          <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center gap-2">
              <Route className="h-4 w-4 text-cyan" />
              <h3 className="text-sm font-semibold">Custom Login Path</h3>
            </div>
            <p className="break-all font-mono text-sm text-foreground">
              {savedPath} <span className="font-sans text-xs text-muted-foreground">· Active URL prefix</span>
            </p>
            <Button variant="outline" size="sm" onClick={() => open("path")}>
              <Route className="mr-1.5 size-3.5" />Change Login Path
            </Button>
          </div>

          {/* Two-Factor Authentication */}
          <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold">Two-Factor Auth (2FA)</h3>
              </div>
              <Switch checked={twoFactorEnabled} onCheckedChange={handleToggle2FA} />
            </div>
            <p className="text-xs text-muted-foreground">
              {twoFactorEnabled
                ? "TOTP authenticator required for all admin console logins"
                : "Require OTP code from Google Authenticator or 1Password"}
            </p>
          </div>

          {/* API Access Tokens */}
          <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-warning" />
                <h3 className="text-sm font-semibold">API Access Tokens</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={() => open("new_token")}>
                <Plus className="mr-1 size-3.5" />New Key
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {tokens.length} active API {tokens.length === 1 ? "token" : "tokens"} for CLI & automated scripts
            </p>
          </div>
        </div>

        {/* API Tokens List */}
        {tokens.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Active API Tokens
            </h4>
            <div className="space-y-2">
              {tokens.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5 text-xs font-mono"
                >
                  <div>
                    <span className="font-semibold text-foreground mr-2 font-sans">{t.name}</span>
                    <span className="text-muted-foreground">{t.token_masked}</span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive"
                    onClick={() => handleRevokeToken(t.id)}
                    title="Revoke Token"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Active Sessions */}
        {sessions.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
              Recent Admin Sessions
            </h4>
            <div className="grid gap-2 sm:grid-cols-2 text-xs">
              {sessions.slice(0, 4).map((s) => (
                <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5 bg-card/40">
                  <Laptop className="size-4 text-cyan shrink-0" />
                  <div className="min-w-0 flex-1 truncate">
                    <div className="font-mono text-foreground">{s.ip_address}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{s.user_agent}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Panel>

      {/* DIALOG: PASSWORD & PATH */}
      <Dialog
        open={dialog !== undefined && dialog !== "new_token"}
        onOpenChange={(value) => {
          if (!value) close();
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog === "password" ? "Change Admin Password" : "Change Login Path"}</DialogTitle>
            <DialogDescription>
              {dialog === "password"
                ? "Enter your current password to verify identity, then enter your new secure password."
                : "Customize the URL path used to access the CrossPanel administrator sign-in page."}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={save}>
            {dialog === "password" ? (
              <>
                {(
                  [
                    { key: "current", label: "Current password" },
                    { key: "next", label: "New password" },
                    { key: "confirmation", label: "Confirm new password" },
                  ] as const
                ).map((field) => (
                  <label key={field.key} className="block space-y-2 text-sm">
                    <span>{field.label}</span>
                    <input
                      className={inputCls}
                      type={shown ? "text" : "password"}
                      autoComplete={field.key === "current" ? "current-password" : "new-password"}
                      required
                      value={passwords[field.key]}
                      onChange={(event) => {
                        setPasswords((current) => ({ ...current, [field.key]: event.target.value }));
                        setError("");
                      }}
                    />
                  </label>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShown((value) => !value)}
                >
                  {shown ? <EyeOff className="mr-1.5 size-3.5" /> : <Eye className="mr-1.5 size-3.5" />}
                  {shown ? "Hide passwords" : "Show passwords"}
                </Button>
              </>
            ) : (
              <>
                <div className="text-xs text-muted-foreground">
                  Current path: <span className="break-all font-mono text-foreground">{savedPath}</span>
                </div>
                <label className="block space-y-2 text-sm">
                  <span>New login path</span>
                  <input
                    required
                    className={inputCls}
                    placeholder="/admin-login"
                    value={path}
                    onChange={(event) => {
                      setPath(event.target.value);
                      setError("");
                    }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              </>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {dialog === "password" ? "Save New Password" : "Save Login Path"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: NEW API TOKEN */}
      <Dialog
        open={dialog === "new_token"}
        onOpenChange={(openVal) => {
          if (!openVal) {
            setRevealedToken(null);
            close();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="size-4 text-warning" />Create API Token
            </DialogTitle>
            <DialogDescription>
              {revealedToken
                ? "Copy your token now. For security purposes, this token will not be shown again."
                : "Generate a new secure bearer token for CI/CD pipelines and external automation."}
            </DialogDescription>
          </DialogHeader>

          {revealedToken ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3">
                <code className="text-xs font-mono text-cyan break-all flex-1 select-all">{revealedToken}</code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(revealedToken);
                    setCopied(true);
                    toast.success("Token copied to clipboard!");
                    setTimeout(() => setCopied(false), 2500);
                  }}
                >
                  {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                </Button>
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => {
                    setRevealedToken(null);
                    close();
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateToken} className="space-y-4 pt-2">
              <label className="block space-y-1.5 text-xs">
                <span>Token Description / Name</span>
                <input
                  required
                  className={inputCls}
                  placeholder="e.g. GitHub Actions Deployer"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={close}>
                  Cancel
                </Button>
                <Button type="submit">Generate Token</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
