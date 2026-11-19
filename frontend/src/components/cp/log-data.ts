export type LogCategory = "System" | "Service" | "Website";
export type LogLevel = "Info" | "Warning" | "Error";
export type LogEntry = { id: number; time: string; category: LogCategory; source: string; level: LogLevel; message: string; detail: string };
export const logSources: Record<LogCategory, string[]> = {
  System: ["Kernel", "SSH", "Scheduler"],
  Service: ["Nginx", "PHP-FPM", "MariaDB", "Docker", "Redis"],
  Website: ["app.crosspanel.dev", "blog.crosspanel.dev", "staging.crosspanel.dev"],
};
export const sampleLogs: LogEntry[] = [
  { id: 1, time: "09:30:01", category: "System", source: "Kernel", level: "Info", message: "System boot completed", detail: "Host: crosspanel-demo\nKernel: Linux 6.8\nAll startup targets reached." },
  { id: 2, time: "09:30:12", category: "Service", source: "Nginx", level: "Info", message: "Worker processes started", detail: "Service: nginx\nWorkers: 4\nConfiguration validation: passed" },
  { id: 3, time: "09:31:04", category: "Website", source: "app.crosspanel.dev", level: "Info", message: "GET /dashboard — 200 OK", detail: "Access log\nMethod: GET\nPath: /dashboard\nStatus: 200\nDuration: 24 ms" },
  { id: 4, time: "09:31:18", category: "System", source: "SSH", level: "Warning", message: "Failed sign-in attempt", detail: "Authentication log\nUser: demo-operator\nReason: invalid password\nSession rejected" },
  { id: 5, time: "09:32:09", category: "Service", source: "MariaDB", level: "Warning", message: "Slow query detected — 1.8s", detail: "Database: wp_production\nDuration: 1800 ms\nQuery exceeded the sample slow-query threshold" },
  { id: 6, time: "09:32:42", category: "Website", source: "blog.crosspanel.dev", level: "Error", message: "POST /wp-admin — 502 Bad Gateway", detail: "Error log\nUpstream: PHP-FPM\nStatus: 502\nUpstream connection timed out" },
  { id: 7, time: "09:33:05", category: "Service", source: "PHP-FPM", level: "Info", message: "Worker pool ready for connections", detail: "Pool: www\nListen: 127.0.0.1:9000\nActive workers: 3" },
  { id: 8, time: "09:33:14", category: "System", source: "Scheduler", level: "Info", message: "Scheduled backup completed", detail: "Job: daily-backup\nSample duration: 14 seconds\nExit status: 0" },
  { id: 9, time: "09:34:02", category: "Service", source: "Docker", level: "Info", message: "Container api-preview is healthy", detail: "Container: api-preview\nHealth check: passed\nRestart count: 0" },
  { id: 10, time: "09:34:15", category: "Website", source: "staging.crosspanel.dev", level: "Warning", message: "GET / — 503 Service Unavailable", detail: "Access log\nStatus: 503\nSite is stopped in the demo configuration" },
  { id: 11, time: "09:34:38", category: "Service", source: "Redis", level: "Error", message: "Connection refused on port 6379", detail: "Service: Redis\nAddress: 127.0.0.1:6379\nService is stopped in the demo configuration" },
];
export function filterLogs(entries: LogEntry[], category: LogCategory, source: string, level: string, query: string) {
  return entries.filter(entry => entry.category === category && (source === "All" || entry.source === source) && (level === "All" || entry.level === level) && `${entry.source} ${entry.message} ${entry.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
}