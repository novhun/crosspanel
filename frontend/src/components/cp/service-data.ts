export type ServiceRecord = {
  name: string; version: string; role: string; category: string; port: string;
  running: boolean; auto: boolean; memory: number; cpu: string; uptime: string;
  configPath: string; config: string;
};

export const initialServices: ServiceRecord[] = [
  { name: "Nginx", version: "1.26.2", role: "Web server & reverse proxy", category: "Web", port: "80 / 443", running: true, auto: true, memory: 24, cpu: "0.4%", uptime: "3d 14h", configPath: "/etc/nginx/nginx.conf", config: "# Demo snippet — not a production configuration\nworker_processes auto;\nevents { worker_connections 1024; }" },
  { name: "PHP-FPM", version: "8.3.12", role: "PHP application processor", category: "Runtime", port: "9000", running: true, auto: true, memory: 86, cpu: "1.2%", uptime: "3d 14h", configPath: "/etc/php/8.3/fpm/pool.d/www.conf", config: "# Demo pool settings\n[www]\nlisten = 127.0.0.1:9000\npm = dynamic\npm.max_children = 10" },
  { name: "MariaDB", version: "11.4.3", role: "Relational database", category: "Database", port: "3306", running: true, auto: true, memory: 142, cpu: "0.8%", uptime: "3d 14h", configPath: "/etc/mysql/mariadb.conf.d/50-server.cnf", config: "# Demo database settings\n[mysqld]\nbind-address = 127.0.0.1\nport = 3306\nmax_connections = 100" },
  { name: "Docker", version: "27.3.1", role: "Container engine", category: "Containers", port: "Unix socket", running: true, auto: true, memory: 218, cpu: "0.6%", uptime: "3d 14h", configPath: "/etc/docker/daemon.json", config: '{\n  "log-driver": "json-file",\n  "log-opts": { "max-size": "10m" }\n}' },
  { name: "Redis", version: "7.4.1", role: "In-memory cache & queue", category: "Cache", port: "6379", running: false, auto: false, memory: 12, cpu: "0.2%", uptime: "—", configPath: "/etc/redis/redis.conf", config: "# Demo cache settings\nbind 127.0.0.1\nport 6379\nmaxmemory 128mb\nmaxmemory-policy allkeys-lru" },
];

export const serviceLibrary = [
  { name: "Nginx", category: "Web", role: "Web server & reverse proxy", versions: ["1.26.2", "1.27.3", "1.24.0"] },
  { name: "Apache", category: "Web", role: "HTTP server with module support", versions: ["2.4.62", "2.4.61"] },
  { name: "PHP-FPM", category: "Runtime", role: "PHP application processor", versions: ["8.3.12", "8.4.0", "8.2.25"] },
  { name: "MariaDB", category: "Database", role: "Relational database", versions: ["11.4.3", "10.11.10"] },
  { name: "PostgreSQL", category: "Database", role: "Advanced relational database", versions: ["17.0", "16.4"] },
  { name: "Docker", category: "Containers", role: "Container engine", versions: ["27.3.1", "26.1.4"] },
  { name: "Redis", category: "Cache", role: "In-memory cache & queue", versions: ["7.4.1", "7.2.6"] },
  { name: "Memcached", category: "Cache", role: "Distributed memory cache", versions: ["1.6.32", "1.6.31"] },
  { name: "Supervisor", category: "Runtime", role: "Background process manager", versions: ["4.2.5", "4.2.4"] },
];