from fastapi import APIRouter, WebSocket
from app.services.terminal_service import TerminalSessionManager

router = APIRouter(prefix="/terminal", tags=["Web Terminal"])

@router.websocket("/ws")
async def websocket_terminal_endpoint(websocket: WebSocket):
    await TerminalSessionManager.handle_websocket(websocket)
