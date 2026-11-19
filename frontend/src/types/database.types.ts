export interface DatabaseStatus {
  engine: string;
  mariadb_status: string;
  mariadb_port: number;
  postgres_port: number;
  phpmyadmin_port: number;
  phpmyadmin_active: boolean;
  auto_password_free_ready: boolean;
}

export interface PhpMyAdminLaunchResult {
  success: boolean;
  port: number;
  url: string;
  message: string;
  details?: Record<string, unknown>;
}
