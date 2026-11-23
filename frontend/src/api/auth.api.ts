import { apiClient } from "./client";

export interface UserProfile {
  id: number;
  username: string;
  email: string;
  display_name: string;
  role: "Administrator" | "Operator" | "Developer" | "Viewer" | string;
  status: "active" | "disabled" | string;
  avatar?: string;
  two_factor_enabled: boolean;
  last_login?: string | null;
  created_at?: string;
}

export interface ApiTokenItem {
  id: number;
  user_id: number;
  name: string;
  token_masked: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  is_revoked: boolean;
}

export interface AuthSessionItem {
  id: number;
  user_id: number;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_active: string;
  is_active: boolean;
}

export interface GeneralSettings {
  panel_name: string;
  panel_port: string;
  target_os: string;
  timezone: string;
  terminal_enabled: boolean;
  two_factor_auth: boolean;
  auto_updates: boolean;
  login_path: string;
}

export const authApi = {
  // Authentication
  login: (payload: { username: string; password: string }) =>
    apiClient.post<{ success: boolean; access_token: string; token_type: string; user: UserProfile }>(
      "/auth/login",
      payload
    ),

  getMe: () =>
    apiClient.get<{ user: UserProfile; active_tokens_count: number; sessions: AuthSessionItem[] }>("/auth/me"),

  changePassword: (payload: { current_password: string; new_password: string; confirm_password?: string }) =>
    apiClient.post<{ success: boolean; message: string }>("/auth/change-password", payload),

  updateProfile: (payload: { display_name?: string; email?: string; avatar?: string }) =>
    apiClient.put<{ success: boolean; message: string; user: UserProfile }>("/auth/profile", payload),

  getTokens: () => apiClient.get<ApiTokenItem[]>("/auth/tokens"),

  createToken: (payload: { name: string }) =>
    apiClient.post<{ success: boolean; message: string; token: string; id: number; name: string }>(
      "/auth/tokens",
      payload
    ),

  revokeToken: (tokenId: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/auth/tokens/${tokenId}`),

  toggle2FA: (payload: { enabled: boolean; code?: string }) =>
    apiClient.post<{ success: boolean; two_factor_enabled: boolean; message: string }>("/auth/2fa/toggle", payload),

  getSessions: () => apiClient.get<AuthSessionItem[]>("/auth/sessions"),

  // User Management
  listUsers: () => apiClient.get<UserProfile[]>("/users"),

  createUser: (payload: {
    username: string;
    email: string;
    password: string;
    display_name?: string;
    role?: string;
    status?: string;
  }) =>
    apiClient.post<{ success: boolean; message: string; user: UserProfile }>("/users", payload),

  getUser: (userId: number) => apiClient.get<UserProfile>(`/users/${userId}`),

  updateUser: (
    userId: number,
    payload: { display_name?: string; email?: string; role?: string; status?: string }
  ) =>
    apiClient.put<{ success: boolean; message: string; user: UserProfile }>(`/users/${userId}`, payload),

  resetUserPassword: (userId: number, payload: { new_password: string }) =>
    apiClient.post<{ success: boolean; message: string }>(`/users/${userId}/reset-password`, payload),

  deleteUser: (userId: number) =>
    apiClient.delete<{ success: boolean; message: string }>(`/users/${userId}`),

  // System general settings
  getGeneralSettings: () => apiClient.get<GeneralSettings>("/system/settings"),

  saveGeneralSettings: (payload: Partial<GeneralSettings>) =>
    apiClient.post<{ success: boolean; message: string }>("/system/settings", payload),
};
