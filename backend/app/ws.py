"""WebSocket hub at /live (CONTRACT §6). Everyone broadcasts through hub.broadcast(type, data)."""
from __future__ import annotations

import asyncio
import json
import logging
import time

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import settings
from app.deps import Principal, principal_from_token
from app.state import state
from app.timefmt import now_iso

log = logging.getLogger("sentinel.ws")


def sim_state_for_clients() -> dict | None:
    """Last SimState, with `connected` reflecting whether a push arrived in the last 5 s."""
    if state.sim_state is None:
        return None
    connected = (time.time() - state.sim_last_push_wall) <= settings.sim_connected_window_s
    return {**state.sim_state, "connected": connected}


class Hub:
    def __init__(self) -> None:
        self.clients: dict[WebSocket, dict] = {}

    async def connect(self, ws: WebSocket, principal: Principal | None, device_fp: str | None) -> None:
        await ws.accept()
        self.clients[ws] = {
            "role": principal.role if principal else "civilian",
            "tenant_id": principal.tenant_id if principal else None,
            "uid": principal.uid if principal else None,
            "device_fp": device_fp,
            "connected_at": now_iso(),
        }

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.pop(ws, None)

    def count(self) -> int:
        return len(self.clients)

    @staticmethod
    def envelope(type_: str, data: dict) -> str:
        return json.dumps({"type": type_, "ts": now_iso(), "data": data}, default=str)

    async def send(self, ws: WebSocket, type_: str, data: dict) -> bool:
        try:
            await ws.send_text(self.envelope(type_, data))
            return True
        except Exception:
            self.disconnect(ws)
            return False

    async def broadcast(self, type: str, data: dict) -> None:
        if not self.clients:
            return
        text = self.envelope(type, data)
        targets = list(self.clients.keys())
        results = await asyncio.gather(*(ws.send_text(text) for ws in targets), return_exceptions=True)
        for ws, result in zip(targets, results):
            if isinstance(result, BaseException):
                self.disconnect(ws)


hub = Hub()
router = APIRouter()


@router.websocket("/live")
async def live(ws: WebSocket) -> None:
    token = ws.query_params.get("token")
    device_fp = ws.query_params.get("device_fp")
    principal = principal_from_token(token)
    await hub.connect(ws, principal, device_fp)
    meta = hub.clients[ws]
    await hub.send(ws, "hello", {
        "server_time": now_iso(),
        "sim": sim_state_for_clients(),
        "ws_clients": hub.count(),
        "role": meta["role"],
    })
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if isinstance(msg, dict) and msg.get("type") == "ping":
                await hub.send(ws, "pong", {})
    except WebSocketDisconnect:
        pass
    except Exception as exc:  # noqa: BLE001 - a dead socket must never take the hub down
        log.debug("ws closed: %s", exc)
    finally:
        hub.disconnect(ws)
