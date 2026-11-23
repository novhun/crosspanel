import { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Trash2,
  Edit2,
  Search,
  RefreshCw,
  Lock,
  Mail,
  UserCheck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, Pill, inputCls } from "./ui";
import { authApi, UserProfile } from "@/api/auth.api";
import { cn } from "@/lib/utils";

export function UsersWorkspace() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("All");

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<UserProfile | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);

  // Forms
  const [createForm, setCreateForm] = useState({
    username: "",
    display_name: "",
    email: "",
    password: "",
    role: "Operator",
    status: "active",
  });
  const [editForm, setEditForm] = useState({
    display_name: "",
    email: "",
    role: "Operator",
    status: "active",
  });
  const [newPassword, setNewPassword] = useState("");

  const loadUsers = async () => {
    if (import.meta.env.MODE === "test") return;
    setIsLoading(true);
    try {
      const data = await authApi.listUsers();
      if (Array.isArray(data)) {
        setUsers(data);
      }
    } catch (err: any) {
      toast.error(`Failed to load users: ${err?.message || "Connection error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.username || !createForm.email || !createForm.password) {
      toast.error("Please fill in all required fields.");
      return;
    }
    try {
      const res = await authApi.createUser(createForm);
      if (res.success) {
        toast.success(res.message);
        setCreateOpen(false);
        setCreateForm({
          username: "",
          display_name: "",
          email: "",
          password: "",
          role: "Operator",
          status: "active",
        });
        loadUsers();
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to create user.");
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    try {
      const res = await authApi.updateUser(editUser.id, editForm);
      if (res.success) {
        toast.success(res.message);
        setEditUser(null);
        loadUsers();
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to update user.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPwdUser || !newPassword) return;
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }
    try {
      const res = await authApi.resetUserPassword(resetPwdUser.id, { new_password: newPassword });
      if (res.success) {
        toast.success(res.message);
        setResetPwdUser(null);
        setNewPassword("");
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to reset password.");
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    try {
      const res = await authApi.deleteUser(deleteUser.id);
      if (res.success) {
        toast.success(res.message);
        setDeleteUser(null);
        loadUsers();
      }
    } catch (err: any) {
      toast.error(err?.detail || err?.message || "Failed to delete user.");
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      `${u.username} ${u.display_name} ${u.email} ${u.role}`.toLowerCase().includes(query.toLowerCase());
    const matchRole = roleFilter === "All" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const activeCount = users.filter((u) => u.status === "active").length;
  const adminCount = users.filter((u) => u.role === "Administrator").length;

  return (
    <>
      <PageHeader
        title="User Management"
        desc="Real team accounts, RBAC role permissions, and access credentials"
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={loadUsers} disabled={isLoading}>
              <RefreshCw className={cn("mr-1.5 size-3.5", isLoading && "animate-spin")} />Refresh
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <UserPlus className="mr-1.5 size-4" />Add Member
            </Button>
          </div>
        }
      />

      {/* Stats Cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">Total Members</span>
            <Users className="size-4 text-cyan" />
          </div>
          <p className="mt-2 text-2xl font-bold font-display">{users.length}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">Active Accounts</span>
            <UserCheck className="size-4 text-success" />
          </div>
          <p className="mt-2 text-2xl font-bold font-display">{activeCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">Administrators</span>
            <ShieldCheck className="size-4 text-warning" />
          </div>
          <p className="mt-2 text-2xl font-bold font-display">{adminCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs">Access Security</span>
            <Lock className="size-4 text-indigo-400" />
          </div>
          <p className="mt-2 text-xs font-medium text-foreground">PBKDF2-HMAC-SHA256 & JWT</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search user, email or role..."
              className={cn(inputCls, "pl-8 w-64 text-xs")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            className={cn(inputCls, "w-40 text-xs")}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="Administrator">Administrator</option>
            <option value="Operator">Operator</option>
            <option value="Developer">Developer</option>
            <option value="Viewer">Viewer</option>
          </select>
        </div>
        <span className="text-xs text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} members
        </span>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-secondary/50 font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3">Last Active</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-semibold text-foreground">
                    <div className="flex items-center gap-3">
                      <img
                        src={u.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${u.username}`}
                        alt={u.username}
                        className="size-8 rounded-full border border-border bg-secondary"
                      />
                      <div>
                        <div className="font-semibold text-foreground">{u.display_name || u.username}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{u.email}</td>
                  <td className="px-4 py-3">
                    <Pill
                      tone={
                        u.role === "Administrator"
                          ? "primary"
                          : u.role === "Operator"
                          ? "info"
                          : u.role === "Developer"
                          ? "warning"
                          : "muted"
                      }
                    >
                      {u.role}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    <Pill tone={u.status === "active" ? "success" : "danger"}>
                      {u.status === "active" ? "Active" : "Disabled"}
                    </Pill>
                  </td>
                  <td className="px-4 py-3">
                    {u.two_factor_enabled ? (
                      <span className="flex items-center gap-1 text-success text-[11px]">
                        <CheckCircle2 className="size-3.5" />Enabled
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground text-[11px]">
                        <XCircle className="size-3.5" />Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-[11px]">
                    {u.last_login ? new Date(u.last_login).toLocaleDateString() : "Never logged in"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Edit User"
                        onClick={() => {
                          setEditUser(u);
                          setEditForm({
                            display_name: u.display_name,
                            email: u.email,
                            role: u.role,
                            status: u.status,
                          });
                        }}
                      >
                        <Edit2 className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Reset Password"
                        onClick={() => {
                          setResetPwdUser(u);
                          setNewPassword("");
                        }}
                      >
                        <KeyRound className="size-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive"
                        title="Delete User"
                        disabled={u.username === "admin"}
                        onClick={() => setDeleteUser(u)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-muted-foreground">
                    No users matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE USER */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="size-4 text-cyan" />Add New Member
            </DialogTitle>
            <DialogDescription>Create a new account with PBKDF2 secure password hashing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3.5 mt-2">
            <label className="block space-y-1 text-xs">
              <span>Username *</span>
              <input
                required
                className={inputCls}
                placeholder="e.g. dev_sarah"
                value={createForm.username}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, username: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Full Name</span>
              <input
                className={inputCls}
                placeholder="e.g. Sarah Connor"
                value={createForm.display_name}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, display_name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Email Address *</span>
              <input
                required
                type="email"
                className={inputCls}
                placeholder="sarah@example.com"
                value={createForm.email}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Initial Password *</span>
              <input
                required
                type="password"
                className={inputCls}
                placeholder="••••••••"
                value={createForm.password}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, password: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs">
                <span>Role</span>
                <select
                  className={inputCls}
                  value={createForm.role}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Operator">Operator</option>
                  <option value="Developer">Developer</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span>Status</span>
                <select
                  className={inputCls}
                  value={createForm.status}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create User</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDIT USER */}
      <Dialog open={editUser !== null} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User: {editUser?.username}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-3.5 mt-2">
            <label className="block space-y-1 text-xs">
              <span>Full Name</span>
              <input
                className={inputCls}
                value={editForm.display_name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, display_name: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-xs">
              <span>Email Address</span>
              <input
                required
                type="email"
                className={inputCls}
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1 text-xs">
                <span>Role</span>
                <select
                  className={inputCls}
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                >
                  <option value="Administrator">Administrator</option>
                  <option value="Operator">Operator</option>
                  <option value="Developer">Developer</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </label>
              <label className="block space-y-1 text-xs">
                <span>Status</span>
                <select
                  className={inputCls}
                  value={editForm.status}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: RESET PASSWORD */}
      <Dialog open={resetPwdUser !== null} onOpenChange={() => setResetPwdUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password: {resetPwdUser?.username}</DialogTitle>
            <DialogDescription>Set a new password for this user.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetPassword} className="space-y-3.5 mt-2">
            <label className="block space-y-1 text-xs">
              <span>New Password</span>
              <input
                required
                type="password"
                className={inputCls}
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2 pt-3 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setResetPwdUser(null)}>
                Cancel
              </Button>
              <Button type="submit">Update Password</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: CONFIRM DELETE */}
      <Dialog open={deleteUser !== null} onOpenChange={() => setDeleteUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="size-5" />Confirm Delete User
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete user <span className="font-semibold text-foreground">@{deleteUser?.username}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Confirm Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
