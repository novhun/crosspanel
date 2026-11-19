export function passwordPreviewError(current: string, next: string, confirmation: string) {
  if (!current || !next || !confirmation) return "Complete all password fields.";
  if (next !== confirmation) return "New passwords do not match.";
  if (current === next) return "Choose a different new password.";
  return "";
}

export function loginPathError(path: string) {
  if (!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(path)) return "Enter a local path such as /admin-login, without spaces, a domain or query parameters.";
  return "";
}