from typing import Optional
from pydantic import BaseModel


class FtpTargetConfig(BaseModel):
    connection_id: Optional[int] = None
    protocol: str = "ftp"  # ftp, ftps, sftp
    host: str = "127.0.0.1"
    port: int = 21
    username: str = "anonymous"
    password: str = ""
    passive: bool = True
    remote_path: str = "/"


class FtpConnectionCreate(BaseModel):
    name: str
    protocol: str = "ftp"
    host: str
    port: int = 21
    username: str
    password: str = ""
    remote_path: str = "/"
    passive: bool = True


class FtpPathRequest(FtpTargetConfig):
    path: str = "/"


class FtpWriteRequest(FtpTargetConfig):
    path: str
    content: str


class FtpRenameRequest(FtpTargetConfig):
    old_path: str
    new_path: str


class FtpDeleteRequest(FtpTargetConfig):
    path: str
    is_dir: bool = False


class FtpChmodRequest(FtpTargetConfig):
    path: str
    mode: str


class FtpSyncLocalRequest(FtpTargetConfig):
    direction: str = "push"  # push (local -> remote) | pull (remote -> local)
    local_path: str
    remote_target: str


class FtpServerStartRequest(BaseModel):
    port: int = 2121
    host: str = "0.0.0.0"


class FtpAccountCreate(BaseModel):
    username: str
    password: str
    home_dir: str = ""
    permissions: str = "elradfmwMT"
    enabled: bool = True


class FtpAccountUpdate(BaseModel):
    password: Optional[str] = None
    home_dir: Optional[str] = None
    permissions: Optional[str] = None
    enabled: Optional[bool] = None
