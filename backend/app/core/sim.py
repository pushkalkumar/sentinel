"""Simulator proxy and sim-state cache (CONTRACT §3.7, §3.9 sim-state). /api/health lives in main.py."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends

from app import ws
from app.config import settings
from app.deps import Principal, require_roles, require_sim_key
from app.envelope import ApiError, ok
from app.state import state

log = logging.getLogger("sentinel.sim")

router = APIRouter()

SIM_TIMEOUT_S = 2.0


def _unwrap(payload: Any) -> Any:
    """Simulator answers use the same envelope; return the bare data."""
    if isinstance(payload, dict) and "ok" in payload and "data" in payload:
        if not payload.get("ok"):
            err = payload.get("error") or {}
            raise ApiError(err.get("code") or "VALIDATION_ERROR", err.get("message") or "simulator rejected the action",
                           err.get("details"))
        return payload["data"]
    return payload


def cache_sim_state(sim_state: dict) -> None:
    state.sim_state = dict(sim_state)
    state.sim_last_push_wall = time.time()


@router.post("/sim/control")
async def sim_control(body: dict = Body(...), _principal: Principal = Depends(require_roles("admin", "responder"))) -> dict:
    try:
        async with httpx.AsyncClient(timeout=SIM_TIMEOUT_S) as client:
            res = await client.post(f"{settings.sim_url}/control", json=body)
    except httpx.HTTPError as exc:
        log.warning("sim control failed: %s", exc)
        raise ApiError("SIM_UNAVAILABLE", "simulator is not reachable on :8001")
    try:
        payload = res.json()
    except ValueError:
        raise ApiError("SIM_UNAVAILABLE", "simulator returned a non-JSON response")
    data = _unwrap(payload)
    if isinstance(data, dict) and "sim_t" in data:
        cache_sim_state(data)
        await ws.hub.broadcast("sim_state", ws.sim_state_for_clients() or data)
    return ok(data)


@router.get("/sim/state")
async def sim_state() -> dict:
    cached = ws.sim_state_for_clients()
    if cached is not None:
        return ok(cached)
    try:
        async with httpx.AsyncClient(timeout=SIM_TIMEOUT_S) as client:
            res = await client.get(f"{settings.sim_url}/state")
        data = _unwrap(res.json())
    except (httpx.HTTPError, ValueError, ApiError):
        return ok({"connected": False})
    if isinstance(data, dict) and "sim_t" in data:
        cache_sim_state(data)
        return ok({**data, "connected": True})
    return ok({"connected": False})


@router.post("/ingest/sim-state")
async def ingest_sim_state(body: dict = Body(...), _key: str = Depends(require_sim_key)) -> dict:
    cache_sim_state(body)
    await ws.hub.broadcast("sim_state", ws.sim_state_for_clients() or body)
    return ok({"cached": True})
