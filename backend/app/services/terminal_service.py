import os
import sys
import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from app.core.config import settings

class TerminalSessionManager:
    @classmethod
    async def handle_websocket(cls, websocket: WebSocket):
        await websocket.accept()
        
        if not settings.TERMINAL_ENABLED:
            await websocket.send_text("\r\n\x1b[31m[CrossPanel Security] Web Terminal is currently disabled in settings.\x1b[0m\r\n")
            await websocket.close()
            return

        is_windows = os.name == "nt"
        shell_cmd = ["powershell.exe", "-NoLogo"] if is_windows else ["bash", "-i"]

        try:
            proc = await asyncio.create_subprocess_exec(
                *shell_cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            welcome_msg = (
                "\r\n\x1b[1;36m=====================================================\x1b[0m\r\n"
                "\x1b[1;32m  CrossPanel All-in-One DevOps Web Terminal\x1b[0m\r\n"
                f"\x1b[1;33m  OS: {settings.HOST_OS.upper()} | Target: {settings.TARGET_OS.upper()} | Open-Source & Free Forever\x1b[0m\r\n"
                "\x1b[1;36m=====================================================\x1b[0m\r\n\r\n"
            )
            await websocket.send_text(welcome_msg)

            async def read_stream(stream):
                while True:
                    data = await stream.read(1024)
                    if not data:
                        break
                    text = data.decode("utf-8", errors="replace")
                    # Normalize newlines for xterm
                    text = text.replace("\r\n", "\n").replace("\n", "\r\n")
                    await websocket.send_text(text)

            stdout_task = asyncio.create_task(read_stream(proc.stdout))
            stderr_task = asyncio.create_task(read_stream(proc.stderr))

            try:
                while True:
                    client_msg = await websocket.receive_text()
                    if client_msg:
                        proc.stdin.write(client_msg.encode("utf-8"))
                        await proc.stdin.drain()
            except WebSocketDisconnect:
                pass
            finally:
                stdout_task.cancel()
                stderr_task.cancel()
                try:
                    proc.terminate()
                except Exception:
                    pass

        except Exception as e:
            try:
                await websocket.send_text(f"\r\n\x1b[31mTerminal Error: {str(e)}\x1b[0m\r\n")
                await websocket.close()
            except Exception:
                pass
