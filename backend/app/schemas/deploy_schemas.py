from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime

class DeployOneClickRequest(BaseModel):
    name: str
    template_name: str # wordpress, fastapi, nodejs, react, laravel, postgres, django, express
    port: int
    env_vars: Optional[Dict[str, str]] = {}
    source_url: Optional[str] = None

class DeployCustomComposeRequest(BaseModel):
    name: str
    compose_yaml: str
    env_vars: Optional[Dict[str, str]] = {}

class GitDeployRequest(BaseModel):
    name: str
    repo_url: str
    branch: str = "main"
    env_type: str = "production" # production, preview
    build_command: Optional[str] = "npm install && npm run build"
    port: Optional[int] = 3000
    env_vars: Optional[Dict[str, str]] = {}

class TunnelCreateRequest(BaseModel):
    name: str
    tunnel_type: str = "cloudflare" # cloudflare, ngrok
    local_port: int
    auth_token: Optional[str] = None

class AppResponse(BaseModel):
    id: int
    name: str
    template_name: str
    status: str
    port: Optional[int] = None
    container_id: Optional[str] = None
    env_vars: Optional[str] = None
    source_url: Optional[str] = None
    git_branch: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class JenkinsJobCreate(BaseModel):
    name: str
    url: str
    job_name: str
    username: Optional[str] = None
    token: Optional[str] = None

class AnsiblePlaybookCreate(BaseModel):
    name: str
    description: Optional[str] = None
    content: str
    inventory: Optional[str] = "localhost ansible_connection=local"

class FileItem(BaseModel):
    name: str
    path: str
    is_dir: bool
    size: int
    modified: str
    permissions: str

class FileWriteRequest(BaseModel):
    path: str
    content: str

class FileMkdirRequest(BaseModel):
    path: str

class FileZipRequest(BaseModel):
    source_path: str
    target_zip: str

class FileUnzipRequest(BaseModel):
    zip_path: str
    extract_to: str

class FileChmodRequest(BaseModel):
    path: str
    mode: str
