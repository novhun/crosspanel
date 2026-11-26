import os
import re
import shutil
import stat
import time
import urllib.parse
import zipfile
from typing import Any, Dict, List, Tuple

try:
    import pwd
except ImportError:
    pwd = None


MAX_EDITOR_BYTES = 5 * 1024 * 1024


class FileService:
    DEFAULT_DIR = os.path.expanduser("~")
    PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    TRASH_ROOT = (
        os.path.join(os.path.expanduser("~"), ".local", "share", "Trash")
        if os.name != "nt"
        else os.path.join(os.path.expanduser("~"), ".crosspanel_trash")
    )

    @classmethod
    def _resolve_path(cls, user_path: str = "") -> str:
        raw = (user_path or "").strip()
        if not raw or raw == ".":
            return os.path.abspath(cls.DEFAULT_DIR)
        if raw == "~" or raw.startswith("~/") or raw.startswith("~\\"):
            return os.path.abspath(os.path.expanduser(raw))
        return os.path.abspath(raw)

    @staticmethod
    def _norm(path: str) -> str:
        return path.replace("\\", "/")

    @staticmethod
    def _get_owner(st: os.stat_result) -> str:
        if pwd is not None:
            try:
                return pwd.getpwuid(st.st_uid).pw_name
            except Exception:
                return str(st.st_uid)
        return os.environ.get("USERNAME") or os.environ.get("USER") or "owner"

    @classmethod
    def get_places(cls) -> List[Dict[str, str]]:
        candidates = [
            ("Home", cls.DEFAULT_DIR),
            ("Desktop", os.path.join(cls.DEFAULT_DIR, "Desktop")),
            ("CrossPanel", cls.PROJECT_ROOT),
            ("Filesystem Root", os.path.abspath(os.sep)),
            ("/var/www", "/var/www"),
            ("/etc", "/etc"),
            ("/tmp", "/tmp"),
        ]
        seen = set()
        places: List[Dict[str, str]] = []
        for label, path in candidates:
            norm = cls._norm(os.path.abspath(path))
            if norm not in seen and os.path.isdir(path):
                seen.add(norm)
                places.append({"name": label, "path": norm})
        return places

    @classmethod
    def list_dir(cls, dir_path: str = "") -> Dict[str, Any]:
        target_path = cls._resolve_path(dir_path)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Directory not found: {cls._norm(target_path)}")
        if not os.path.isdir(target_path):
            raise NotADirectoryError(f"Not a directory: {cls._norm(target_path)}")

        items: List[Dict[str, Any]] = []
        with os.scandir(target_path) as entries:
            for entry in entries:
                try:
                    try:
                        st = entry.stat(follow_symlinks=True)
                    except OSError:
                        st = entry.stat(follow_symlinks=False)
                    try:
                        is_dir = entry.is_dir(follow_symlinks=True)
                    except OSError:
                        is_dir = False

                    mode_oct = f"{stat.S_IMODE(st.st_mode):03o}"
                    items.append({
                        "name": entry.name,
                        "path": cls._norm(entry.path),
                        "is_dir": is_dir,
                        "size": st.st_size if not is_dir else 0,
                        "modified": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
                        "permissions": mode_oct,
                        "owner": cls._get_owner(st),
                        "is_symlink": entry.is_symlink(),
                    })
                except OSError:
                    continue

        items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))

        parent = os.path.dirname(target_path)
        parent_path = None if parent == target_path else cls._norm(parent)

        return {
            "current_path": cls._norm(target_path),
            "parent_path": parent_path,
            "places": cls.get_places(),
            "trash_count": cls.get_trash_count(),
            "items": items,
        }

    @classmethod
    def read_file(cls, file_path: str) -> str:
        target_path = cls._resolve_path(file_path)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"File not found: {cls._norm(target_path)}")
        if os.path.isdir(target_path):
            raise IsADirectoryError(f"Path is a directory: {cls._norm(target_path)}")

        size = os.path.getsize(target_path)
        if size > MAX_EDITOR_BYTES:
            raise ValueError("File exceeds 5 MB editor limit. Use Download instead.")

        with open(target_path, "rb") as f:
            raw = f.read()
        if b"\x00" in raw[:8192]:
            raise ValueError("Binary file cannot be opened in the text editor. Use Download instead.")
        return raw.decode("utf-8", errors="replace")

    @classmethod
    def write_file(cls, file_path: str, content: str, create_only: bool = False) -> Dict[str, Any]:
        target_path = cls._resolve_path(file_path)
        if create_only and os.path.exists(target_path):
            raise FileExistsError(f"Item already exists: {os.path.basename(target_path)}")
        parent = os.path.dirname(target_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(content)
        return {
            "success": True,
            "path": cls._norm(target_path),
            "message": f"Saved {os.path.basename(target_path)} successfully.",
        }

    @classmethod
    def create_folder(cls, folder_path: str) -> Dict[str, Any]:
        target_path = cls._resolve_path(folder_path)
        if os.path.exists(target_path):
            raise FileExistsError(f"Item already exists: {os.path.basename(target_path)}")
        os.makedirs(target_path, exist_ok=False)
        return {
            "success": True,
            "path": cls._norm(target_path),
            "message": f"Folder {os.path.basename(target_path)} created.",
        }

    @classmethod
    def rename_item(cls, old_path: str, new_path: str) -> Dict[str, Any]:
        src = cls._resolve_path(old_path)
        dst = cls._resolve_path(new_path)
        if not os.path.exists(src):
            raise FileNotFoundError(f"Source not found: {cls._norm(src)}")
        if os.path.exists(dst):
            raise FileExistsError(f"Destination already exists: {os.path.basename(dst)}")
        os.rename(src, dst)
        return {
            "success": True,
            "path": cls._norm(dst),
            "message": f"Renamed to {os.path.basename(dst)}.",
        }

    @classmethod
    def transfer_items(cls, source_paths: List[str], destination_dir: str, move: bool = False) -> Dict[str, Any]:
        dst_dir = cls._resolve_path(destination_dir)
        if not os.path.isdir(dst_dir):
            raise NotADirectoryError(f"Destination is not a directory: {cls._norm(dst_dir)}")

        processed = 0
        for raw_src in source_paths:
            src = cls._resolve_path(raw_src)
            if not os.path.exists(src):
                raise FileNotFoundError(f"Source not found: {cls._norm(src)}")
            if os.path.dirname(src) == src:
                raise ValueError("The filesystem root cannot be copied or moved.")

            if os.path.isdir(src):
                try:
                    if os.path.commonpath([src, dst_dir]) == src:
                        raise ValueError("A folder cannot be placed inside itself.")
                except ValueError as err:
                    if "inside itself" in str(err):
                        raise

            name = os.path.basename(src)
            target = os.path.join(dst_dir, name)
            if os.path.exists(target):
                raise FileExistsError(f"'{name}' already exists in {cls._norm(dst_dir)}.")

            if move:
                shutil.move(src, target)
            elif os.path.isdir(src):
                shutil.copytree(src, target, symlinks=True)
            else:
                shutil.copy2(src, target)
            processed += 1

        verb = "Moved" if move else "Copied"
        return {
            "success": True,
            "count": processed,
            "message": f"{verb} {processed} item(s) to {cls._norm(dst_dir)}.",
        }

    @classmethod
    def _trash_dirs(cls) -> Tuple[str, str]:
        root = os.path.abspath(cls.TRASH_ROOT)
        files_dir = os.path.join(root, "files")
        info_dir = os.path.join(root, "info")
        os.makedirs(files_dir, exist_ok=True)
        os.makedirs(info_dir, exist_ok=True)
        return files_dir, info_dir

    @classmethod
    def get_trash_count(cls) -> int:
        files_dir = os.path.join(os.path.abspath(cls.TRASH_ROOT), "files")
        if not os.path.isdir(files_dir):
            return 0
        try:
            with os.scandir(files_dir) as entries:
                return sum(1 for _ in entries)
        except OSError:
            return 0

    @classmethod
    def _read_trashinfo(cls, info_path: str) -> Tuple[str, str]:
        original_path = ""
        deleted_at = ""
        if not os.path.isfile(info_path):
            return original_path, deleted_at
        try:
            with open(info_path, "r", encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("Path="):
                        original_path = urllib.parse.unquote(line[5:])
                    elif line.startswith("DeletionDate="):
                        deleted_at = line[13:].replace("T", " ")
        except OSError:
            pass
        return original_path, deleted_at

    @classmethod
    def move_to_trash(cls, paths: List[str]) -> Dict[str, Any]:
        if not paths:
            raise ValueError("No paths specified.")
        files_dir, info_dir = cls._trash_dirs()
        trash_root = os.path.abspath(cls.TRASH_ROOT)
        trashed = 0

        for raw_path in paths:
            target_path = cls._resolve_path(raw_path)
            if os.path.dirname(target_path) == target_path:
                raise ValueError("Refusing to trash filesystem root.")
            try:
                if os.path.commonpath([trash_root, target_path]) == trash_root:
                    raise ValueError("Item is already inside Trash. Use permanent delete instead.")
            except ValueError as err:
                if "already inside Trash" in str(err):
                    raise
            if not os.path.exists(target_path) and not os.path.islink(target_path):
                raise FileNotFoundError(f"Item not found: {cls._norm(target_path)}")

            base_name = os.path.basename(target_path)
            stem, ext = os.path.splitext(base_name)
            candidate = base_name
            counter = 1
            while os.path.exists(os.path.join(files_dir, candidate)) or os.path.exists(
                os.path.join(info_dir, f"{candidate}.trashinfo")
            ):
                candidate = f"{stem}_{int(time.time())}_{counter}{ext}"
                counter += 1

            dest_file = os.path.join(files_dir, candidate)
            info_file = os.path.join(info_dir, f"{candidate}.trashinfo")
            encoded_path = urllib.parse.quote(cls._norm(target_path), safe="/:")
            deletion_date = time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime())

            with open(info_file, "w", encoding="utf-8") as f:
                f.write(f"[Trash Info]\nPath={encoded_path}\nDeletionDate={deletion_date}\n")

            try:
                shutil.move(target_path, dest_file)
            except Exception:
                if os.path.exists(info_file):
                    os.remove(info_file)
                raise
            trashed += 1

        return {
            "success": True,
            "count": trashed,
            "trashed": True,
            "message": f"Moved {trashed} item(s) to Trash.",
        }

    @classmethod
    def list_trash(cls) -> Dict[str, Any]:
        files_dir, info_dir = cls._trash_dirs()
        items: List[Dict[str, Any]] = []

        with os.scandir(files_dir) as entries:
            for entry in entries:
                try:
                    try:
                        st = entry.stat(follow_symlinks=False)
                    except OSError:
                        continue
                    is_dir = entry.is_dir(follow_symlinks=False)
                    info_path = os.path.join(info_dir, f"{entry.name}.trashinfo")
                    orig_path, deleted_at = cls._read_trashinfo(info_path)
                    display_name = os.path.basename(orig_path) if orig_path else entry.name
                    items.append({
                        "trash_id": entry.name,
                        "name": display_name,
                        "original_path": cls._norm(orig_path) if orig_path else "",
                        "deleted_at": deleted_at or time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(st.st_mtime)),
                        "is_dir": is_dir,
                        "size": st.st_size if not is_dir else 0,
                        "permissions": f"{stat.S_IMODE(st.st_mode):03o}",
                        "owner": cls._get_owner(st),
                    })
                except OSError:
                    continue

        items.sort(key=lambda x: x["deleted_at"], reverse=True)
        return {
            "trash_path": cls._norm(os.path.abspath(cls.TRASH_ROOT)),
            "items": items,
        }

    @classmethod
    def _validate_trash_id(cls, trash_id: str) -> str:
        if not trash_id or "/" in trash_id or "\\" in trash_id or trash_id in (".", ".."):
            raise ValueError(f"Invalid trash item identifier: {trash_id}")
        return trash_id

    @classmethod
    def restore_trash(cls, trash_ids: List[str]) -> Dict[str, Any]:
        if not trash_ids:
            raise ValueError("No trash items selected to restore.")
        files_dir, info_dir = cls._trash_dirs()
        restored = 0

        for raw_id in trash_ids:
            tid = cls._validate_trash_id(raw_id)
            src_item = os.path.join(files_dir, tid)
            info_path = os.path.join(info_dir, f"{tid}.trashinfo")
            if not os.path.exists(src_item) and not os.path.islink(src_item):
                raise FileNotFoundError(f"Trash item not found: {tid}")

            orig_path, _ = cls._read_trashinfo(info_path)
            if not orig_path:
                raise ValueError(f"Cannot restore '{tid}': original path metadata is missing.")

            dst_path = cls._resolve_path(orig_path)
            if os.path.exists(dst_path) or os.path.islink(dst_path):
                raise FileExistsError(f"Cannot restore '{os.path.basename(dst_path)}': destination already exists.")

            parent = os.path.dirname(dst_path)
            if parent:
                os.makedirs(parent, exist_ok=True)
            shutil.move(src_item, dst_path)
            if os.path.exists(info_path):
                os.remove(info_path)
            restored += 1

        return {"success": True, "count": restored, "message": f"Restored {restored} item(s)."}

    @classmethod
    def delete_trash_items(cls, trash_ids: List[str]) -> Dict[str, Any]:
        if not trash_ids:
            raise ValueError("No trash items selected.")
        files_dir, info_dir = cls._trash_dirs()
        deleted = 0

        for raw_id in trash_ids:
            tid = cls._validate_trash_id(raw_id)
            target = os.path.join(files_dir, tid)
            info_path = os.path.join(info_dir, f"{tid}.trashinfo")
            if not os.path.exists(target) and not os.path.islink(target):
                raise FileNotFoundError(f"Trash item not found: {tid}")
            if os.path.islink(target) or os.path.isfile(target):
                os.remove(target)
            elif os.path.isdir(target):
                shutil.rmtree(target)
            if os.path.exists(info_path):
                os.remove(info_path)
            deleted += 1

        return {"success": True, "count": deleted, "message": f"Permanently deleted {deleted} item(s)."}

    @classmethod
    def empty_trash(cls) -> Dict[str, Any]:
        files_dir, info_dir = cls._trash_dirs()
        removed = 0

        with os.scandir(files_dir) as entries:
            for entry in entries:
                if entry.is_symlink() or entry.is_file(follow_symlinks=False):
                    os.remove(entry.path)
                elif entry.is_dir(follow_symlinks=False):
                    shutil.rmtree(entry.path)
                removed += 1

        with os.scandir(info_dir) as entries:
            for entry in entries:
                if entry.is_file(follow_symlinks=False) or entry.is_symlink():
                    os.remove(entry.path)

        return {"success": True, "count": removed, "message": f"Emptied Trash ({removed} item(s) permanently deleted)."}

    @classmethod
    def delete_items(cls, paths: List[str]) -> Dict[str, Any]:
        if not paths:
            raise ValueError("No paths specified for deletion.")
        deleted = 0
        for raw_path in paths:
            target_path = cls._resolve_path(raw_path)
            if os.path.dirname(target_path) == target_path:
                raise ValueError("Refusing to delete filesystem root.")
            if not os.path.exists(target_path) and not os.path.islink(target_path):
                raise FileNotFoundError(f"Item not found: {cls._norm(target_path)}")
            if os.path.islink(target_path) or os.path.isfile(target_path):
                os.remove(target_path)
            elif os.path.isdir(target_path):
                shutil.rmtree(target_path)
            deleted += 1
        return {"success": True, "count": deleted, "message": f"Deleted {deleted} item(s)."}

    @classmethod
    def delete_item(cls, path: str) -> Dict[str, Any]:
        return cls.delete_items([path])

    @classmethod
    def zip_item(cls, source_path: str, target_zip: str) -> Dict[str, Any]:
        src = cls._resolve_path(source_path)
        dst = cls._resolve_path(target_zip)
        if not os.path.exists(src):
            raise FileNotFoundError(f"Source not found: {cls._norm(src)}")

        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zipf:
            if os.path.isfile(src):
                zipf.write(src, os.path.basename(src))
            else:
                base_name = os.path.basename(src)
                for root, _, files in os.walk(src):
                    for file in files:
                        full_p = os.path.join(root, file)
                        rel_p = os.path.join(base_name, os.path.relpath(full_p, src))
                        zipf.write(full_p, rel_p)
        return {
            "success": True,
            "path": cls._norm(dst),
            "message": f"Created archive {os.path.basename(dst)}.",
        }

    @classmethod
    def unzip_item(cls, zip_path: str, extract_to: str) -> Dict[str, Any]:
        src = cls._resolve_path(zip_path)
        dst = cls._resolve_path(extract_to)
        if not os.path.isfile(src):
            raise FileNotFoundError(f"Archive not found: {cls._norm(src)}")
        os.makedirs(dst, exist_ok=True)

        dst_real = os.path.realpath(dst)
        with zipfile.ZipFile(src, "r") as zipf:
            for member in zipf.infolist():
                target = os.path.realpath(os.path.join(dst_real, member.filename))
                if os.path.commonpath([dst_real, target]) != dst_real:
                    raise ValueError(f"Unsafe archive entry path: {member.filename}")
            zipf.extractall(dst_real)
        return {"success": True, "path": cls._norm(dst_real), "message": f"Extracted to {cls._norm(dst_real)}."}

    @classmethod
    def chmod_item(cls, path: str, mode: str) -> Dict[str, Any]:
        target_path = cls._resolve_path(path)
        if not os.path.exists(target_path):
            raise FileNotFoundError(f"Item not found: {cls._norm(target_path)}")
        if not re.fullmatch(r"[0-7]{3,4}", mode.strip()):
            raise ValueError("Enter a 3 or 4 digit octal permission value.")
        os.chmod(target_path, int(mode.strip(), 8))
        return {"success": True, "message": f"Permissions updated to {mode.strip()}."}
