import asyncio
import ftplib
import io
import os
import platform
import posixpath
import re
import shutil
import stat as stat_mod
import subprocess
import threading
import time
from collections import deque
from contextlib import contextmanager
from typing import Any, Dict, List, Optional, Tuple

import paramiko
from pyftpdlib.authorizers import DummyAuthorizer
from pyftpdlib.handlers import FTPHandler
from pyftpdlib.servers import FTPServer

MAX_REMOTE_READ_BYTES = 5 * 1024 * 1024


def _norm_remote(path: str) -> str:
    raw = (path or "/").strip().replace("\\", "/")
    if not raw.startswith("/"):
        raw = "/" + raw
    normalized = posixpath.normpath(raw)
    return normalized if normalized.startswith("/") else "/"


def _join_remote(base: str, name: str) -> str:
    return posixpath.join(_norm_remote(base), name)


def _format_ftp_list_line(line: str, parent_dir: str) -> Optional[Dict[str, Any]]:
    # Unix-style: drwxr-xr-x 2 owner group 4096 Nov 26 21:00 folder
    unix_match = re.match(
        r"^([\-dlcbps])([rwxstST\-]{9})\s+\d+\s+(\S+)\s+(\S+)\s+(\d+)\s+([A-Za-z]{3}\s+\d+\s+[\d:]+)\s+(.+)$",
        line.strip(),
    )
    if unix_match:
        ftype, perms_str, owner, _group, size_str, mod_str, name = unix_match.groups()
        if name in (".", ".."):
            return None
        if ftype == "l" and " -> " in name:
            name = name.split(" -> ", 1)[0]
        return {
            "name": name,
            "path": _join_remote(parent_dir, name),
            "is_dir": ftype == "d",
            "size": 0 if ftype == "d" else int(size_str),
            "modified": mod_str,
            "permissions": perms_str,
            "owner": owner,
        }

    # DOS/IIS-style: 11-26-26  09:00PM       <DIR>          folder
    dos_match = re.match(
        r"^(\d{2}-\d{2}-\d{2,4}\s+\d{2}:\d{2}[AP]M)\s+(<DIR>|\d+)\s+(.+)$",
        line.strip(),
    )
    if dos_match:
        mod_str, size_or_dir, name = dos_match.groups()
        if name in (".", ".."):
            return None
        is_dir = size_or_dir == "<DIR>"
        return {
            "name": name,
            "path": _join_remote(parent_dir, name),
            "is_dir": is_dir,
            "size": 0 if is_dir else int(size_or_dir),
            "modified": mod_str,
            "permissions": "rwxr-xr-x" if is_dir else "rw-r--r--",
            "owner": "ftp",
        }
    return None


class FtpClientService:
    @staticmethod
    @contextmanager
    def _open_ftp(cfg: Dict[str, Any]):
        protocol = (cfg.get("protocol") or "ftp").lower()
        host = cfg["host"]
        port = int(cfg.get("port") or 21)
        username = cfg.get("username") or "anonymous"
        password = cfg.get("password") or ""
        passive = bool(cfg.get("passive", True))

        client = ftplib.FTP_TLS() if protocol == "ftps" else ftplib.FTP()
        try:
            client.connect(host=host, port=port, timeout=12)
            client.login(user=username, passwd=password)
            if protocol == "ftps" and isinstance(client, ftplib.FTP_TLS):
                client.prot_p()
            client.set_pasv(passive)
            yield client
        finally:
            try:
                client.quit()
            except Exception:
                try:
                    client.close()
                except Exception:
                    pass

    @staticmethod
    @contextmanager
    def _open_sftp(cfg: Dict[str, Any]):
        host = cfg["host"]
        port = int(cfg.get("port") or 22)
        username = cfg.get("username") or os.environ.get("USER") or "ubuntu"
        password = cfg.get("password") or ""

        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        sftp = None
        try:
            ssh.connect(
                hostname=host,
                port=port,
                username=username,
                password=password or None,
                timeout=12,
                allow_agent=True,
                look_for_keys=True,
            )
            sftp = ssh.open_sftp()
            yield ssh, sftp
        finally:
            if sftp is not None:
                try:
                    sftp.close()
                except Exception:
                    pass
            try:
                ssh.close()
            except Exception:
                pass

    @classmethod
    def test_connection(cls, cfg: Dict[str, Any]) -> Dict[str, Any]:
        protocol = (cfg.get("protocol") or "ftp").lower()
        if protocol == "sftp":
            with cls._open_sftp(cfg) as (ssh, sftp):
                pwd = sftp.normalize(".")
                transport = ssh.get_transport()
                banner = transport.remote_version if transport else "SFTP"
                return {
                    "success": True,
                    "protocol": "sftp",
                    "pwd": pwd,
                    "banner": banner,
                    "message": f"Connected to SFTP ({banner}) at {pwd}",
                }
        with cls._open_ftp(cfg) as ftp:
            pwd = ftp.pwd()
            welcome = ftp.getwelcome()
            return {
                "success": True,
                "protocol": protocol,
                "pwd": pwd,
                "banner": welcome,
                "message": f"Connected via {protocol.upper()} at {pwd}",
            }

    @classmethod
    def list_dir(cls, cfg: Dict[str, Any], remote_path: str = "/") -> Dict[str, Any]:
        protocol = (cfg.get("protocol") or "ftp").lower()
        target = _norm_remote(remote_path)

        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                resolved = sftp.normalize(target)
                items: List[Dict[str, Any]] = []
                for attr in sftp.listdir_attr(resolved):
                    if attr.filename in (".", ".."):
                        continue
                    mode = attr.st_mode or 0
                    is_dir = stat_mod.S_ISDIR(mode)
                    items.append({
                        "name": attr.filename,
                        "path": _join_remote(resolved, attr.filename),
                        "is_dir": is_dir,
                        "size": 0 if is_dir else int(attr.st_size or 0),
                        "modified": time.strftime(
                            "%Y-%m-%d %H:%M:%S",
                            time.localtime(attr.st_mtime or time.time()),
                        ),
                        "permissions": f"{stat_mod.S_IMODE(mode):03o}" if mode else ("755" if is_dir else "644"),
                        "owner": str(attr.st_uid) if attr.st_uid is not None else "sftp",
                    })
                items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
                parent = posixpath.dirname(resolved)
                return {
                    "current_path": resolved,
                    "parent_path": None if parent == resolved else parent,
                    "items": items,
                }

        with cls._open_ftp(cfg) as ftp:
            ftp.cwd(target)
            resolved = _norm_remote(ftp.pwd())
            items = []
            try:
                for name, facts in ftp.mlsd(resolved):
                    if name in (".", ".."):
                        continue
                    ftype = facts.get("type", "file").lower()
                    if ftype in ("cdir", "pdir"):
                        continue
                    is_dir = ftype == "dir"
                    size = 0 if is_dir else int(facts.get("size", 0) or 0)
                    raw_mod = facts.get("modify", "")
                    if len(raw_mod) >= 14:
                        mod_fmt = f"{raw_mod[0:4]}-{raw_mod[4:6]}-{raw_mod[6:8]} {raw_mod[8:10]}:{raw_mod[10:12]}:{raw_mod[12:14]}"
                    else:
                        mod_fmt = raw_mod or "-"
                    items.append({
                        "name": name,
                        "path": _join_remote(resolved, name),
                        "is_dir": is_dir,
                        "size": size,
                        "modified": mod_fmt,
                        "permissions": facts.get("unix.mode", "755" if is_dir else "644"),
                        "owner": facts.get("unix.owner", "ftp"),
                    })
            except Exception:
                raw_lines: List[str] = []
                ftp.retrlines("LIST", raw_lines.append)
                for line in raw_lines:
                    parsed = _format_ftp_list_line(line, resolved)
                    if parsed:
                        items.append(parsed)

            items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
            parent = posixpath.dirname(resolved)
            return {
                "current_path": resolved,
                "parent_path": None if parent == resolved else parent,
                "items": items,
            }

    @classmethod
    def read_file(cls, cfg: Dict[str, Any], remote_path: str) -> str:
        raw = cls.download_bytes(cfg, remote_path, max_bytes=MAX_REMOTE_READ_BYTES)
        if b"\x00" in raw[:8192]:
            raise ValueError("Binary file cannot be edited as text; download it instead.")
        return raw.decode("utf-8", errors="replace")

    @classmethod
    def write_file(cls, cfg: Dict[str, Any], remote_path: str, content: str) -> Dict[str, Any]:
        target = _norm_remote(remote_path)
        data = content.encode("utf-8")
        cls.upload_bytes(cfg, posixpath.dirname(target), posixpath.basename(target), data)
        return {"success": True, "message": f"Saved remote file {target}"}

    @classmethod
    def mkdir(cls, cfg: Dict[str, Any], remote_path: str) -> Dict[str, Any]:
        protocol = (cfg.get("protocol") or "ftp").lower()
        target = _norm_remote(remote_path)
        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                sftp.mkdir(target)
        else:
            with cls._open_ftp(cfg) as ftp:
                ftp.mkd(target)
        return {"success": True, "message": f"Created remote directory {target}"}

    @classmethod
    def rename(cls, cfg: Dict[str, Any], old_path: str, new_path: str) -> Dict[str, Any]:
        protocol = (cfg.get("protocol") or "ftp").lower()
        src = _norm_remote(old_path)
        dst = _norm_remote(new_path)
        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                sftp.rename(src, dst)
        else:
            with cls._open_ftp(cfg) as ftp:
                ftp.rename(src, dst)
        return {"success": True, "message": f"Renamed to {posixpath.basename(dst)}"}

    @classmethod
    def _sftp_rmtree(cls, sftp, target: str) -> None:
        for attr in sftp.listdir_attr(target):
            if attr.filename in (".", ".."):
                continue
            child = _join_remote(target, attr.filename)
            if stat_mod.S_ISDIR(attr.st_mode or 0):
                cls._sftp_rmtree(sftp, child)
            else:
                sftp.remove(child)
        sftp.rmdir(target)

    @classmethod
    def _ftp_rmtree(cls, ftp: ftplib.FTP, target: str) -> None:
        listed = cls._ftp_list_names_and_types(ftp, target)
        for child_path, is_dir in listed:
            if is_dir:
                cls._ftp_rmtree(ftp, child_path)
            else:
                ftp.delete(child_path)
        ftp.rmd(target)

    @staticmethod
    def _ftp_list_names_and_types(ftp: ftplib.FTP, target: str) -> List[Tuple[str, bool]]:
        out: List[Tuple[str, bool]] = []
        try:
            for name, facts in ftp.mlsd(target):
                if name in (".", ".."):
                    continue
                ftype = facts.get("type", "file").lower()
                if ftype in ("cdir", "pdir"):
                    continue
                out.append((_join_remote(target, name), ftype == "dir"))
            return out
        except Exception:
            lines: List[str] = []
            ftp.cwd(target)
            ftp.retrlines("LIST", lines.append)
            for line in lines:
                parsed = _format_ftp_list_line(line, target)
                if parsed:
                    out.append((parsed["path"], bool(parsed["is_dir"])))
            return out

    @classmethod
    def delete(cls, cfg: Dict[str, Any], remote_path: str, is_dir: bool = False) -> Dict[str, Any]:
        protocol = (cfg.get("protocol") or "ftp").lower()
        target = _norm_remote(remote_path)
        if target == "/":
            raise ValueError("Refusing to delete remote root directory.")

        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                if is_dir:
                    cls._sftp_rmtree(sftp, target)
                else:
                    sftp.remove(target)
        else:
            with cls._open_ftp(cfg) as ftp:
                if is_dir:
                    cls._ftp_rmtree(ftp, target)
                else:
                    ftp.delete(target)
        return {"success": True, "message": f"Deleted {target}"}

    @classmethod
    def chmod(cls, cfg: Dict[str, Any], remote_path: str, mode: str) -> Dict[str, Any]:
        if not re.fullmatch(r"[0-7]{3,4}", mode.strip()):
            raise ValueError("Enter a 3 or 4 digit octal permission value.")
        protocol = (cfg.get("protocol") or "ftp").lower()
        target = _norm_remote(remote_path)
        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                sftp.chmod(target, int(mode.strip(), 8))
        else:
            with cls._open_ftp(cfg) as ftp:
                ftp.sendcmd(f"SITE CHMOD {mode.strip()} {target}")
        return {"success": True, "message": f"Updated permissions to {mode.strip()}"}

    @classmethod
    def upload_bytes(cls, cfg: Dict[str, Any], remote_dir: str, filename: str, data: bytes) -> Dict[str, Any]:
        protocol = (cfg.get("protocol") or "ftp").lower()
        safe_name = posixpath.basename(filename.replace("\\", "/"))
        if not safe_name or safe_name in (".", ".."):
            raise ValueError("Invalid filename.")
        target = _join_remote(remote_dir, safe_name)

        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                with sftp.open(target, "wb") as f:
                    f.write(data)
        else:
            with cls._open_ftp(cfg) as ftp:
                ftp.storbinary(f"STOR {target}", io.BytesIO(data))
        return {"success": True, "path": target, "message": f"Uploaded {safe_name} to {target}"}

    @classmethod
    def download_bytes(cls, cfg: Dict[str, Any], remote_path: str, max_bytes: Optional[int] = None) -> bytes:
        protocol = (cfg.get("protocol") or "ftp").lower()
        target = _norm_remote(remote_path)
        buf = io.BytesIO()

        if protocol == "sftp":
            with cls._open_sftp(cfg) as (_, sftp):
                st = sftp.stat(target)
                if max_bytes and (st.st_size or 0) > max_bytes:
                    raise ValueError("File exceeds 5 MB editor limit; download it instead.")
                with sftp.open(target, "rb") as f:
                    buf.write(f.read())
        else:
            with cls._open_ftp(cfg) as ftp:
                def _write_chunk(chunk: bytes) -> None:
                    if max_bytes and buf.tell() + len(chunk) > max_bytes:
                        raise ValueError("File exceeds 5 MB editor limit; download it instead.")
                    buf.write(chunk)
                ftp.retrbinary(f"RETR {target}", _write_chunk)

        return buf.getvalue()

    @classmethod
    def sync_local(
        cls,
        cfg: Dict[str, Any],
        direction: str,
        local_path: str,
        remote_target: str,
    ) -> Dict[str, Any]:
        resolved_local = os.path.abspath(os.path.expanduser(local_path))
        if direction == "push":
            if not os.path.isfile(resolved_local):
                raise FileNotFoundError(f"Local file not found: {resolved_local}")
            with open(resolved_local, "rb") as f:
                data = f.read()
            return cls.upload_bytes(cfg, remote_target, os.path.basename(resolved_local), data)

        # pull: remote_target is remote file, local_path is local destination directory or file
        data = cls.download_bytes(cfg, remote_target)
        dest_path = (
            os.path.join(resolved_local, posixpath.basename(_norm_remote(remote_target)))
            if os.path.isdir(resolved_local)
            else resolved_local
        )
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as f:
            f.write(data)
        return {"success": True, "path": dest_path.replace("\\", "/"), "message": f"Downloaded to {dest_path}"}


class FtpServerManager:
    _lock = threading.Lock()
    _server: Optional[FTPServer] = None
    _thread: Optional[threading.Thread] = None
    _authorizer: Optional[DummyAuthorizer] = None
    _host: str = "0.0.0.0"
    _port: int = 2121
    _logs: deque = deque(maxlen=200)

    @classmethod
    def _append_log(cls, message: str) -> None:
        stamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        cls._logs.append(f"[{stamp}] {message}")

    @classmethod
    def _build_authorizer(cls, accounts: List[Dict[str, Any]]) -> DummyAuthorizer:
        auth = DummyAuthorizer()
        for acc in accounts:
            if not acc.get("enabled", True):
                continue
            home_dir = os.path.abspath(os.path.expanduser(acc["home_dir"] or "~"))
            os.makedirs(home_dir, exist_ok=True)
            auth.add_user(
                acc["username"],
                acc["password"],
                home_dir,
                perm=acc.get("permissions") or "elradfmwMT",
            )
        return auth

    @classmethod
    def start(cls, host: str, port: int, accounts: List[Dict[str, Any]]) -> Dict[str, Any]:
        with cls._lock:
            if cls._server is not None and cls._thread is not None and cls._thread.is_alive():
                return cls.status()

            authorizer = cls._build_authorizer(accounts)

            class CrossPanelFTPHandler(FTPHandler):
                passive_ports = range(60000, 60101)
                banner = "CrossPanel FTP Server Ready."

                def on_connect(self):
                    FtpServerManager._append_log(f"Client connected: {self.remote_ip}:{self.remote_port}")

                def on_disconnect(self):
                    FtpServerManager._append_log(f"Client disconnected: {self.remote_ip}")

                def on_login(self, username):
                    FtpServerManager._append_log(f"Login succeeded: {username}")

                def on_login_failed(self, username, password):
                    FtpServerManager._append_log(f"Login failed: {username}")

                def on_file_sent(self, file):
                    FtpServerManager._append_log(f"Downloaded: {file}")

                def on_file_received(self, file):
                    FtpServerManager._append_log(f"Uploaded: {file}")

            CrossPanelFTPHandler.authorizer = authorizer
            try:
                server = FTPServer((host, int(port)), CrossPanelFTPHandler)
            except PermissionError as exc:
                raise PermissionError(
                    f"Permission denied binding port {port}. Ports below 1024 require root on Linux; use port 2121 instead."
                ) from exc
            except OSError as exc:
                msg = str(exc)
                if getattr(exc, "errno", None) == 13 or "Errno 13" in msg or "Permission denied" in msg:
                    raise PermissionError(
                        f"Permission denied binding port {port}. Ports below 1024 require root on Linux; use port 2121 instead."
                    ) from exc
                if getattr(exc, "errno", None) == 98 or "Errno 98" in msg or "Address already in use" in msg:
                    raise OSError(
                        f"Port {port} is already in use (e.g. by vsftpd or another service). Use another port such as 2121."
                    ) from exc
                raise
            server.max_cons = 128
            server.max_cons_per_ip = 16

            thread = threading.Thread(
                target=server.serve_forever,
                kwargs={"timeout": 0.5},
                daemon=True,
                name="CrossPanel-FTPServer",
            )
            thread.start()

            cls._server = server
            cls._thread = thread
            cls._authorizer = authorizer
            cls._host = host
            cls._port = int(port)
            cls._append_log(f"FTP server started on {host}:{port} ({len(authorizer.user_table)} active user(s))")
            return cls.status()

    @classmethod
    def stop(cls) -> Dict[str, Any]:
        with cls._lock:
            if cls._server is not None:
                try:
                    cls._server.close_all()
                except Exception:
                    pass
                cls._server = None
                cls._thread = None
                cls._authorizer = None
                cls._append_log("FTP server stopped.")
            return cls.status()

    @classmethod
    def reload_accounts(cls, accounts: List[Dict[str, Any]]) -> None:
        with cls._lock:
            if cls._server is not None:
                new_auth = cls._build_authorizer(accounts)
                cls._server.handler.authorizer = new_auth
                cls._authorizer = new_auth
                cls._append_log(f"Reloaded FTP accounts ({len(new_auth.user_table)} active user(s)).")

    @classmethod
    def status(cls) -> Dict[str, Any]:
        running = cls._server is not None and cls._thread is not None and cls._thread.is_alive()
        active_users = len(cls._authorizer.user_table) if running and cls._authorizer else 0
        return {
            "running": running,
            "host": cls._host,
            "port": cls._port,
            "active_users": active_users,
            "logs": list(cls._logs),
        }


FTP_PACKAGE_CATALOG: Dict[str, Dict[str, Any]] = {
    "vsftpd": {
        "name": "vsftpd",
        "display_name": "vsftpd",
        "description": "Very Secure FTP Daemon — fast, lightweight Linux FTP & FTPS server",
        "default_port": 21,
        "os_support": {"linux"},
        "apt_pkg": "vsftpd",
        "dnf_pkg": "vsftpd",
        "service_names": ["vsftpd"],
        "binaries": ["vsftpd"],
    },
    "proftpd": {
        "name": "proftpd",
        "display_name": "ProFTPD",
        "description": "Configurable FTP, FTPS, and SFTP daemon with virtual-host style config",
        "default_port": 21,
        "os_support": {"linux"},
        "apt_pkg": "proftpd-core",
        "dnf_pkg": "proftpd",
        "service_names": ["proftpd"],
        "binaries": ["proftpd"],
    },
    "pure-ftpd": {
        "name": "pure-ftpd",
        "display_name": "Pure-FTPd",
        "description": "Security-focused FTP daemon with chroot & virtual user support",
        "default_port": 21,
        "os_support": {"linux", "darwin"},
        "apt_pkg": "pure-ftpd",
        "dnf_pkg": "pure-ftpd",
        "brew_pkg": "pure-ftpd",
        "service_names": ["pure-ftpd"],
        "binaries": ["pure-ftpd", "pure-pw"],
    },
    "openssh-server": {
        "name": "openssh-server",
        "display_name": "OpenSSH SFTP Server",
        "description": "Standard SSH & encrypted SFTP subsystem (port 22)",
        "default_port": 22,
        "os_support": {"linux", "darwin", "windows"},
        "apt_pkg": "openssh-server",
        "dnf_pkg": "openssh-server",
        "brew_pkg": "openssh",
        "win_capability": "OpenSSH.Server~~~~0.0.1.0",
        "service_names": ["ssh", "sshd"],
        "binaries": ["sshd", "sshd.exe"],
    },
    "filezilla-server": {
        "name": "filezilla-server",
        "display_name": "FileZilla Server",
        "description": "Cross-platform FTP / FTPS server for Windows via winget",
        "default_port": 21,
        "os_support": {"windows"},
        "winget_id": "TimKosse.FileZilla.Server",
        "service_names": ["filezilla-server"],
        "binaries": ["filezilla-server.exe"],
    },
    "iis-ftp": {
        "name": "iis-ftp",
        "display_name": "Windows IIS FTP Server",
        "description": "Built-in Microsoft IIS FTP service (ftpsvc) for Windows",
        "default_port": 21,
        "os_support": {"windows"},
        "win_feature": "IIS-FTPServer",
        "service_names": ["ftpsvc"],
        "binaries": [],
    },
}


class FtpPackageService:
    @staticmethod
    def _find_binary(names: List[str]) -> Optional[str]:
        search_path = os.environ.get("PATH", "") + ":/usr/sbin:/sbin:/usr/local/sbin"
        for name in names:
            found = shutil.which(name, path=search_path)
            if found:
                return found
        return None

    @staticmethod
    async def _run_shell(cmd: str) -> Tuple[int, str, str]:
        proc = await asyncio.create_subprocess_shell(
            cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        return (
            proc.returncode or 0,
            stdout.decode("utf-8", errors="replace").strip(),
            stderr.decode("utf-8", errors="replace").strip(),
        )

    @classmethod
    async def _detect_linux_pkg(cls, spec: Dict[str, Any]) -> Dict[str, Any]:
        installed = False
        version = ""
        running = False
        active_service = spec["service_names"][0]
        binary_path = cls._find_binary(spec["binaries"])

        if shutil.which("dpkg-query"):
            rc, out, _ = await cls._run_shell(
                f"dpkg-query -W -f='${{Status}}\\t${{Version}}' {spec['apt_pkg']} 2>/dev/null"
            )
            if rc == 0 and "install ok installed" in out:
                installed = True
                parts = out.split("\t", 1)
                version = parts[1].strip() if len(parts) > 1 else ""
        elif shutil.which("rpm"):
            rc, out, _ = await cls._run_shell(f"rpm -q --qf '%{{VERSION}}-%{{RELEASE}}' {spec['dnf_pkg']} 2>/dev/null")
            if rc == 0:
                installed = True
                version = out.strip()
        elif binary_path:
            installed = True

        for svc in spec["service_names"]:
            rc, out, _ = await cls._run_shell(f"systemctl is-active {svc} 2>/dev/null")
            if rc == 0 and out.strip() == "active":
                running = True
                active_service = svc
                break

        candidate_version = ""
        if not installed and shutil.which("apt-cache"):
            rc, out, _ = await cls._run_shell(
                f"apt-cache policy {spec['apt_pkg']} 2>/dev/null | awk '/Candidate:/ {{print $2}}'"
            )
            if rc == 0 and out and out != "(none)":
                candidate_version = out.strip()

        return {
            "installed": installed,
            "running": running,
            "version": version or candidate_version,
            "service_name": active_service,
            "binary_path": binary_path or "",
        }

    @classmethod
    async def _detect_windows_pkg(cls, spec: Dict[str, Any]) -> Dict[str, Any]:
        installed = False
        running = False
        svc_name = spec["service_names"][0]
        binary_path = cls._find_binary(spec["binaries"]) or ""

        rc, out, _ = await cls._run_shell(
            f'powershell -NoProfile -Command "(Get-Service -Name {svc_name} -ErrorAction SilentlyContinue).Status"'
        )
        if rc == 0 and out:
            installed = True
            running = out.strip().lower() == "running"
        elif spec.get("winget_id"):
            w_rc, w_out, _ = await cls._run_shell(f'winget list --id {spec["winget_id"]} -e')
            installed = w_rc == 0 and spec["winget_id"] in w_out
        elif binary_path:
            installed = True

        return {
            "installed": installed,
            "running": running,
            "version": "",
            "service_name": svc_name,
            "binary_path": binary_path,
        }

    @classmethod
    async def list_packages(cls) -> List[Dict[str, Any]]:
        os_name = platform.system().lower()
        results: List[Dict[str, Any]] = []

        for key, spec in FTP_PACKAGE_CATALOG.items():
            if os_name not in spec.get("os_support", {"linux"}):
                continue

            if os_name == "linux":
                info = await cls._detect_linux_pkg(spec)
                install_cmd = (
                    f"sudo apt-get update && sudo apt-get install -y {spec['apt_pkg']}"
                    if shutil.which("apt-get")
                    else f"sudo dnf install -y {spec['dnf_pkg']}"
                )
                uninstall_cmd = (
                    f"sudo systemctl stop {info['service_name']} 2>/dev/null || true; sudo apt-get remove --purge -y {spec['apt_pkg']} && sudo apt-get autoremove -y"
                    if shutil.which("apt-get")
                    else f"sudo dnf remove -y {spec['dnf_pkg']}"
                )
            elif os_name == "darwin":
                rc, out, _ = await cls._run_shell(f"brew list --versions {spec['brew_pkg']} 2>/dev/null")
                installed = rc == 0 and bool(out)
                version = out.split()[-1] if installed else ""
                svc_rc, svc_out, _ = await cls._run_shell(
                    f"brew services list 2>/dev/null | grep -E '^{spec['brew_pkg']}\\s' || true"
                )
                running = svc_rc == 0 and "started" in svc_out
                info = {
                    "installed": installed,
                    "running": running,
                    "version": version,
                    "service_name": spec["brew_pkg"],
                    "binary_path": cls._find_binary(spec["binaries"]) or "",
                }
                install_cmd = f"brew install {spec['brew_pkg']}"
                uninstall_cmd = f"brew services stop {spec['brew_pkg']} 2>/dev/null || true; brew uninstall {spec['brew_pkg']}"
            else:
                info = await cls._detect_windows_pkg(spec)
                if spec.get("win_capability"):
                    cap = spec["win_capability"]
                    install_cmd = f'powershell -NoProfile -Command "Add-WindowsCapability -Online -Name {cap}"'
                    uninstall_cmd = f'powershell -NoProfile -Command "Stop-Service {info["service_name"]} -ErrorAction SilentlyContinue; Remove-WindowsCapability -Online -Name {cap}"'
                elif spec.get("win_feature"):
                    feat = spec["win_feature"]
                    install_cmd = f"dism /Online /Enable-Feature /FeatureName:{feat} /All"
                    uninstall_cmd = f"dism /Online /Disable-Feature /FeatureName:{feat}"
                else:
                    wid = spec.get("winget_id", key)
                    install_cmd = f"winget install --id {wid} -e --accept-package-agreements --accept-source-agreements"
                    uninstall_cmd = f"winget uninstall --id {wid} -e"

            results.append({
                "name": spec["name"],
                "display_name": spec["display_name"],
                "description": spec["description"],
                "default_port": spec["default_port"],
                "os": os_name,
                "installed": info["installed"],
                "running": info["running"],
                "version": info["version"],
                "service_name": info["service_name"],
                "binary_path": info["binary_path"],
                "install_command": install_cmd,
                "uninstall_command": uninstall_cmd,
            })
        return results

    @classmethod
    async def _run_privileged(cls, inner_cmd: str) -> Dict[str, Any]:
        os_name = platform.system().lower()
        if os_name != "linux":
            rc, out, err = await cls._run_shell(inner_cmd)
            return {
                "success": rc == 0,
                "requires_terminal": False,
                "command": inner_cmd,
                "output": out or err,
                "message": out or err or ("Completed" if rc == 0 else "Command failed"),
            }

        is_root = hasattr(os, "geteuid") and os.geteuid() == 0
        if is_root:
            rc, out, err = await cls._run_shell(inner_cmd)
            return {
                "success": rc == 0,
                "requires_terminal": False,
                "command": inner_cmd,
                "output": out or err,
                "message": "Completed successfully." if rc == 0 else (err or out or "Command failed."),
            }

        sudo_rc, _, _ = await cls._run_shell("sudo -n true 2>/dev/null")
        if sudo_rc == 0:
            proc = await asyncio.create_subprocess_exec(
                "sudo",
                "-n",
                "bash",
                "-c",
                inner_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            out = stdout.decode("utf-8", errors="replace").strip()
            err = stderr.decode("utf-8", errors="replace").strip()
            return {
                "success": proc.returncode == 0,
                "requires_terminal": False,
                "command": f"sudo {inner_cmd}",
                "output": out or err,
                "message": "Completed successfully." if proc.returncode == 0 else (err or out or "Command failed."),
            }

        if shutil.which("pkexec") and (os.environ.get("DISPLAY") or os.environ.get("WAYLAND_DISPLAY")):
            proc = await asyncio.create_subprocess_exec(
                "pkexec",
                "bash",
                "-c",
                inner_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await proc.communicate()
            out = stdout.decode("utf-8", errors="replace").strip()
            err = stderr.decode("utf-8", errors="replace").strip()
            if proc.returncode == 0:
                return {
                    "success": True,
                    "requires_terminal": False,
                    "command": inner_cmd,
                    "output": out,
                    "message": "Completed successfully via system authorization.",
                }
            return {
                "success": False,
                "requires_terminal": True,
                "command": f"sudo bash -c {subprocess.list2cmdline([inner_cmd])}",
                "output": err or out,
                "message": "Administrator authorization is required. You can run it directly in the interactive terminal.",
            }

        return {
            "success": False,
            "requires_terminal": True,
            "command": f"sudo bash -c {subprocess.list2cmdline([inner_cmd])}",
            "output": "",
            "message": "Administrator privileges required. Run the command in the interactive terminal.",
        }

    @classmethod
    async def manage_package(cls, pkg_name: str, action: str) -> Dict[str, Any]:
        spec = FTP_PACKAGE_CATALOG.get(pkg_name)
        if not spec:
            raise ValueError(f"Unsupported FTP/SFTP server package: {pkg_name}")

        os_name = platform.system().lower()
        if os_name not in spec.get("os_support", {"linux"}):
            raise ValueError(f"{spec['display_name']} is not available on {os_name}.")
        if os_name == "linux":
            info = await cls._detect_linux_pkg(spec)
            svc = info["service_name"]
            if action == "install":
                if shutil.which("apt-get"):
                    cmd = f"DEBIAN_FRONTEND=noninteractive apt-get update -y && DEBIAN_FRONTEND=noninteractive apt-get install -y {spec['apt_pkg']}"
                    display_cmd = f"sudo apt-get update && sudo apt-get install -y {spec['apt_pkg']}"
                elif shutil.which("dnf"):
                    cmd = f"dnf install -y {spec['dnf_pkg']}"
                    display_cmd = f"sudo {cmd}"
                else:
                    cmd = f"yum install -y {spec['dnf_pkg']}"
                    display_cmd = f"sudo {cmd}"
            elif action == "uninstall":
                if shutil.which("apt-get"):
                    cmd = f"systemctl stop {svc} 2>/dev/null || true; DEBIAN_FRONTEND=noninteractive apt-get remove --purge -y {spec['apt_pkg']} && DEBIAN_FRONTEND=noninteractive apt-get autoremove -y"
                    display_cmd = f"sudo systemctl stop {svc} 2>/dev/null || true; sudo apt-get remove --purge -y {spec['apt_pkg']} && sudo apt-get autoremove -y"
                elif shutil.which("dnf"):
                    cmd = f"systemctl stop {svc} 2>/dev/null || true; dnf remove -y {spec['dnf_pkg']}"
                    display_cmd = f"sudo {cmd}"
                else:
                    cmd = f"systemctl stop {svc} 2>/dev/null || true; yum remove -y {spec['dnf_pkg']}"
                    display_cmd = f"sudo {cmd}"
            elif action in ("start", "stop", "restart"):
                cmd = f"systemctl {action} {svc}"
                display_cmd = f"sudo {cmd}"
            else:
                raise ValueError(f"Unsupported action: {action}")

            res = await cls._run_privileged(cmd)
            if res.get("requires_terminal"):
                res["command"] = display_cmd
            res["packages"] = await cls.list_packages()
            return res

        if os_name == "darwin":
            if action == "install":
                cmd = f"brew install {spec['brew_pkg']}"
            elif action == "uninstall":
                cmd = f"brew services stop {spec['brew_pkg']} 2>/dev/null || true; brew uninstall {spec['brew_pkg']}"
            elif action in ("start", "stop", "restart"):
                cmd = f"brew services {action} {spec['brew_pkg']}"
            else:
                raise ValueError(f"Unsupported action: {action}")
            res = await cls._run_privileged(cmd)
            res["packages"] = await cls.list_packages()
            return res

        if os_name == "windows":
            svc = spec["service_names"][0]
            if action == "install":
                if spec.get("win_capability"):
                    cmd = f'powershell -NoProfile -Command "Add-WindowsCapability -Online -Name {spec["win_capability"]}"'
                elif spec.get("win_feature"):
                    cmd = f"dism /Online /Enable-Feature /FeatureName:{spec['win_feature']} /All"
                else:
                    cmd = f'winget install --id {spec["winget_id"]} -e --accept-package-agreements --accept-source-agreements'
            elif action == "uninstall":
                if spec.get("win_capability"):
                    cmd = f'powershell -NoProfile -Command "Stop-Service {svc} -ErrorAction SilentlyContinue; Remove-WindowsCapability -Online -Name {spec["win_capability"]}"'
                elif spec.get("win_feature"):
                    cmd = f"dism /Online /Disable-Feature /FeatureName:{spec['win_feature']}"
                else:
                    cmd = f'winget uninstall --id {spec["winget_id"]} -e'
            elif action in ("start", "stop", "restart"):
                ps_verb = {"start": "Start-Service", "stop": "Stop-Service", "restart": "Restart-Service"}[action]
                cmd = f'powershell -NoProfile -Command "{ps_verb} {svc}"'
            else:
                raise ValueError(f"Unsupported action: {action}")

            res = await cls._run_privileged(cmd)
            if not res["success"]:
                res["requires_terminal"] = True
            res["packages"] = await cls.list_packages()
            return res

        raise ValueError(f"Package management is not supported for {pkg_name} on {os_name}.")

