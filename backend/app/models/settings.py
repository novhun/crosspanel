from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime
from datetime import datetime
from app.db.database import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(100), unique=True, index=True, nullable=False)
    value = Column(Text, nullable=True)
    description = Column(String(255), nullable=True)

class ManagedService(Base):
    __tablename__ = "managed_services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    display_name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    default_port = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=False)
    status = Column(String(50), default="stopped") # running, stopped, error
    os_type = Column(String(50), default="all") # all, linux, windows, mac
    category = Column(String(50), default="web") # web, db, runtime, container
    run_mode = Column(String(20), default="native") # native or docker
    docker_image = Column(String(100), nullable=True)
    docker_container_name = Column(String(100), nullable=True)

class DeployedApp(Base):
    __tablename__ = "deployed_apps"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    template_name = Column(String(100), nullable=False) # wordpress, fastapi, nodejs, react, laravel, postgres, django, express, custom
    status = Column(String(50), default="created") # running, stopped, deploying, failed
    port = Column(Integer, nullable=True)
    container_id = Column(String(100), nullable=True)
    env_vars = Column(Text, default="{}") # JSON string
    source_url = Column(String(255), nullable=True)
    git_branch = Column(String(100), nullable=True, default="main")
    compose_content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TunnelConfig(Base):
    __tablename__ = "tunnels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    tunnel_type = Column(String(50), default="cloudflare") # cloudflare, ngrok
    local_port = Column(Integer, nullable=False)
    remote_url = Column(String(255), nullable=True)
    status = Column(String(50), default="inactive") # active, inactive, error
    pid = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class FirewallRule(Base):
    __tablename__ = "firewall_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    port = Column(String(50), nullable=False) # e.g. "80", "443", "8000-8080"
    protocol = Column(String(20), default="TCP") # TCP, UDP, ANY
    action = Column(String(20), default="ALLOW") # ALLOW, DENY
    direction = Column(String(20), default="IN") # IN, OUT
    os_type = Column(String(50), default="all")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class JenkinsConfig(Base):
    __tablename__ = "jenkins_jobs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    url = Column(String(255), nullable=False)
    username = Column(String(100), nullable=True)
    token = Column(String(255), nullable=True)
    job_name = Column(String(100), nullable=False)
    last_status = Column(String(50), default="IDLE") # SUCCESS, FAILURE, RUNNING, IDLE
    last_duration = Column(String(50), nullable=True)
    last_run = Column(DateTime, nullable=True)

class AnsiblePlaybook(Base):
    __tablename__ = "ansible_playbooks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    content = Column(Text, nullable=False)
    inventory = Column(Text, default="localhost ansible_connection=local")
    last_run = Column(DateTime, nullable=True)
    last_status = Column(String(50), default="READY")
    last_output = Column(Text, nullable=True)

class CronTask(Base):
    __tablename__ = "cron_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    schedule = Column(String(50), nullable=False) # e.g. "*/5 * * * *", "daily", "hourly"
    command = Column(Text, nullable=False)
    category = Column(String(50), default="maintenance") # backup, maintenance, cleanup, custom
    enabled = Column(Boolean, default=True)
    last_run = Column(DateTime, nullable=True)
    last_status = Column(String(50), default="READY") # READY, SUCCESS, FAILED
    last_output = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class SSLCertificate(Base):
    __tablename__ = "ssl_certificates"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(150), unique=True, index=True, nullable=False)
    issuer = Column(String(100), default="Let's Encrypt")
    cert_type = Column(String(50), default="letsencrypt") # letsencrypt, self_signed, custom
    valid_until = Column(DateTime, nullable=True)
    status = Column(String(50), default="active") # active, expired, pending
    auto_renew = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    cert_path = Column(String(255), nullable=True)
    key_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class DatabaseBackup(Base):
    __tablename__ = "database_backups"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), unique=True, nullable=False)
    database_type = Column(String(50), default="sqlite") # sqlite, mariadb, postgres
    database_name = Column(String(100), default="crosspanel")
    file_size = Column(Integer, default=0) # bytes
    file_path = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(String(255), nullable=True)

class ManagedDatabase(Base):
    __tablename__ = "managed_databases"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    engine = Column(String(50), default="MariaDB") # MariaDB, PostgreSQL, SQLite, Redis, MongoDB
    user = Column(String(100), default="root")
    host = Column(String(100), default="127.0.0.1")
    port = Column(Integer, default=3306)
    size_mb = Column(Integer, default=0)
    tables_count = Column(Integer, default=0)
    run_mode = Column(String(20), default="native") # native or docker
    db_password = Column(String(255), nullable=True, default="")
    connection_string = Column(String(512), nullable=True, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class FtpConnection(Base):
    __tablename__ = "ftp_connections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    protocol = Column(String(20), default="ftp") # ftp, ftps, sftp
    host = Column(String(255), nullable=False)
    port = Column(Integer, default=21)
    username = Column(String(100), nullable=False)
    password = Column(String(255), default="")
    remote_path = Column(String(255), default="/")
    passive = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FtpAccount(Base):
    __tablename__ = "ftp_accounts"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    home_dir = Column(String(255), nullable=False)
    permissions = Column(String(20), default="elradfmwMT")
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

