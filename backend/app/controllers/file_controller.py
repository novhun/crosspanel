from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import Optional
from app.services.file_service import FileService
from app.schemas.deploy_schemas import (
    FileWriteRequest, FileMkdirRequest, FileZipRequest, FileUnzipRequest, FileChmodRequest
)

router = APIRouter(prefix="/files", tags=["Advanced File Manager"])

@router.get("/list")
async def list_directory(path: Optional[str] = Query("", description="Relative or absolute path")):
    items = FileService.list_dir(path)
    return {"current_path": path, "items": items}

@router.get("/read")
async def read_file(path: str = Query(..., description="File path to read")):
    try:
        content = FileService.read_file(path)
        return {"path": path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/write")
async def write_file(req: FileWriteRequest):
    try:
        res = FileService.write_file(req.path, req.content)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/mkdir")
async def make_directory(req: FileMkdirRequest):
    try:
        res = FileService.create_folder(req.path)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/delete")
async def delete_item(req: FileMkdirRequest): # re-using path field
    try:
        res = FileService.delete_item(req.path)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/zip")
async def zip_item(req: FileZipRequest):
    try:
        res = FileService.zip_item(req.source_path, req.target_zip)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/unzip")
async def unzip_item(req: FileUnzipRequest):
    try:
        res = FileService.unzip_item(req.zip_path, req.extract_to)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/chmod")
async def chmod_item(req: FileChmodRequest):
    try:
        res = FileService.chmod_item(req.path, req.mode)
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
