import asyncio
import codecs
import json
import os
import signal
import struct
import subprocess
from typing import Optional
from fastapi import WebSocket, WebSocketDisconnect
from app.core.config import settings

if os.name != "nt":
    import fcntl
    import pty
    import termios
else:
    fcntl = None
    pty = None
    termios = None


class TerminalSessionManager:
    @staticmethod
    def _set_winsize(fd: int, rows: int, cols: int) -> None:
        if fcntl is None or termios is None:
            return
        rows = max(5, min(200, int(rows)))
        cols = max(20, min(500, int(cols)))
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)

    @classmethod
    async def handle_websocket(
        cls,
        websocket: WebSocket,
        cols: int = 80,
        rows: int = 24,
        cwd: str = "",
    ) -> None:
        await websocket.accept()

        if not settings.TERMINAL_ENABLED:
            await websocket.send_text(
                "\r\n\x1b[31m[CrossPanel Security] Web Terminal is currently disabled in settings.\x1b[0m\r\n"
            )
            await websocket.close()
            return

        if os.name == "nt" or pty is None:
            await cls._handle_windows_pipe(websocket)
            return

        await cls._handle_posix_pty(websocket, cols=cols, rows=rows, cwd=cwd)

    @classmethod
    async def _handle_posix_pty(
        cls,
        websocket: WebSocket,
        cols: int,
        rows: int,
        cwd: str,
    ) -> None:
        start_dir = os.path.abspath(os.path.expanduser(cwd)) if cwd else os.path.expanduser("~")
        if not os.path.isdir(start_dir):
            start_dir = os.path.expanduser("~")

        shell_exe = os.environ.get("SHELL") or "/bin/bash"
        if not os.path.isfile(shell_exe):
            shell_exe = "/bin/sh"

        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env.setdefault("LANG", "C.UTF-8")

        master_fd, slave_fd = pty.openpty()
        cls._set_winsize(master_fd, rows, cols)

        def _setup_controlling_tty() -> None:
            os.setsid()
            fcntl.ioctl(slave_fd, termios.TIOCSCTTY, 0)

        proc: Optional[subprocess.Popen] = None
        loop = asyncio.get_running_loop()
        output_queue: asyncio.Queue[Optional[str]] = asyncio.Queue()
        decoder = codecs.getincrementaldecoder("utf-8")(errors="replace")
        reader_registered = False

        try:
            proc = subprocess.Popen(
                [shell_exe, "-i"],
                stdin=slave_fd,
                stdout=slave_fd,
                stderr=slave_fd,
                cwd=start_dir,
                env=env,
                preexec_fn=_setup_controlling_tty,
                close_fds=True,
            )
        except Exception as e:
            os.close(slave_fd)
            os.close(master_fd)
            await websocket.send_text(f"\r\n\x1b[31mTerminal Error: {e}\x1b[0m\r\n")
            await websocket.close()
            return

        os.close(slave_fd)
        os.set_blocking(master_fd, False)

        def _on_pty_readable() -> None:
            try:
                data = os.read(master_fd, 4096)
                if not data:
                    trailing = decoder.decode(b"", final=True)
                    if trailing:
                        output_queue.put_nowait(trailing)
                    output_queue.put_nowait(None)
                    return
                text = decoder.decode(data, final=False)
                if text:
                    output_queue.put_nowait(text)
            except BlockingIOError:
                pass
            except OSError:
                trailing = decoder.decode(b"", final=True)
                if trailing:
                    output_queue.put_nowait(trailing)
                output_queue.put_nowait(None)

        loop.add_reader(master_fd, _on_pty_readable)
        reader_registered = True

        async def _forward_pty_to_ws() -> None:
            while True:
                chunk = await output_queue.get()
                if chunk is None:
                    break
                await websocket.send_text(chunk)

        async def _forward_ws_to_pty() -> None:
            while True:
                client_msg = await websocket.receive_text()
                if not client_msg:
                    continue

                raw_input: Optional[str] = None
                if client_msg.startswith("{"):
                    try:
                        payload = json.loads(client_msg)
                        if isinstance(payload, dict):
                            msg_type = payload.get("type")
                            if msg_type == "resize":
                                new_cols = int(payload.get("cols", cols))
                                new_rows = int(payload.get("rows", rows))
                                cls._set_winsize(master_fd, new_rows, new_cols)
                                continue
                            if msg_type == "input":
                                raw_input = str(payload.get("data", ""))
                    except (ValueError, TypeError):
                        raw_input = client_msg

                if raw_input is None:
                    raw_input = client_msg

                if raw_input:
                    os.write(master_fd, raw_input.encode("utf-8"))

        sender_task = asyncio.create_task(_forward_pty_to_ws())
        receiver_task = asyncio.create_task(_forward_ws_to_pty())

        try:
            done, pending = await asyncio.wait(
                {sender_task, receiver_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            for task in pending:
                task.cancel()
            for task in done:
                exc = task.exception()
                if exc and not isinstance(exc, WebSocketDisconnect):
                    raise exc
        except WebSocketDisconnect:
            pass
        except Exception:
            pass
        finally:
            if reader_registered:
                try:
                    loop.remove_reader(master_fd)
                except Exception:
                    pass
            sender_task.cancel()
            receiver_task.cancel()
            try:
                await websocket.close()
            except Exception:
                pass
            try:
                os.close(master_fd)
            except OSError:
                pass
            if proc is not None and proc.poll() is None:
                try:
                    os.killpg(proc.pid, signal.SIGHUP)
                except ProcessLookupError:
                    pass
                except Exception:
                    try:
                        proc.terminate()
                    except Exception:
                        pass
                try:
                    proc.wait(timeout=1.5)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(proc.pid, signal.SIGKILL)
                    except Exception:
                        proc.kill()
                    proc.wait(timeout=1)

    @classmethod
    async def _handle_windows_pipe(cls, websocket: WebSocket) -> None:
        proc = await asyncio.create_subprocess_exec(
            "powershell.exe",
            "-NoLogo",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async def read_stream(stream) -> None:
            while True:
                data = await stream.read(1024)
                if not data:
                    break
                text = data.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\n", "\r\n")
                await websocket.send_text(text)

        stdout_task = asyncio.create_task(read_stream(proc.stdout))
        stderr_task = asyncio.create_task(read_stream(proc.stderr))

        try:
            while True:
                client_msg = await websocket.receive_text()
                if not client_msg:
                    continue
                if client_msg.startswith("{"):
                    try:
                        payload = json.loads(client_msg)
                        if isinstance(payload, dict):
                            if payload.get("type") == "resize":
                                continue
                            if payload.get("type") == "input":
                                client_msg = str(payload.get("data", ""))
                    except (ValueError, TypeError):
                        pass
                if proc.stdin and client_msg:
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
