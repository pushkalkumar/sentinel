"""Incidents (CONTRACT §3.6): civilian report, status lookup, responder queue, events, audit."""
from __future__ import annotations

import asyncio
import logging
import secrets
from typing import Literal, Optional

from fastapi import APIRouter, Depends, Header, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import ws
from app.core import mesh as mesh_mod
from app.core.nodes import latest_reading, open_alerts_for
from app.core.trust import new_code, normalise_code, score_incident
from app.deps import (CurrentUser, Principal, SessionDep, client_ip, device_fp, node_id_header, require_roles,
                      same_tenant_or_responder)
from app.envelope import ApiError, ok
from app.models import DeviceHistory, Incident, IncidentEvent, Node, Site, User
from app.state import state
from app.timefmt import iso_plus, now_iso

log = logging.getLogger("sentinel.incidents")

router = APIRouter()

IncidentType = Literal["fire", "trapped", "medical", "water", "other", "safe"]
PRIORITY: dict[str, int] = {"fire": 1, "trapped": 1, "medical": 2, "water": 3, "other": 4, "safe": 5}
OPEN_STATUSES = ("received", "acknowledged", "en_route")
ALL_STATUSES = ("received", "acknowledged", "en_route", "resolved", "false", "queued")

DEFAULT_TENANT_ID = 1
BLOCK_AT_FALSE_FLAGS = 3
RATE_LIMIT_PER_HOUR = 3
FLOOD_GUARD_COUNT = 20
FLOOD_WINDOW_S = 600
CROWD_WINDOW_S = 600
CODE_REUSE_WINDOW_S = 30 * 86400
MAX_TEXT = 280

TRANSITIONS: dict[str, set[str]] = {
    "acknowledge": {"received"},
    "en_route": {"received", "acknowledged"},
    "resolve": {"received", "acknowledged", "en_route"},
    "flag_false": {"received", "acknowledged", "en_route", "queued"},
    "message": {"received", "acknowledged", "en_route", "resolved", "queued"},
}
NEXT_STATUS: dict[str, str] = {
    "acknowledge": "acknowledged", "en_route": "en_route", "resolve": "resolved", "flag_false": "false",
}


class IncidentBody(BaseModel):
    type: IncidentType
    count: int = Field(1, ge=1, le=500)
    text: str = Field("", max_length=MAX_TEXT)
    lat: Optional[float] = Field(None, ge=-90, le=90)
    lng: Optional[float] = Field(None, ge=-180, le=180)


class EventBody(BaseModel):
    action: Literal["acknowledge", "en_route", "resolve", "flag_false", "message"]
    note: str = Field("", max_length=MAX_TEXT)


# ---------------------------------------------------------------- serialisation

def event_to_dict(ev: IncidentEvent, actor_name: str | None) -> dict:
    return {
        "id": ev.id, "action": ev.action, "actor_role": ev.actor_role, "actor_user_id": ev.actor_user_id,
        "actor_name": actor_name, "note": ev.note, "at": ev.at, "ip": ev.ip,
    }


async def _actor_names(session: AsyncSession, events: list[IncidentEvent]) -> dict[int, str]:
    ids = {ev.actor_user_id for ev in events if ev.actor_user_id is not None}
    if not ids:
        return {}
    rows = (await session.execute(select(User.id, User.name).where(User.id.in_(ids)))).all()
    return {uid: name for uid, name in rows}


async def _events_for(session: AsyncSession, inc: Incident) -> list[IncidentEvent]:
    rows = (await session.execute(
        select(IncidentEvent).where(IncidentEvent.incident_id == inc.id).order_by(IncidentEvent.id)
    )).scalars().all()
    return list(rows)


async def incident_to_dict(session: AsyncSession, inc: Incident) -> dict:
    """Incident (full) shape from CONTRACT §3.1."""
    node = await session.get(Node, inc.node_id) if inc.node_id else None
    events = await _events_for(session, inc)
    names = await _actor_names(session, events)
    return {
        "code": inc.code, "tenant_id": inc.tenant_id, "site_id": inc.site_id,
        "node_id": inc.node_id, "node_label": node.label if node else None,
        "via": inc.via, "type": inc.type, "count": inc.count, "text": inc.text,
        "lat": inc.lat, "lng": inc.lng,
        "reporter_role": inc.reporter_role, "priority": inc.priority,
        "trust_score": inc.trust_score, "trust_label": inc.trust_label,
        "trust_breakdown": list(inc.trust_breakdown or []),
        "status": inc.status, "created_at": inc.created_at, "updated_at": inc.updated_at,
        "sim_at": inc.sim_at,
        "mesh": await mesh_mod.incident_mesh(session, inc.code),
        "events": [event_to_dict(ev, names.get(ev.actor_user_id)) for ev in events],
    }


def _public_note(ev: IncidentEvent) -> str:
    if ev.action == "created":
        return "Report received"
    if ev.action == "relayed":
        if ev.note.startswith("Mesh delivery failed"):
            return "Mesh relay failed; report is stored at the edge server"
        hops = ev.note.split(" via ", 1)[1].split(":", 1)[0] if " via " in ev.note else "the mesh"
        return f"Reached gateway via {hops}"
    if ev.action == "acknowledge":
        return "Acknowledged by responder"
    if ev.action == "en_route":
        return "Responder en route" + (f": {ev.note}" if ev.note else "")
    if ev.action == "resolve":
        return "Marked resolved by responder"
    if ev.action == "flag_false":
        return "Report closed"
    return ev.note


async def incident_to_public(session: AsyncSession, inc: Incident) -> dict:
    """IncidentPublic shape (CONTRACT §3.1): no device_fp, no IPs, no breakdown."""
    node = await session.get(Node, inc.node_id) if inc.node_id else None
    events = await _events_for(session, inc)
    return {
        "code": inc.code, "type": inc.type, "count": inc.count, "status": inc.status,
        "node_label": node.label if node else None, "trust_label": inc.trust_label,
        "created_at": inc.created_at, "updated_at": inc.updated_at,
        "timeline": [{"action": ev.action, "at": ev.at, "note": _public_note(ev)} for ev in events],
    }


async def append_incident_event(
    session: AsyncSession,
    inc: Incident,
    *,
    action: str,
    note: str,
    actor: Principal | None,
    actor_role: str,
    ip: str,
) -> IncidentEvent:
    """Append an incident_events row and broadcast `incident_event`."""
    ev = IncidentEvent(
        incident_id=inc.id, actor_user_id=actor.uid if actor else None, actor_role=actor_role,
        action=action, note=note, ip=ip, at=now_iso(),
    )
    inc.updated_at = ev.at
    session.add(ev)
    session.add(inc)
    await session.commit()
    await session.refresh(ev)
    await session.refresh(inc)
    actor_name = actor.name if actor and actor.name else None
    if actor and not actor_name:
        user = await session.get(User, actor.uid)
        actor_name = user.name if user else None
    full = await incident_to_dict(session, inc)
    await ws.hub.broadcast("incident_event", {
        "code": inc.code, "status": inc.status, "event": event_to_dict(ev, actor_name), "incident": full,
    })
    return ev


# ---------------------------------------------------------------- helpers

async def _get_incident(session: AsyncSession, raw_code: str) -> Incident:
    code = normalise_code(raw_code)
    inc = (await session.execute(select(Incident).where(Incident.code == code))).scalar_one_or_none()
    if inc is None:
        raise ApiError("NOT_FOUND", f"incident {code} not found")
    return inc


async def _tenant_for_node(session: AsyncSession, node: Node | None) -> int:
    if node is None:
        return DEFAULT_TENANT_ID
    site = await session.get(Site, node.site_id)
    return site.tenant_id if site else DEFAULT_TENANT_ID


async def _false_flags(session: AsyncSession, fp: str, tenant_id: int) -> int:
    row = await session.get(DeviceHistory, (fp, tenant_id))
    return row.false_flags if row else 0


async def _open_count_last_hour(session: AsyncSession, fp: str) -> int:
    since = iso_plus(now_iso(), -3600)
    return (await session.execute(
        select(func.count()).select_from(Incident).where(
            Incident.device_fp == fp, Incident.created_at >= since, Incident.status.not_in(("resolved", "false")),
        )
    )).scalar_one()


async def _node_flood_count(session: AsyncSession, node_id: str) -> int:
    since = iso_plus(now_iso(), -FLOOD_WINDOW_S)
    return (await session.execute(
        select(func.count()).select_from(Incident).where(Incident.node_id == node_id, Incident.created_at >= since)
    )).scalar_one()


async def _crowd_devices(session: AsyncSession, node_id: str | None, incident_type: str, fp: str) -> int:
    if node_id is None:
        return 0
    since = iso_plus(now_iso(), -CROWD_WINDOW_S)
    return (await session.execute(
        select(func.count(func.distinct(Incident.device_fp))).where(
            Incident.node_id == node_id, Incident.type == incident_type, Incident.device_fp != fp,
            Incident.created_at >= since, Incident.status != "false",
        )
    )).scalar_one()


async def _recent_codes(session: AsyncSession, tenant_id: int) -> set[str]:
    since = iso_plus(now_iso(), -CODE_REUSE_WINDOW_S)
    rows = (await session.execute(
        select(Incident.code).where(Incident.tenant_id == tenant_id, Incident.created_at >= since)
    )).scalars().all()
    return set(rows)


def _history_for_trust(node_id: str | None) -> list:
    if node_id is None:
        return []
    return list(state.rings.get(node_id) or [])


# ---------------------------------------------------------------- routes

@router.post("/incidents", status_code=201)
async def create_incident(
    body: IncidentBody,
    session: SessionDep,
    principal: CurrentUser,
    fp: str = Depends(device_fp),
    node_id: str | None = Depends(node_id_header),
    ip: str = Depends(client_ip),
) -> dict:
    node = None
    if node_id is not None:
        node = await session.get(Node, node_id)
        if node is None:
            raise ApiError("VALIDATION_ERROR", f"unknown node '{node_id}'",
                           [{"loc": ["header", "X-Node-Id"], "msg": "unknown node slug"}])
    via = "node" if node is not None else "internet"
    tenant_id = await _tenant_for_node(session, node)

    false_flags = await _false_flags(session, fp, tenant_id)
    if false_flags >= BLOCK_AT_FALSE_FLAGS:
        raise ApiError("DEVICE_BLOCKED", "this device has been blocked after repeated false reports")
    if await _open_count_last_hour(session, fp) >= RATE_LIMIT_PER_HOUR:
        raise ApiError("RATE_LIMITED", "too many open reports from this device; wait for a responder")

    queued = node is not None and await _node_flood_count(session, node.id) >= FLOOD_GUARD_COUNT

    reporter_role = principal.role if principal else None
    latest = await latest_reading(session, node.id) if node else None
    open_alerts = await open_alerts_for(session, node.id) if node else []
    crowd = await _crowd_devices(session, node.id if node else None, body.type, fp)
    score, label, breakdown = score_incident(
        node=node, latest=latest, history=_history_for_trust(node.id if node else None),
        open_alerts=open_alerts, crowd_devices=crowd, reporter_role=reporter_role,
        lat=body.lat, lng=body.lng, false_flags=false_flags, incident_type=body.type,
    )

    code = new_code(await _recent_codes(session, tenant_id))
    created_at = now_iso()
    inc = Incident(
        code=code, tenant_id=tenant_id, site_id=node.site_id if node else None,
        node_id=node.id if node else None, via=via, type=body.type, count=body.count, text=body.text,
        lat=body.lat, lng=body.lng, device_fp=fp, reporter_role=reporter_role,
        trust_score=score, trust_label=label, trust_breakdown=breakdown, priority=PRIORITY[body.type],
        status="queued" if queued else "received", created_at=created_at, updated_at=created_at,
        sim_at=state.sim_state["sim_ts"] if state.sim_state else None,
    )
    session.add(inc)
    await session.flush()
    where = f"via node {node.id}" if node else "via internet"
    session.add(IncidentEvent(
        incident_id=inc.id, actor_user_id=principal.uid if principal else None,
        actor_role=reporter_role or "civilian", action="created",
        note=f"{body.type} ×{body.count} {where}", ip=ip, at=created_at,
    ))
    await session.commit()
    await session.refresh(inc)

    if not queued:
        await ws.hub.broadcast("incident_created", await incident_to_dict(session, inc))
        if via == "node":
            msg_id = "m-" + secrets.token_hex(4)
            asyncio.create_task(mesh_mod.relay_to_sim(
                msg_id, node.id, "incident", {"code": code, "type": body.type, "count": body.count},
            ))

    return ok({
        "code": code, "status": inc.status, "trust_score": score, "trust_label": label,
        "node_id": node.id if node else None, "node_label": node.label if node else None, "via": via,
        "created_at": created_at,
        "message": f"Help is being routed. Your code is {code}. Write it on your hand.",
    })


@router.get("/incidents/{code}")
async def get_incident(code: str, session: SessionDep, principal: CurrentUser,
                       x_device_fp: str | None = Header(None, alias="X-Device-Fp")) -> dict:
    if principal is not None and principal.role in ("admin", "responder"):
        inc = await _get_incident(session, code)
        same_tenant_or_responder(principal, inc.tenant_id)
        return ok(await incident_to_dict(session, inc))
    if not x_device_fp or not x_device_fp.strip():
        raise ApiError("MISSING_DEVICE_FP", "X-Device-Fp header is required")
    inc = await _get_incident(session, code)
    return ok(await incident_to_public(session, inc))


@router.get("/incidents")
async def list_incidents(
    session: SessionDep,
    principal: Principal = Depends(require_roles("admin", "responder")),
    status: str = Query("open"),
    sort: Literal["priority", "newest", "trust"] = Query("priority"),
    site_id: int | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
) -> dict:
    return ok(await _list(session, principal, status=status, sort=sort, site_id=site_id, limit=limit))


async def _list(session: AsyncSession, principal: Principal, *, status: str, sort: str,
                site_id: int | None, limit: int) -> dict:
    stmt = select(Incident)
    if status == "open":
        stmt = stmt.where(Incident.status.in_(OPEN_STATUSES))
    elif status == "all":
        stmt = stmt.where(Incident.status != "queued")
    elif status in ALL_STATUSES:
        stmt = stmt.where(Incident.status == status)
    else:
        raise ApiError("VALIDATION_ERROR", f"unknown status filter '{status}'")
    if principal.role != "responder":
        stmt = stmt.where(Incident.tenant_id == principal.tenant_id)
    if site_id is not None:
        stmt = stmt.where(Incident.site_id == site_id)
    if sort == "newest":
        stmt = stmt.order_by(Incident.created_at.desc())
    elif sort == "trust":
        stmt = stmt.order_by(Incident.trust_score.desc(), Incident.created_at.desc())
    else:
        stmt = stmt.order_by(Incident.priority.asc(), Incident.trust_score.desc(), Incident.created_at.desc())
    rows = (await session.execute(stmt.limit(limit))).scalars().all()
    incidents = [await incident_to_dict(session, inc) for inc in rows]
    return {"count": len(incidents), "incidents": incidents}


@router.get("/responder/incidents")
async def responder_incidents(
    session: SessionDep,
    principal: Principal = Depends(require_roles("admin", "responder")),
    bbox: str | None = Query(None),
    limit: int = Query(200, ge=1, le=1000),
) -> dict:
    return ok(await _list(session, principal, status="open", sort="priority", site_id=None, limit=limit))


async def _bump_false_flags(session: AsyncSession, inc: Incident) -> None:
    row = await session.get(DeviceHistory, (inc.device_fp, inc.tenant_id))
    if row is None:
        row = DeviceHistory(device_fp=inc.device_fp, tenant_id=inc.tenant_id, false_flags=0)
        session.add(row)
    row.false_flags += 1
    if row.false_flags >= BLOCK_AT_FALSE_FLAGS and not row.blocked_at:
        row.blocked_at = now_iso()


@router.post("/incidents/{code}/events")
async def post_incident_event(
    code: str,
    body: EventBody,
    session: SessionDep,
    principal: Principal = Depends(require_roles("admin", "responder")),
    ip: str = Depends(client_ip),
) -> dict:
    inc = await _get_incident(session, code)
    same_tenant_or_responder(principal, inc.tenant_id)
    if principal.role == "admin" and body.action != "message":
        raise ApiError("FORBIDDEN", "admins may only send messages; responders act on incidents")

    note = body.note.strip()
    if body.action in ("resolve", "flag_false") and len(note) < 3:
        raise ApiError("VALIDATION_ERROR", f"'{body.action}' needs a note of at least 3 characters")
    if body.action == "message" and not note:
        raise ApiError("VALIDATION_ERROR", "a message needs text")
    if inc.status not in TRANSITIONS[body.action]:
        raise ApiError("INVALID_TRANSITION", f"cannot {body.action} an incident that is {inc.status}")

    if body.action in NEXT_STATUS:
        inc.status = NEXT_STATUS[body.action]
    if body.action == "flag_false":
        await _bump_false_flags(session, inc)
    await append_incident_event(session, inc, action=body.action, note=note, actor=principal,
                                actor_role=principal.role, ip=ip)
    return ok(await incident_to_dict(session, inc))


@router.get("/responder/audit")
async def responder_audit(
    session: SessionDep,
    principal: Principal = Depends(require_roles("admin", "responder")),
    limit: int = Query(200, ge=1, le=2000),
) -> dict:
    stmt = (
        select(IncidentEvent, Incident.code, User.name)
        .join(Incident, Incident.id == IncidentEvent.incident_id)
        .outerjoin(User, User.id == IncidentEvent.actor_user_id)
        .order_by(IncidentEvent.id.desc()).limit(limit)
    )
    if principal.role != "responder":
        stmt = stmt.where(Incident.tenant_id == principal.tenant_id)
    rows = (await session.execute(stmt)).all()
    return ok({"events": [
        {"id": ev.id, "at": ev.at, "incident_code": code, "action": ev.action, "actor_name": name,
         "actor_role": ev.actor_role, "ip": ev.ip, "note": ev.note}
        for ev, code, name in rows
    ]})
