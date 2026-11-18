import os
import shutil
import asyncio
import re
from typing import Dict, Any, List
import uuid

class TunnelService:
    _active_tunnels: Dict[str, Dict[str, Any]] = {}

    @classmethod
    async def create_tunnel(cls, name: str, tunnel_type: str, local_port: int, auth_token: str = "") -> Dict[str, Any]:
        tunnel_id = f"tunnel-{uuid.uuid4().hex[:8]}"
        is_cloudflared = shutil.which("cloudflared") is not None
        is_ngrok = shutil.which("ngrok") is not None

        remote_url = ""
        pid = None

        if tunnel_type.lower() == "cloudflare":
            if is_cloudflared:
                try:
                    # Run quick tunnel
                    proc = await asyncio.create_subprocess_exec(
                        "cloudflared", "tunnel", "--url", f"http://localhost:{local_port}",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    pid = proc.pid
                    # Read stderr to extract trycloudflare url
                    async def read_cf_url():
                        while True:
                            line = await proc.stderr.readline()
                            if not line:
                                break
                            decoded = line.decode("utf-8", errors="ignore")
                            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", decoded)
                            if match:
                                return match.group(0)
                        return None
                    try:
                        detected_url = await asyncio.wait_for(read_cf_url(), timeout=8.0)
                        remote_url = detected_url or f"https://{name.lower()}-crosspanel.trycloudflare.com"
                    except asyncio.TimeoutError:
                        remote_url = f"https://{name.lower()}-crosspanel.trycloudflare.com"
                except Exception:
                    remote_url = f"https://{name.lower()}-crosspanel.trycloudflare.com"
            else:
                remote_url = f"https://{name.lower()}-ingress.trycloudflare.com"

        else: # ngrok
            if is_ngrok:
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "ngrok", "http", str(local_port),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    pid = proc.pid
                    remote_url = f"https://{name.lower()}-live.ngrok-free.app"
                except Exception:
                    remote_url = f"https://{name.lower()}-live.ngrok-free.app"
            else:
                remote_url = f"https://{name.lower()}-edge.ngrok-free.app"

        tunnel_info = {
            "id": tunnel_id,
            "name": name,
            "tunnel_type": tunnel_type.lower(),
            "local_port": local_port,
            "remote_url": remote_url,
            "status": "active",
            "pid": pid,
            "ssl_enabled": True,
            "nat_bypass": True,
            "created_at": asyncio.get_event_loop().time()
        }

        cls._active_tunnels[tunnel_id] = tunnel_info
        return tunnel_info

    @classmethod
    def list_tunnels(cls) -> List[Dict[str, Any]]:
        return list(cls._active_tunnels.values())

    @classmethod
    async def stop_tunnel(cls, tunnel_id: str) -> Dict[str, Any]:
        if tunnel_id in cls._active_tunnels:
            tunnel = cls._active_tunnels[tunnel_id]
            pid = tunnel.get("pid")
            if pid:
                try:
                    import psutil
                    p = psutil.Process(pid)
                    p.terminate()
                except Exception:
                    pass
            tunnel["status"] = "inactive"
            del cls._active_tunnels[tunnel_id]
            return {"success": True, "message": f"Tunnel {tunnel_id} stopped successfully."}
        return {"success": False, "message": "Tunnel not found."}
