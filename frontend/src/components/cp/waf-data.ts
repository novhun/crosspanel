export const wafTabs = ["Overview", "Website", "Blockade", "Black/White List", "Region", "Traffic", "Custom Rules", "Attack Map", "Report", "Global"] as const;
export const wafSites = [
  { name: "app.crosspanel.dev", server: "Nginx", requests: 18420, blocked: 312 },
  { name: "blog.crosspanel.dev", server: "Nginx", requests: 12360, blocked: 486 },
  { name: "staging.crosspanel.dev", server: "Apache", requests: 0, blocked: 0 },
];
export function supportsWaf(server: string) { return server === "Nginx"; }
export const attacks = [
  { id: 1, time: "09:42:18", ip: "203.0.113.24", site: "app.crosspanel.dev", type: "CC attack", region: "United States", path: "/api/search", action: "Rate limited" },
  { id: 2, time: "09:41:56", ip: "198.51.100.42", site: "blog.crosspanel.dev", type: "Malicious scan", region: "Germany", path: "/.env", action: "Blocked" },
  { id: 3, time: "09:40:12", ip: "192.0.2.18", site: "blog.crosspanel.dev", type: "SQL injection", region: "Singapore", path: "/?id=1", action: "Blocked" },
  { id: 4, time: "09:39:43", ip: "203.0.113.71", site: "app.crosspanel.dev", type: "Keyword match", region: "United States", path: "/login", action: "Blocked" },
];
export const traffic = Array.from({ length: 24 }, (_, hour) => ({ hour: `${hour}:00`, allowed: 600 + ((hour * 137) % 900), blocked: 10 + ((hour * 23) % 80) }));