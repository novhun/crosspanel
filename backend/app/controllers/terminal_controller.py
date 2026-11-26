from fastapi import APIRouter, Query, WebSocket
from app.services.terminal_service import TerminalSessionManager

router = APIRouter(prefix="/terminal", tags=["Web Terminal"])


@router.websocket("/ws")
async def websocket_terminal_endpoint(
    websocket: WebSocket,
    cols: int = Query(80, ge=20, le=500),
    rows: int = Query(24, ge=5, le=200),
    cwd: str = Query("", description="Initial working directory"),
):
    await TerminalSessionManager.handle_websocket(websocket, cols=cols, rows=rows, cwd=cwd)
