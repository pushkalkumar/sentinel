"""Simulator proxy and sim-state cache (CONTRACT §3.7, §3.9 sim-state). /api/health lives in main.py."""
from __future__ import annotations

import logging
import time
from typing import Any

import httpx
from fastapi import APIRouter, Body, Depends

from app import ws
from app.config import settings
from sqlalchemy import delete, select

from app.deps import Principal, SessionDep, require_roles, require_sim_key
from app.envelope import ApiError, ok
from app.models import Alert, DecisionLog, NodeEval, Reading, SmsLog
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


async def rewind_history(session, sim_ts: str) -> None:
    """A backward jump rewrites the day: drop everything the engine derived after the new sim time.

    Readings are idempotent on (node_id, ts), so without this the replayed ticks are all
    counted as duplicates and the engine never sees the fire again.
    """
    doomed = (await session.execute(select(Alert.id).where(Alert.started_at > sim_ts))).scalars().all()
    if doomed:
        await session.execute(delete(SmsLog).where(SmsLog.alert_id.in_(doomed)))
        await session.execute(delete(Alert).where(Alert.id.in_(doomed)))
    await session.execute(delete(Reading).where(Reading.ts > sim_ts))
    await session.execute(delete(NodeEval).where(NodeEval.sim_ts > sim_ts))
    await session.execute(delete(DecisionLog).where(DecisionLog.changed_at > sim_ts))
    await session.commit()
    for node_id, ring in list(state.rings.items()):
        kept = [r for r in ring if r.get("ts", "") <= sim_ts]
        ring.clear()
        ring.extend(kept)
        if kept:
            state.latest[node_id] = kept[-1]
        else:
            state.latest.pop(node_id, None)
    state.last_eval.clear()
    state.site_band.clear()          # decision.py restores it lazily from decision_log
    state.pending_all_clear.clear()
    log.info("rewound history to %s (%d alerts dropped)", sim_ts, len(doomed))


@router.post("/sim/control")
async def sim_control(session: SessionDep, body: dict = Body(...),
                      _principal: Principal = Depends(require_roles("admin", "responder"))) -> dict:
    before = (state.sim_state or {}).get("sim_ts")
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
        if body.get("action") == "jump" and before and data.get("sim_ts") and data["sim_ts"] < before:
            await rewind_history(session, data["sim_ts"])
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
