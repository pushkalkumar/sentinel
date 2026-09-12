"""Scripted demo runner behind the /demo page.

Seven ordered chapters replay the stage script (docs/DEMO_SCRIPT.md) server-side so nobody has to
click through admin, a judge phone, the responder console and six teacher phones by hand. Every
chapter drives the same helpers the real UI uses (sim proxy, incident routes, drill routes), so the
normal WS events fire and every other screen reacts as if a person did it.

Chapters are idempotent: re-running one reuses what already exists (open drill, open incident from the
demo phone, a fire already burning) instead of stacking duplicates. `reset` returns to calm and removes
the rows the demo created, leaving the seed untouched.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts import decision
from app.core import incidents as incidents_mod
from app.core import sim as sim_mod
from app.db import SessionLocal
from app.deps import Principal, SessionDep, require_roles
from app.drills import routes as drill_routes
from app.drills import service as drill_service
from app.envelope import ApiError, ok
from app.models import Alert, DeviceHistory, Drill, Incident, MeshLog, Rollcall, SchoolClass, User
from app.state import state
from app.timefmt import parse_iso

log = logging.getLogger("sentinel.demo")

router = APIRouter()

SITE_ID = 1
ADMIN_UID = 1
RESPONDER_UID = 2
FIRE_NODE = "gym"
DEVICE_FP = "demo-judge-phone"
DEMO_IP = "10.42.0.23"            # the judge phone's hotspot address in the audit log
REPORT = {"type": "trapped", "count": 2, "text": "Gym storage room, door jammed"}
EN_ROUTE_NOTE = "Engine 17 on scene in 4 min, crew 3 entering from the south door"
RESOLVE_NOTE = "Crew 3 walked both out"
RESET_NOTE = "Demo reset"

# Submission order matters for the story: the clean classes report first, the one with two missing last.
# (class name, missing student refs). 4 complete, 1 with one missing, 1 with two missing.
ROLLCALL_PLAN: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("4A", ()),
    ("3A", ()),
    ("5B", ()),
    ("4B", ()),
    ("5A", ("S-5A-12",)),
    ("3B", ("S-3B-07", "S-3B-19")),
)
ALL_CLEAR_ACTIONS = ("acknowledge", "en_route", "resolve")

# Pacing: wall seconds between paced actions so WS-driven screens animate instead of snapping.
# Waits are upper bounds; a chapter never fails because the engine was slow, it reports what it saw.
PACE_S = 1.2
POLL_S = 0.25
FIRE_WAIT_S = 15.0
CARD_WAIT_S = 10.0
RELAY_WAIT_S = 8.0
CLEAR_WAIT_S = 12.0
HISTORY_WAIT_S = 12.0
CANCEL_BANDS = ("unhealthy", "very_unhealthy", "hazardous")
# The engine reads pm_rise against the reading 5 min back and temp_rise against 2 min back, and the sim's fire
# ramps in 60 s. Lit within a few sim minutes of a jump the fire has no "before" to rise from and the engine sees a
# smoke suspect at best, so the fire chapter waits for this much continuous history at the gym first (5.5 s at 60x).
PRE_FIRE_HISTORY_S = 330
HISTORY_GAP_S = 600
BAND_ALERT_KIND = "ACTIVITY_ADVISORY"     # follows the sky, not the overrides: all-clear does not wait for it

CHAPTERS: tuple[dict, ...] = (
    {"id": "calm", "title": "A normal morning",
     "caption": "07:30 at Roosevelt High. Eight nodes, all green, practice is on. Every emergency app assumes "
                "the internet exists; Sentinel doesn't.",
     "duration_s": 8},
    {"id": "smoke", "title": "Smoke afternoon",
     "caption": "Jump to 13:55. Every node climbs together. That's the sky, not the building, so the card cancels "
                "practice and nothing else happens.",
     "duration_s": 12},
    {"id": "fire", "title": "One node spikes",
     "caption": "Fire in the gym. One node climbing while its neighbours stay flat is a fire in that aisle. "
                "LOCAL_FIRE opens, the alarm hops gym to science to hub.",
     "duration_s": 12},
    {"id": "report", "title": "A judge reports from the gym",
     "caption": "A phone on the gym node's own WiFi sends: trapped, two people, storage room, door jammed. Trust "
                "score verified because proximity and the sensor agree. The report relays to the hub.",
     "duration_s": 12},
    {"id": "responder", "title": "Responder closes the loop",
     "caption": "Lt. Reyes acknowledges, goes en route with a note, then resolves: crew 3 walked both out. "
                "Every action lands in the audit log with an IP, and the phone's receipt updates live.",
     "duration_s": 10},
    {"id": "drill", "title": "Fire drill roll call",
     "caption": "A sentinel that only wakes up for the disaster is asleep when it matters. Six classes muster; "
                "four report complete, 5A has one missing, 3B has two.",
     "duration_s": 14},
    {"id": "allclear", "title": "All clear",
     "caption": "Overrides clear, the gym's readings decay and the engine closes the fire alert itself a few "
                "minutes later. The practice advisory stays as long as the sky does. Nothing here needed the internet.",
     "duration_s": 8},
)
CHAPTER_IDS = tuple(c["id"] for c in CHAPTERS)

_demo_drill_ids: set[int] = set()        # drills this process created; reset deletes these plus signature matches


class ChapterBody(BaseModel):
    id: str


# ---------------------------------------------------------------- principals

async def _principal_for(session: AsyncSession, uid: int) -> Principal:
    user = await session.get(User, uid)
    if user is None:
        raise ApiError("NOT_FOUND", f"seed user {uid} is missing; reseed the database")
    cls = (await session.execute(
        select(SchoolClass).where(SchoolClass.teacher_user_id == uid)
    )).scalar_one_or_none()
    return Principal(uid=user.id, role=user.role, tenant_id=user.tenant_id,
                     site_id=cls.site_id if cls else SITE_ID, class_id=cls.id if cls else None, name=user.name)


# ---------------------------------------------------------------- sim

def _cached_sim() -> dict | None:
    return state.sim_state


async def _sim(session: AsyncSession, principal: Principal, body: dict) -> dict:
    """Drive the simulator through the same proxy the admin page uses (rewind, cache, WS broadcast included)."""
    return (await sim_mod.sim_control(session, body, principal))["data"]


def _fire_burning(node_id: str) -> bool:
    sim = _cached_sim() or {}
    return node_id in ((sim.get("overrides") or {}).get("fire_nodes") or [])


def _overrides_active() -> bool:
    sim = _cached_sim() or {}
    overrides = sim.get("overrides") or {}
    return bool(overrides.get("fire_nodes")) or bool(overrides.get("smoke_boost"))


def _history_span_s(node_id: str) -> float:
    """Sim seconds of unbroken recent history at the node: newest reading back to the oldest within HISTORY_GAP_S.
    A forward jump leaves the morning's readings in the ring hours behind the new clock; they do not count."""
    ring = state.rings.get(node_id)
    if not ring:
        return 0.0
    stamps = [parse_iso(r["ts"]).timestamp() for r in ring]
    newest = max(stamps)
    return newest - min(t for t in stamps if newest - t <= HISTORY_GAP_S)


async def _sim_calm(session: AsyncSession, principal: Principal) -> dict:
    """Jump to 07:30 (clears every override and rewinds engine history), 60x, playing."""
    await _sim(session, principal, {"action": "jump", "t": "calm"})
    await _sim(session, principal, {"action": "speed", "speed": 60})
    return await _sim(session, principal, {"action": "play"})


# ---------------------------------------------------------------- waits

async def _wait_for(predicate: Callable[[AsyncSession], Awaitable[bool]], timeout_s: float) -> bool:
    """Poll `predicate` with a fresh short-lived session until it holds or `timeout_s` passes."""
    loop = asyncio.get_running_loop()
    deadline = loop.time() + timeout_s
    while True:
        async with SessionLocal() as session:
            if await predicate(session):
                return True
        if loop.time() >= deadline:
            return False
        await asyncio.sleep(POLL_S)


async def _open_fire_alert(session: AsyncSession) -> Alert | None:
    return (await session.execute(
        select(Alert).where(Alert.node_id == FIRE_NODE, Alert.kind == "LOCAL_FIRE", Alert.cleared_at.is_(None))
        .order_by(Alert.id.desc()).limit(1)
    )).scalar_one_or_none()


async def _open_site_alerts(session: AsyncSession) -> list[Alert]:
    rows = (await session.execute(
        select(Alert).where(Alert.site_id == SITE_ID, Alert.cleared_at.is_(None)).order_by(Alert.priority, Alert.id)
    )).scalars().all()
    return list(rows)


async def _open_node_alerts(session: AsyncSession) -> list[Alert]:
    """Fire, hazardous smoke and smoke-suspect alerts: the ones the overrides cause and the clear removes."""
    return [a for a in await _open_site_alerts(session) if a.kind != BAND_ALERT_KIND]


# ---------------------------------------------------------------- incidents

async def _demo_incident(session: AsyncSession, *, open_only: bool) -> Incident | None:
    stmt = select(Incident).where(Incident.device_fp == DEVICE_FP)
    if open_only:
        stmt = stmt.where(Incident.status.in_(incidents_mod.OPEN_STATUSES))
    return (await session.execute(stmt.order_by(Incident.id.desc()).limit(1))).scalar_one_or_none()


async def _incident_event(session: AsyncSession, code: str, action: str, note: str) -> dict:
    responder = await _principal_for(session, RESPONDER_UID)
    body = incidents_mod.EventBody(action=action, note=note)
    return (await incidents_mod.post_incident_event(code, body, session, responder, DEMO_IP))["data"]


async def _resolve_demo_incident(session: AsyncSession, note: str) -> str | None:
    inc = await _demo_incident(session, open_only=True)
    if inc is None or inc.status not in incidents_mod.TRANSITIONS["resolve"]:
        return None
    await _incident_event(session, inc.code, "resolve", note)
    return inc.code


async def _ensure_report(session: AsyncSession) -> tuple[Incident, bool]:
    """The judge's report from the gym; reused when one is already open. Returns (incident, created)."""
    existing = await _demo_incident(session, open_only=True)
    if existing is not None:
        return existing, False
    body = incidents_mod.IncidentBody(**REPORT)
    created = (await incidents_mod.create_incident(body, session, None, DEVICE_FP, FIRE_NODE, DEMO_IP))["data"]
    inc = (await session.execute(select(Incident).where(Incident.code == created["code"]))).scalar_one()
    return inc, True


# ---------------------------------------------------------------- drills

async def _rollcall_plan(session: AsyncSession) -> list[tuple[SchoolClass, int, list[str]]]:
    """(class, present, missing_refs) in submission order, sized from the live roster."""
    classes = {cls.name: (cls, size) for cls, _teacher, size in await drill_service.site_classes(session, SITE_ID)}
    plan = []
    for name, missing in ROLLCALL_PLAN:
        if name not in classes:
            raise ApiError("NOT_FOUND", f"class {name} is missing from the seed at site {SITE_ID}")
        cls, size = classes[name]
        plan.append((cls, size - len(missing), list(missing)))
    return plan


async def _end_open_drill(session: AsyncSession) -> int | None:
    drill = await drill_service.get_open_drill(session, SITE_ID)
    if drill is None:
        return None
    admin = await _principal_for(session, ADMIN_UID)
    await drill_routes.end_drill(drill.id, session, admin)
    return drill.id


async def _is_demo_drill(session: AsyncSession, drill: Drill) -> bool:
    """A drill this process started, or one whose roll calls exactly match the scripted outcomes."""
    if drill.id in _demo_drill_ids:
        return True
    if drill.site_id != SITE_ID or drill.kind != "fire" or drill.is_real or drill.started_by != ADMIN_UID:
        return False
    rollcalls = await drill_service.drill_rollcalls(session, drill.id)
    names = {cls.id: cls.name for cls, _t, _s in await drill_service.site_classes(session, SITE_ID)}
    seen = {names.get(class_id): tuple(rc.missing_refs or []) for class_id, rc in rollcalls.items()}
    return seen == {name: missing for name, missing in ROLLCALL_PLAN}


# ---------------------------------------------------------------- snapshot

def _sim_snapshot() -> dict | None:
    sim = _cached_sim()
    if sim is None:
        return None
    keys = ("connected", "playing", "speed", "sim_clock", "sim_ts", "phase", "regional_pm25", "overrides")
    return {k: sim.get(k) for k in keys}


async def _incident_snapshot(session: AsyncSession) -> dict | None:
    inc = await _demo_incident(session, open_only=False)
    if inc is None:
        return None
    full = await incidents_mod.incident_to_dict(session, inc)
    return {
        "code": full["code"], "status": full["status"], "type": full["type"], "count": full["count"],
        "text": full["text"], "trust_score": full["trust_score"], "trust_label": full["trust_label"],
        "node_label": full["node_label"], "mesh": full["mesh"],
        "events": [{"action": e["action"], "actor_name": e["actor_name"], "note": e["note"], "at": e["at"]}
                   for e in full["events"]],
    }


async def _drill_snapshot(session: AsyncSession) -> dict | None:
    drill = await drill_service.get_open_drill(session, SITE_ID)
    if drill is None:
        drill = (await session.execute(
            select(Drill).where(Drill.site_id == SITE_ID).order_by(Drill.id.desc()).limit(1)
        )).scalar_one_or_none()
    if drill is None:
        return None
    data = await drill_service.drill_to_dict(session, drill, full=False)
    return {k: data[k] for k in ("id", "kind", "started_at", "ended_at", "elapsed_s", "summary")}


async def snapshot(session: AsyncSession) -> dict:
    alerts = await _open_site_alerts(session)
    return {
        "sim": _sim_snapshot(),
        "band": await decision.current_band(session, SITE_ID),
        "alerts": [{"id": a.id, "kind": a.kind, "node_id": a.node_id, "priority": a.priority} for a in alerts],
        "incident": await _incident_snapshot(session),
        "drill": await _drill_snapshot(session),
    }


# ---------------------------------------------------------------- chapters

async def chapter_calm(session: AsyncSession, principal: Principal) -> dict:
    ended = await _end_open_drill(session)
    resolved = await _resolve_demo_incident(session, RESET_NOTE)
    await _sim_calm(session, principal)
    return {"drill_ended": ended, "incident_resolved": resolved}


async def chapter_smoke(session: AsyncSession, principal: Principal) -> dict:
    if _overrides_active():
        await _sim(session, principal, {"action": "clear"})
    await _sim(session, principal, {"action": "jump", "t": "smoke"})

    async def card_flipped(s: AsyncSession) -> bool:
        return await decision.current_band(s, SITE_ID) in CANCEL_BANDS

    flipped = await _wait_for(card_flipped, CARD_WAIT_S)
    return {"card_flipped": flipped}


async def chapter_fire(session: AsyncSession, principal: Principal) -> dict:
    triggered = False
    history_ready: bool | None = None          # None: nothing to wait for, the gym was already burning
    if not _fire_burning(FIRE_NODE):
        async def enough_history(_s: AsyncSession) -> bool:
            return _history_span_s(FIRE_NODE) >= PRE_FIRE_HISTORY_S

        history_ready = await _wait_for(enough_history, HISTORY_WAIT_S)
        if not history_ready:
            log.warning("fire chapter: only %.0fs of history at %s; the engine may call it a smoke suspect",
                        _history_span_s(FIRE_NODE), FIRE_NODE)
        await _sim(session, principal, {"action": "trigger_fire", "node_id": FIRE_NODE})
        triggered = True

    async def fire_open(s: AsyncSession) -> bool:
        return await _open_fire_alert(s) is not None

    seen = await _wait_for(fire_open, FIRE_WAIT_S)
    alert = await _open_fire_alert(session)
    return {"triggered": triggered, "history_ready": history_ready, "local_fire": seen,
            "alert_id": alert.id if alert else None}


async def chapter_report(session: AsyncSession, _principal: Principal) -> dict:
    inc, created = await _ensure_report(session)
    code = inc.code

    async def relayed(s: AsyncSession) -> bool:
        mesh = await incidents_mod.incident_to_dict(s, await incidents_mod._get_incident(s, code))
        return bool(mesh["mesh"] and mesh["mesh"]["delivered"])

    delivered = await _wait_for(relayed, RELAY_WAIT_S) if created else False
    await session.refresh(inc)
    return {"code": code, "created": created, "relayed": delivered,
            "trust_score": inc.trust_score, "trust_label": inc.trust_label}


async def chapter_responder(session: AsyncSession, _principal: Principal) -> dict:
    inc = await _demo_incident(session, open_only=False)
    if inc is None or inc.status not in incidents_mod.OPEN_STATUSES:
        inc, _ = await _ensure_report(session)
    notes = {"acknowledge": "", "en_route": EN_ROUTE_NOTE, "resolve": RESOLVE_NOTE}
    applied = []
    for action in ALL_CLEAR_ACTIONS:
        await session.refresh(inc)
        if inc.status not in incidents_mod.TRANSITIONS[action]:
            continue
        if applied:
            await asyncio.sleep(PACE_S)
        await _incident_event(session, inc.code, action, notes[action])
        applied.append(action)
    await session.refresh(inc)
    return {"code": inc.code, "applied": applied, "status": inc.status}


async def chapter_drill(session: AsyncSession, _principal: Principal) -> dict:
    admin = await _principal_for(session, ADMIN_UID)
    drill = await drill_service.get_open_drill(session, SITE_ID)
    created = drill is None
    if created:
        body = drill_routes.DrillCreate(site_id=SITE_ID, kind="fire")
        drill_id = (await drill_routes.create_drill(body, session, admin))["data"]["id"]
        drill = await drill_service.get_drill(session, drill_id)
    _demo_drill_ids.add(drill.id)

    for i, (cls, present, missing) in enumerate(await _rollcall_plan(session)):
        if i:
            await asyncio.sleep(PACE_S)
        teacher = await _principal_for(session, cls.teacher_user_id)
        body = drill_routes.RollcallBody(class_id=cls.id, node_id=cls.muster_node_id, present=present, missing_refs=missing)
        await drill_routes.submit_rollcall(drill.id, body, session, teacher)

    await asyncio.sleep(PACE_S)
    ended = (await drill_routes.end_drill(drill.id, session, admin))["data"]
    return {"drill_id": drill.id, "created": created, "summary": ended["summary"]}


async def chapter_allclear(session: AsyncSession, principal: Principal) -> dict:
    await _sim(session, principal, {"action": "clear"})

    async def node_alerts_closed(s: AsyncSession) -> bool:
        return not await _open_node_alerts(s)

    cleared = await _wait_for(node_alerts_closed, CLEAR_WAIT_S)
    advisory = any(a.kind == BAND_ALERT_KIND for a in await _open_site_alerts(session))
    return {"alerts_cleared": cleared, "advisory_open": advisory}


RUNNERS: dict[str, Callable[[AsyncSession, Principal], Awaitable[dict]]] = {
    "calm": chapter_calm,
    "smoke": chapter_smoke,
    "fire": chapter_fire,
    "report": chapter_report,
    "responder": chapter_responder,
    "drill": chapter_drill,
    "allclear": chapter_allclear,
}

# One chapter at a time: the demo page and a second tab double-clicking must not interleave sim jumps.
_run_lock = asyncio.Lock()


async def run_chapter(session: AsyncSession, principal: Principal, chapter_id: str) -> dict:
    runner = RUNNERS.get(chapter_id)
    if runner is None:
        raise ApiError("NOT_FOUND", f"unknown chapter '{chapter_id}'", {"chapters": list(CHAPTER_IDS)})
    async with _run_lock:
        log.info("demo chapter %s start (by %s)", chapter_id, principal.name or principal.uid)
        result = await runner(session, principal)
        log.info("demo chapter %s done: %s", chapter_id, result)
        return {"id": chapter_id, "result": result, "state_after": await snapshot(session)}


# ---------------------------------------------------------------- reset

async def _delete_demo_rows(session: AsyncSession) -> dict:
    incidents = (await session.execute(select(Incident).where(Incident.device_fp == DEVICE_FP))).scalars().all()
    codes = [inc.code for inc in incidents]
    for inc in incidents:
        await session.delete(inc)              # events follow via cascade
    if codes:
        await session.execute(delete(MeshLog).where(MeshLog.kind == "incident",
                                                    MeshLog.payload["code"].as_string().in_(codes)))
    await session.execute(delete(DeviceHistory).where(DeviceHistory.device_fp == DEVICE_FP))

    drills = (await session.execute(select(Drill).where(Drill.site_id == SITE_ID))).scalars().all()
    drill_ids = [d.id for d in drills if await _is_demo_drill(session, d)]
    if drill_ids:
        await session.execute(delete(Rollcall).where(Rollcall.drill_id.in_(drill_ids)))
        await session.execute(delete(Drill).where(Drill.id.in_(drill_ids)))
    await session.commit()
    _demo_drill_ids.difference_update(drill_ids)
    return {"incidents": codes, "drills": drill_ids}


async def reset(session: AsyncSession, principal: Principal) -> dict:
    async with _run_lock:
        ended = await _end_open_drill(session)
        deleted = await _delete_demo_rows(session)
        await _sim_calm(session, principal)
        log.info("demo reset: ended drill %s, deleted %s", ended, deleted)
        return {"deleted": deleted, "drill_ended": ended, "state_after": await snapshot(session)}


# ---------------------------------------------------------------- routes

Operator = Depends(require_roles("admin", "responder"))


@router.get("/demo/script")
async def demo_script(_principal: Principal = Operator) -> dict:
    return ok([dict(c) for c in CHAPTERS])


@router.post("/demo/chapter")
async def demo_chapter(body: ChapterBody, session: SessionDep, principal: Principal = Operator) -> dict:
    return ok(await run_chapter(session, principal, body.id.strip().lower()))


@router.post("/demo/reset")
async def demo_reset(session: SessionDep, principal: Principal = Operator) -> dict:
    return ok(await reset(session, principal))
