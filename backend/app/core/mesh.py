"""Mesh log (CONTRACT §3.7, §3.9 mesh-message, §7.3 relay)."""
from __future__ import annotations

import logging
from typing import Literal, Optional

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ws
from app.config import settings
from app.deps import Principal, SessionDep, require_roles, require_sim_key
from app.envelope import ok
from app.models import Incident, MeshLog, Node

log = logging.getLogger("sentinel.mesh")

router = APIRouter()

SIM_TIMEOUT_S = 2.0


class HopBody(BaseModel):
    from_: str = Field(alias="from")
    to: str
    attempt: int = 1
    status: Literal["ok", "dropped", "retry", "delivered", "failed"]

    model_config = {"populate_by_name": True}


class MeshMessageBody(BaseModel):
    msg_id: str = Field(max_length=16)
    origin_node: str
    kind: str = "incident"
    payload: dict = Field(default_factory=dict)
    path: list[str] = Field(default_factory=list)
    hop: HopBody
    ttl: int = 0
    delivered: bool = False
    dropped_at: Optional[str] = None


def mesh_entry_to_dict(row: MeshLog) -> dict:
    return {
        "id": row.id, "msg_id": row.msg_id, "origin_node": row.origin_node, "kind": row.kind,
        "hop_from": row.hop_from, "hop_to": row.hop_to, "attempt": row.attempt, "status": row.status,
        "path": list(row.path or []), "ttl": row.ttl, "payload": row.payload or {}, "ts": row.ts,
    }


async def incident_mesh(session: AsyncSession, code: str) -> dict | None:
    """Incident.mesh (CONTRACT §3.1) derived from mesh_log; the Incident table has no mesh column."""
    row = (await session.execute(
        select(MeshLog)
        .where(MeshLog.kind == "incident", MeshLog.payload["code"].as_string() == code)
        .order_by(MeshLog.id.desc()).limit(1)
    )).scalar_one_or_none()
    if row is None:
        return None
    path = list(row.path or [])
    return {"msg_id": row.msg_id, "path": path, "delivered": row.status == "delivered",
            "hops": max(len(path) - 1, 0) if path else 0}


async def relay_to_sim(msg_id: str, origin_node: str, kind: str, payload: dict) -> None:
    """POST /relay to the simulator (CONTRACT §7.3). Fire-and-forget; failures are swallowed."""
    body = {"msg_id": msg_id, "origin_node": origin_node, "kind": kind, "payload": payload}
    try:
        async with httpx.AsyncClient(timeout=SIM_TIMEOUT_S) as client:
            await client.post(f"{settings.sim_url}/relay", json=body)
    except Exception as exc:  # noqa: BLE001 - simulator down must not affect the incident
        log.warning("relay_to_sim %s failed: %s", msg_id, exc)


async def _gateway_label(session: AsyncSession, node_id: str) -> str:
    node = await session.get(Node, node_id)
    return node.label if node else node_id


async def _attach_relay_event(session: AsyncSession, body: MeshMessageBody) -> None:
    from app.core.incidents import append_incident_event
    code = (body.payload or {}).get("code")
    if not code:
        return
    inc = (await session.execute(select(Incident).where(Incident.code == code))).scalar_one_or_none()
    if inc is None:
        return
    if body.delivered or body.hop.status == "delivered":
        path = body.path or [body.origin_node]
        hops = max(len(path) - 1, 0)
        gateway = path[-1] if path else body.hop.to
        note = f"Delivered to {gateway} via {hops} hop{'s' if hops != 1 else ''}: {' → '.join(path)}"
    elif body.hop.status == "failed":
        note = (f"Mesh delivery failed at {body.hop.from_}→{body.hop.to}; "
                "incident already stored at edge server")
    else:
        return
    await append_incident_event(session, inc, action="relayed", note=note, actor=None, actor_role="system", ip="")


@router.post("/ingest/mesh-message")
async def ingest_mesh_message(body: MeshMessageBody, session: SessionDep, _key: str = Depends(require_sim_key)) -> dict:
    row = MeshLog(
        msg_id=body.msg_id, origin_node=body.origin_node, kind=body.kind,
        hop_from=body.hop.from_, hop_to=body.hop.to, attempt=body.hop.attempt, status=body.hop.status,
        path=list(body.path), ttl=body.ttl, payload=body.payload or {},
    )
    session.add(row)
    await session.commit()
    await session.refresh(row)
    await ws.hub.broadcast("hop", mesh_entry_to_dict(row))
    if body.kind == "incident":
        await _attach_relay_event(session, body)
    return ok({"logged": True})


@router.get("/mesh/log")
async def mesh_log(
    session: SessionDep,
    _principal: Principal = Depends(require_roles()),
    limit: int = Query(100, ge=1, le=1000),
    msg_id: str | None = Query(None),
) -> dict:
    stmt = select(MeshLog).order_by(MeshLog.id.desc()).limit(limit)
    if msg_id:
        stmt = stmt.where(MeshLog.msg_id == msg_id)
    rows = (await session.execute(stmt)).scalars().all()
    return ok({"entries": [mesh_entry_to_dict(r) for r in rows]})
