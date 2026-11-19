import type { DemoRow } from "./DemoEditor";
export const databaseEngineDefaults = [
  { name: "MariaDB", versions: ["11.4", "10.11", "10.6"], version: "11.4", installed: true, port: "3306", bind: "127.0.0.1", auto: true, connections: "100", memory: "256", description: "SQL · Websites & applications", config: "# Demo snippet\n[mysqld]\nmax_connections = 100" },
  { name: "PostgreSQL", versions: ["17", "16", "15"], version: "17", installed: true, port: "5432", bind: "127.0.0.1", auto: true, connections: "100", memory: "128", description: "SQL · Advanced relational data", config: "# Demo snippet\nmax_connections = 100\nshared_buffers = '128MB'" },
  { name: "MongoDB", versions: ["8", "7", "6"], version: "8", installed: false, port: "27017", bind: "127.0.0.1", auto: true, connections: "100", memory: "256", description: "NoSQL · Documents & collections", config: "# Demo snippet\nnet:\n  port: 27017\n  bindIp: 127.0.0.1" },
];
export type DatabaseEngine = typeof databaseEngineDefaults[number];
export const databaseRows: DemoRow[] = [
  { id: 1, enabled: true, values: { name: "wp_production", engine: "MariaDB", user: "wp_user" } },
  { id: 2, enabled: true, values: { name: "api_core", engine: "PostgreSQL", user: "api" } },
  { id: 3, enabled: true, values: { name: "analytics", engine: "PostgreSQL", user: "metrics" } },
  { id: 4, enabled: true, values: { name: "shop_db", engine: "MariaDB", user: "shop" } },
];
export function validateDatabaseEngine(engine: DatabaseEngine) {
  if (!/^\d+$/.test(engine.port) || Number(engine.port) < 1 || Number(engine.port) > 65535) return "Port must be between 1 and 65535.";
  if (!engine.bind.trim() || /[\s/@]/.test(engine.bind)) return "Enter a bind address without spaces or URL characters.";
  if (!/^\d+$/.test(engine.connections) || Number(engine.connections) < 1) return "Maximum connections must be a positive whole number.";
  if (!/^\d+$/.test(engine.memory) || Number(engine.memory) < 1) return "Memory limit must be a positive whole number.";
  if (!engine.config.trim()) return "Configuration draft cannot be empty.";
  return undefined;
}
export function validateDatabaseRecord(values: Record<string, string>, engines: DatabaseEngine[]) {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(values['name'] ?? "")) return "Use a database name starting with a letter or underscore, up to 63 letters, numbers or underscores.";
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/.test(values['user'] ?? "")) return "Use a username starting with a letter or underscore, up to 63 letters, numbers or underscores.";
  if (!engines.some((engine) => engine.name === values['engine'] && engine.installed)) return "Select an installed demo engine.";
  return undefined;
}