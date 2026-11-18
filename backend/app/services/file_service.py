import os
import stat
import zipfile
import shutil
import time
from typing import Dict, Any, List
from app.core.config import settings

class FileService:
    BASE_DIR = os.path.abspath(".")

    @classmethod
    def _safe_path(cls, user_path: str) -> str:
        if not user_path or user_path == "/" or user_path == ".":
            return cls.BASE_DIR
        resolved = os.path.abspath(user_path)
        return resolved

    @classmethod
    def list_dir(cls, dir_path: str = "") -> List[Dict[str, Any]]:
        target_path = cls._safe_path(dir_path)
        if not os.path.exists(target_path) or not os.path.isdir(target_path):
            target_path = cls.BASE_DIR

        items = []
        try:
            with os.scandir(target_path) as entries:
                for entry in entries:
                    try:
                        st = entry.stat()
                        is_dir = entry.is_dir()
                        # Get octal permission string e.g. 0755
                        mode_oct = oct(st.st_mode)[-4:]
                        items.append({
                            "name": entry.name,
                            "path": entry.path.replace("\\", "/"),
                            "is_dir": is_dir,
                            "size": st.st_size if not is_dir else 0,
                            "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
                            "permissions": mode_oct
                        })
                    except Exception:
                        pass
        except Exception as e:
            items.append({"name": "Error reading directory", "path": target_path, "is_dir": True, "size": 0, "modified": "-", "permissions": "0000"})

        # Sort folders first, then files alphabetically
        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
        return items

    @classmethod
    def read_file(cls, file_path: str) -> str:
        target_path = cls._safe_path(file_path)
        with open(target_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()

    @classmethod
    def write_file(cls, file_path: str, content: str) -> Dict[str, Any]:
        target_path = cls._safe_path(file_path)
        os.makedirs(os.path.dirname(target_path), exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"success": True, "message": f"Saved {os.path.basename(target_path)} successfully."}

    @classmethod
    def create_folder(cls, folder_path: str) -> Dict[str, Any]:
        target_path = cls._safe_path(folder_path)
        os.makedirs(target_path, exist_ok=True)
        return {"success": True, "message": f"Folder {os.path.basename(target_path)} created."}

    @classmethod
    def delete_item(cls, path: str) -> Dict[str, Any]:
        target_path = cls._safe_path(path)
        if os.path.isdir(target_path):
            shutil.rmtree(target_path, ignore_errors=True)
        elif os.path.isfile(target_path):
            os.remove(target_path)
        return {"success": True, "message": f"Deleted {os.path.basename(target_path)}."}

    @classmethod
    def zip_item(cls, source_path: str, target_zip: str) -> Dict[str, Any]:
        src = cls._safe_path(source_path)
        dst = cls._safe_path(target_zip)
        
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zipf:
            if os.path.isfile(src):
                zipf.write(src, os.path.basename(src))
            else:
                for root, dirs, files in os.walk(src):
                    for file in files:
                        full_p = os.path.join(root, file)
                        rel_p = os.path.relpath(full_p, src)
                        zipf.write(full_p, rel_p)
        return {"success": True, "message": f"Created archive {os.path.basename(dst)}."}

    @classmethod
    def unzip_item(cls, zip_path: str, extract_to: str) -> Dict[str, Any]:
        src = cls._safe_path(zip_path)
        dst = cls._safe_path(extract_to)
        os.makedirs(dst, exist_ok=True)

        with zipfile.ZipFile(src, "r") as zipf:
            zipf.extractall(dst)
        return {"success": True, "message": f"Extracted to {dst}."}

    @classmethod
    def chmod_item(cls, path: str, mode: str) -> Dict[str, Any]:
        target_path = cls._safe_path(path)
        try:
            int_mode = int(mode, 8)
            os.chmod(target_path, int_mode)
            return {"success": True, "message": f"Permissions updated to {mode}."}
        except Exception as e:
            return {"success": False, "message": str(e)}
