"""POST /ingest/telemetry (CONTRACT §3.9): idempotent insert, ring push, evaluate, apply, card, SMS, WS."""
from __future__ import annotations

import logging
from typing import Union

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import ws
from app.alerts import sms
from app.alerts.bands import band_key
from app.alerts.decision import policy_for_site, update_site_band
from app.alerts.engine import AlertDecision, clear_check, evaluate
from app.alerts.serialize import alert_to_dict, node_index
from app.deps import SessionDep, require_sim_key
from app.envelope import ok
from app.models import Alert, Node, NodeEval, Reading
from app.state import state

log = logging.getLogger("sentinel.ingest")
router = APIRouter()

EVALS_KEEP = 60
EVALS_PRUNE_EVERY = 20
_eval_counter: dict[str, int] = {}
_last_status: dict[str, tuple] = {}
_status_warned = False


class ReadingIn(BaseModel):
    node_id: str
    ts: str
    pm1: float
    pm25: float
    pm10: float
    temp_c: float
    rh: float
    mq2_raw: int
    rssi: int
    battery_pct: float


def _reading_dict(r: ReadingIn) -> dict:
    return r.model_dump()


def _neighbours(node: dict, nodes: dict[str, dict]) -> list[dict]:
    return [{**state.latest[nid], "node_id": nid} for nid, n in nodes.items()
            if n["site_id"] == node["site_id"] and nid != node["id"] and nid in state.latest]


async def _open_alerts(session: AsyncSession, node_id: str) -> list[Alert]:
    return list((await session.execute(
        select(Alert).where(Alert.node_id == node_id, Alert.cleared_at.is_(None), Alert.kind != "ACTIVITY_ADVISORY")
    )).scalars().all())


async def _apply(session: AsyncSession, node: dict, decisions: list[AlertDecision], open_alerts: list[Alert],
                 policy: dict, events: list[tuple[str, dict]]) -> tuple[int, int]:
    opened = cleared = 0
    for d in decisions:
        if d.action == "clear":
            for a in open_alerts:
                if a.kind == d.kind and a.cleared_at is None:
                    a.cleared_at = d.at
                    cleared += 1
                    events.append(("alert_cleared", await alert_to_dict(session, a)))
        else:
            alert = Alert(tenant_id=policy["_tenant_id"], site_id=node["site_id"], zone_id=node["zone_id"],
                          node_id=node["id"], kind=d.kind, priority=d.priority, band_from=d.band_from,
                          band_to=d.band_to, reason=d.reason, metrics=d.metrics, started_at=d.at, cleared_at=None)
            session.add(alert)
            await session.flush()
            opened += 1
            events.append(("alert", await alert_to_dict(session, alert)))
            for msg in await sms.fan_out(session, alert, policy):
                events.append(("sms_sent", msg))
    return opened, cleared


async def _sweep_clears(session: AsyncSession, site_id: int, nodes: dict[str, dict], reported: set[str],
                        policy: dict, events: list[tuple[str, dict]], touched: list[str]) -> int:
    """Run the clear check for open alerts at nodes that did not report in this batch (judge item 6).

    A node goes quiet after a jump or a dropped tick while its last reading is already back in band; without
    this the alert stays open forever and the banner contradicts the rail.
    """
    cleared = 0
    for node_id, node in nodes.items():
        if node["site_id"] != site_id or node_id in reported:
            continue
        latest = state.latest.get(node_id)
        if latest is None:
            continue
        open_alerts = await _open_alerts(session, node_id)
        if not open_alerts:
            continue
        ring = list(state.ring(node_id))
        history = ring[:-1] if ring and ring[-1] is latest else ring
        decisions = clear_check(latest, history, _neighbours(node, nodes), open_alerts, policy)
        if not decisions:
            continue
        _opened, just_cleared = await _apply(session, node, decisions, open_alerts, policy, events)
        cleared += just_cleared
        if just_cleared:
            touched.append(node_id)      # its rail status changed even though it did not report
    return cleared


async def _write_eval(session: AsyncSession, node: dict, record: dict) -> None:
    session.add(NodeEval(
        node_id=node["id"], site_id=node["site_id"], sim_ts=record["sim_ts"], pm25=record["pm25"],
        pm_rise=record["pm_rise"], temp_rise=record["temp_rise"], gas_delta=record["gas_delta"],
        regional=record["regional"], ratio=record["ratio"], neighbour_ids=record["neighbour_ids"],
        neighbour_pm25=record["neighbour_pm25"], branch=record["branch"], thresholds=record["thresholds"],
    ))
    count = _eval_counter.get(node["id"], 0) + 1
    _eval_counter[node["id"]] = count
    if count % EVALS_PRUNE_EVERY == 0:
        keep = select(NodeEval.id).where(NodeEval.node_id == node["id"]).order_by(NodeEval.id.desc()).limit(EVALS_KEEP)
        await session.execute(delete(NodeEval).where(NodeEval.node_id == node["id"], NodeEval.id.not_in(keep)))


async def _node_status_event(session: AsyncSession, node_id: str) -> dict | None:
    """Goes through core.nodes.node_status_payload; tolerant while backend-core is still landing."""
    global _status_warned
    try:
        from app.core.nodes import node_status_payload
        payload = await node_status_payload(session, node_id)
    except NotImplementedError:
        if not _status_warned:
            log.warning("core.nodes.node_status_payload not implemented yet; node_status events suppressed")
            _status_warned = True
        return None
    except Exception:  # noqa: BLE001 - a status hiccup must not drop telemetry
        log.exception("node_status_payload failed for %s", node_id)
        return None
    key = (payload.get("status"), payload.get("band"), tuple(sorted(payload.get("open_alert_kinds") or [])))
    if _last_status.get(node_id) == key:
        return None
    _last_status[node_id] = key
    return payload


async def _site_policy(session: AsyncSession, site_id: int, cache: dict[int, dict]) -> dict:
    if site_id not in cache:
        from app.alerts.serialize import site_index
        sites = await site_index(session)
        policy = await policy_for_site(session, site_id)
        cache[site_id] = {**policy, "_tenant_id": sites[site_id]["tenant_id"]}
    return cache[site_id]


@router.post("/ingest/telemetry")
async def ingest_telemetry(body: Union[ReadingIn, list[ReadingIn]], session: SessionDep,
                           _key: str = Depends(require_sim_key)) -> dict:
    batch = body if isinstance(body, list) else [body]
    nodes = await node_index(session)
    events: list[tuple[str, dict]] = []
    accepted = duplicates = rejected = opened_total = cleared_total = 0
    touched_sites: dict[int, str] = {}
    status_nodes: list[str] = []
    policies: dict[int, dict] = {}

    for item in sorted(batch, key=lambda r: r.ts):
        node = nodes.get(item.node_id)
        if node is None:
            rejected += 1
            continue
        reading = _reading_dict(item)
        result = await session.execute(sqlite_insert(Reading).values(**reading).on_conflict_do_nothing())
        if result.rowcount == 0:
            duplicates += 1
            continue
        accepted += 1
        await session.execute(update(Node).where(Node.id == node["id"]).values(
            last_seen=reading["ts"], battery_pct=reading["battery_pct"], rssi=reading["rssi"]))
        policy = await _site_policy(session, node["site_id"], policies)
        ring = state.ring(node["id"])
        history = list(ring)
        neighbours = _neighbours(node, nodes)
        open_alerts = await _open_alerts(session, node["id"])
        prev = state.last_eval.get(node["id"]) or {}
        decisions, record = evaluate(reading, history, neighbours, open_alerts, policy,
                                     state.site_band.get(node["site_id"]), prev.get("suspect_streak", 0))
        ring.append(reading)
        state.latest[node["id"]] = reading
        opened, cleared = await _apply(session, node, decisions, open_alerts, policy, events)
        opened_total += opened
        cleared_total += cleared
        state.last_eval[node["id"]] = record
        await _write_eval(session, node, record)
        site_now = touched_sites.get(node["site_id"])
        if site_now is None or reading["ts"] > site_now:
            touched_sites[node["site_id"]] = reading["ts"]
        events.append(("reading", {**reading, "site_id": node["site_id"], "band": band_key(reading["pm25"], policy)}))
        status_nodes.append(node["id"])

    reported = set(status_nodes)
    for site_id, now_iso in touched_sites.items():
        policy = await _site_policy(session, site_id, policies)
        cleared_total += await _sweep_clears(session, site_id, nodes, reported, policy, events, status_nodes)
        events.extend(await update_site_band(session, site_id, now_iso))
        for msg in await sms.check_all_clear(session, site_id, now_iso, policy):
            events.append(("sms_sent", msg))

    await session.commit()
    for node_id in dict.fromkeys(status_nodes):
        payload = await _node_status_event(session, node_id)
        if payload:
            events.append(("node_status", payload))
    for type_, data in events:
        await ws.hub.broadcast(type_, data)
    return ok({"accepted": accepted, "duplicates": duplicates, "rejected": rejected,
               "alerts_opened": opened_total, "alerts_cleared": cleared_total})
