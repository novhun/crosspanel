import os
import asyncio
import shutil
from typing import Dict, Any, Optional
from datetime import datetime
from app.core.config import settings

class GitService:
    @classmethod
    async def run_cmd(cls, cmd_list: list, cwd: Optional[str] = None) -> Dict[str, Any]:
        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd_list,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            return {
                "success": proc.returncode == 0,
                "stdout": stdout.decode("utf-8", errors="ignore").strip(),
                "stderr": stderr.decode("utf-8", errors="ignore").strip(),
                "exit_code": proc.returncode
            }
        except Exception as e:
            return {"success": False, "stdout": "", "stderr": str(e), "exit_code": -1}

    @classmethod
    async def clone_or_pull(cls, project_name: str, repo_url: str, branch: str = "main") -> Dict[str, Any]:
        project_dir = os.path.join(settings.PROJECTS_DIR, project_name)
        
        if os.path.exists(os.path.join(project_dir, ".git")):
            # Repo exists, pull latest
            fetch_res = await cls.run_cmd(["git", "fetch", "--all"], cwd=project_dir)
            checkout_res = await cls.run_cmd(["git", "checkout", branch], cwd=project_dir)
            pull_res = await cls.run_cmd(["git", "pull", "origin", branch], cwd=project_dir)
            commit_res = await cls.run_cmd(["git", "log", "-1", "--pretty=format:%h - %s (%an, %ar)"], cwd=project_dir)
            
            return {
                "success": pull_res["success"],
                "project_dir": project_dir,
                "action": "pull",
                "message": pull_res["stdout"] or pull_res["stderr"],
                "last_commit": commit_res["stdout"] if commit_res["success"] else "Unknown commit"
            }
        else:
            # Clone repo
            os.makedirs(project_dir, exist_ok=True)
            clone_res = await cls.run_cmd(["git", "clone", "-b", branch, repo_url, project_dir])
            commit_res = await cls.run_cmd(["git", "log", "-1", "--pretty=format:%h - %s (%an, %ar)"], cwd=project_dir)
            
            return {
                "success": clone_res["success"],
                "project_dir": project_dir,
                "action": "clone",
                "message": clone_res["stdout"] or clone_res["stderr"] or "Cloned repository successfully.",
                "last_commit": commit_res["stdout"] if commit_res["success"] else "Initial commit"
            }

    @classmethod
    async def write_env_file(cls, project_dir: str, env_vars: Dict[str, str], env_type: str = "production"):
        env_filename = ".env.production" if env_type == "production" else ".env.local"
        env_path = os.path.join(project_dir, env_filename)
        standard_env_path = os.path.join(project_dir, ".env")
        
        lines = [f"{k}={v}\n" for k, v in env_vars.items()]
        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
        with open(standard_env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

    @classmethod
    async def execute_build(cls, project_dir: str, build_command: str) -> Dict[str, Any]:
        logs = []
        logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Starting deployment build...")
        logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Directory: {project_dir}")
        logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Command: {build_command}")

        # Run build command in shell
        try:
            is_win = os.name == "nt"
            shell_cmd = ["cmd", "/c", build_command] if is_win else ["bash", "-c", build_command]
            proc = await asyncio.create_subprocess_exec(
                *shell_cmd,
                cwd=project_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await proc.communicate()
            
            out_str = stdout.decode("utf-8", errors="ignore").strip()
            err_str = stderr.decode("utf-8", errors="ignore").strip()
            
            if out_str:
                logs.append(out_str)
            if err_str:
                logs.append(f"[STDERR] {err_str}")

            success = proc.returncode == 0
            logs.append(f"[{datetime.now().strftime('%H:%M:%S')}] Build {'COMPLETED SUCCESSFULLY' if success else 'FAILED'}")

            return {
                "success": success,
                "logs": "\n".join(logs),
                "exit_code": proc.returncode
            }
        except Exception as e:
            logs.append(f"[EXCEPTION] {str(e)}")
            return {
                "success": False,
                "logs": "\n".join(logs),
                "exit_code": -1
            }
