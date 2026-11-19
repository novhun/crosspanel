import { useState, type FormEvent } from "react";
import { KeyRound, LockKeyhole, Route, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Panel, Pill, inputCls } from "@/components/cp/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { loginPathError, passwordPreviewError } from "@/components/cp/settings-security";

export function SettingsSecurity() {
  const [dialog, setDialog] = useState<"password" | "path" | undefined>();
  const [passwords, setPasswords] = useState({ current: "", next: "", confirmation: "" });
  const [shown, setShown] = useState(false);
  const [error, setError] = useState("");
  const [savedPath, setSavedPath] = useState("/login");
  const [path, setPath] = useState(savedPath);
  const [passwordPreviewed, setPasswordPreviewed] = useState(false);
  function close() {
    setDialog(undefined);
    setPasswords({ current: "", next: "", confirmation: "" });
    setShown(false);
    setError("");
  }
  function open(mode: "password" | "path") {
    setError("");
    setPath(savedPath);
    setDialog(mode);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const validation = dialog === "password" ? passwordPreviewError(passwords.current, passwords.next, passwords.confirmation) : loginPathError(path.trim());
    if (validation) { setError(validation); return; }
    if (dialog === "password") setPasswordPreviewed(true);
    else setSavedPath(path.trim());
    toast(dialog === "password" ? "Password change preview completed" : "Login path saved in preview", { description: "Demo only — no password or login address was changed." });
    close();
  }
  return <>
    <Panel title="Admin Security" icon={LockKeyhole} className="lg:col-span-2" action={<Pill tone="muted">Demo · Not connected</Pill>}>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-3"><div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-cyan" /><h3 className="text-sm font-semibold">Admin Password</h3></div><p className="text-xs text-muted-foreground">{passwordPreviewed ? "Change preview completed · Password unchanged" : "Password changes are not connected"}</p><Button variant="outline" onClick={() => open("password")}><KeyRound />Change Password</Button></div>
        <div className="space-y-3"><div className="flex items-center gap-2"><Route className="h-4 w-4 text-cyan" /><h3 className="text-sm font-semibold">Login Path</h3></div><p className="break-all font-mono text-sm">{savedPath} <span className="font-sans text-xs text-muted-foreground">· Preview only</span></p><Button variant="outline" onClick={() => open("path")}><Route />Change Login Path</Button></div>
      </div>
    </Panel>
    <Dialog open={dialog !== undefined} onOpenChange={value => { if (!value) close(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{dialog === "password" ? "Change Admin Password" : "Change Login Path"}</DialogTitle><DialogDescription>{dialog === "password" ? "Demo only. The current password is not verified, and no password is changed or saved." : "Demo only. This does not create a login page or change the actual login address."}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          {dialog === "password" ? <>
            {([{ key: "current", label: "Current password" }, { key: "next", label: "New password" }, { key: "confirmation", label: "Confirm new password" }] as const).map(field => <label key={field.key} className="block space-y-2 text-sm"><span>{field.label}</span><input className={inputCls} type={shown ? "text" : "password"} autoComplete={field.key === "current" ? "current-password" : "new-password"} required value={passwords[field.key]} onChange={event => { setPasswords(current => ({ ...current, [field.key]: event.target.value })); setError(""); }} /></label>)}
            <Button type="button" variant="ghost" size="sm" onClick={() => setShown(value => !value)}>{shown ? <EyeOff /> : <Eye />}{shown ? "Hide passwords" : "Show passwords"}</Button>
          </> : <>
            <div className="text-xs text-muted-foreground">Current preview: <span className="break-all font-mono text-foreground">{savedPath}</span></div>
            <label className="block space-y-2 text-sm"><span>New login path</span><input required className={inputCls} placeholder="/admin-login" value={path} onChange={event => { setPath(event.target.value); setError(""); }} autoComplete="off" spellCheck={false} /></label>
          </>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={close}>Cancel</Button><Button type="submit">{dialog === "password" ? "Preview Password Change" : "Save Path Preview"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </>;
}