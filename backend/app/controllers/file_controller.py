import mimetypes
import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from app.services.file_service import FileService
from app.schemas.deploy_schemas import (
    FileChmodRequest,
    FileDeleteRequest,
    FileMkdirRequest,
    FileRenameRequest,
    FileTransferRequest,
    FileTrashIdsRequest,
    FileUnzipRequest,
    FileWriteRequest,
    FileZipRequest,
)

router = APIRouter(prefix="/files", tags=["Advanced File Manager"])


@router.get("/list")
async def list_directory(path: Optional[str] = Query("", description="Relative or absolute path")):
    try:
        return FileService.list_dir(path or "")
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/read")
async def read_file(path: str = Query(..., description="File path to read")):
    try:
        resolved = FileService._resolve_path(path)
        content = FileService.read_file(resolved)
        return {"path": FileService._norm(resolved), "content": content}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download")
async def download_file(path: str = Query(..., description="File path to download")):
    try:
        resolved = FileService._resolve_path(path)
        if not os.path.exists(resolved):
            raise FileNotFoundError(f"File not found: {resolved}")
        if os.path.isdir(resolved):
            raise IsADirectoryError("Create a .zip archive before downloading a directory.")
        return FileResponse(
            path=resolved,
            filename=os.path.basename(resolved),
            media_type="application/octet-stream",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/view")
async def view_file(path: str = Query(..., description="File path to preview inline")):
    try:
        resolved = FileService._resolve_path(path)
        if not os.path.exists(resolved):
            raise FileNotFoundError(f"File not found: {resolved}")
        if os.path.isdir(resolved):
            raise IsADirectoryError("Cannot preview a directory.")
        mime_type, _ = mimetypes.guess_type(resolved)
        return FileResponse(
            path=resolved,
            media_type=mime_type or "application/octet-stream",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/write")
async def write_file(req: FileWriteRequest):
    try:
        return FileService.write_file(req.path, req.content, create_only=req.create_only)
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/mkdir")
async def make_directory(req: FileMkdirRequest):
    try:
        return FileService.create_folder(req.path)
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rename")
async def rename_item(req: FileRenameRequest):
    try:
        return FileService.rename_item(req.old_path, req.new_path)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/copy")
async def copy_items(req: FileTransferRequest):
    try:
        return FileService.transfer_items(req.source_paths, req.destination_dir, move=False)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/move")
async def move_items(req: FileTransferRequest):
    try:
        return FileService.transfer_items(req.source_paths, req.destination_dir, move=True)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/delete")
async def delete_item(req: FileDeleteRequest):
    try:
        targets = req.paths if req.paths else ([req.path] if req.path else [])
        if req.permanent:
            return FileService.delete_items(targets)
        return FileService.move_to_trash(targets)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/trash")
async def list_trash():
    try:
        return FileService.list_trash()
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/trash/move")
async def move_to_trash(req: FileDeleteRequest):
    try:
        targets = req.paths if req.paths else ([req.path] if req.path else [])
        return FileService.move_to_trash(targets)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/trash/restore")
async def restore_trash(req: FileTrashIdsRequest):
    try:
        return FileService.restore_trash(req.trash_ids)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/trash/delete")
async def delete_trash_items(req: FileTrashIdsRequest):
    try:
        return FileService.delete_trash_items(req.trash_ids)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/trash/empty")
async def empty_trash():
    try:
        return FileService.empty_trash()
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/upload")
async def upload_files(
    target_dir: str = Form(...),
    files: List[UploadFile] = File(...),
):
    try:
        resolved_dir = FileService._resolve_path(target_dir)
        if not os.path.isdir(resolved_dir):
            raise NotADirectoryError(f"Target directory not found: {resolved_dir}")

        saved: List[str] = []
        for upload in files:
            safe_name = os.path.basename(upload.filename or "")
            if not safe_name or safe_name in (".", ".."):
                raise ValueError(f"Invalid filename: {upload.filename}")
            dest_path = os.path.join(resolved_dir, safe_name)
            with open(dest_path, "wb") as out:
                shutil.copyfileobj(upload.file, out)
            saved.append(safe_name)

        return {
            "success": True,
            "files": saved,
            "message": f"Uploaded {len(saved)} file(s) to {FileService._norm(resolved_dir)}.",
        }
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/zip")
async def zip_item(req: FileZipRequest):
    try:
        return FileService.zip_item(req.source_path, req.target_zip)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/unzip")
async def unzip_item(req: FileUnzipRequest):
    try:
        return FileService.unzip_item(req.zip_path, req.extract_to)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/chmod")
async def chmod_item(req: FileChmodRequest):
    try:
        return FileService.chmod_item(req.path, req.mode)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
