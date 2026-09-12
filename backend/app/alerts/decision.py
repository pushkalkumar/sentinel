"""Site-level decision card (CONTRACT §5.3), ACTIVITY_ADVISORY, GET /sites/{id}/decision-card and /air."""
from __future__ import annotations

from statistics import median

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.bands import band_def, band_index, band_key, policy_with_defaults
from app.alerts.serialize import alert_to_dict, node_index, site_index
from app.deps import Principal, SessionDep, require_roles, same_tenant_or_responder
from app.envelope import ApiError, ok
from app.models import Alert, DecisionLog, Reading, Tenant
from app.state import state
from app.timefmt import iso_plus, parse_iso, sim_hhmm

router = APIRouter()

AIR_MAX_POINTS = 4000


async def policy_for_site(session: AsyncSession, site_id: int) -> dict:
    sites = await site_index(session)
    site = sites.get(site_id)
    if site is None:
        return policy_with_defaults(None)
    tenant = await session.get(Tenant, site["tenant_id"])
    return policy_with_defaults(tenant.policy_pack if tenant else None)


async def outdoor_node_ids(session: AsyncSession, site_id: int) -> list[str]:
    nodes = await node_index(session)
    site_nodes = [n for n in nodes.values() if n["site_id"] == site_id]
    outdoor = [n["id"] for n in site_nodes if not n["indoor"]]
    return outdoor or [n["id"] for n in site_nodes]


def rolling_mean(node_id: str, now_iso: str, minutes: int) -> tuple[float | None, str | None]:
    """Mean pm25 of the node's ring readings in [now-minutes, now]; also the latest contributing ts."""
    ring = state.rings.get(node_id)
    if not ring:
        return None, None
    now = parse_iso(now_iso).timestamp()
    lo = now - minutes * 60
    vals = []
    latest = None
    for r in ring:
        t = parse_iso(r["ts"]).timestamp()
        if lo <= t <= now:
            vals.append(float(r["pm25"]))
            if latest is None or r["ts"] > latest:
                latest = r["ts"]
    if not vals:
        return None, None
    return sum(vals) / len(vals), latest


async def worst_outdoor(session: AsyncSession, site_id: int, now_iso: str, policy: dict) -> tuple[str, float, str] | None:
    best = None
    for nid in await outdoor_node_ids(session, site_id):
        value, latest = rolling_mean(nid, now_iso, int(policy["rolling_minutes"]))
        if value is None:
            continue
        if best is None or value > best[1]:
            best = (nid, value, latest or now_iso)
    return best


def _text(direction: str, band_to: str, hhmm: str, pm: float, label: str, policy: dict) -> str:
    if direction == "first":
        return f"Monitoring started {hhmm}, PM2.5 {pm:.0f} at {label}"
    if direction == "improving":
        return f"Band improved to {band_def(band_to, policy)['label']} {hhmm}, PM2.5 {pm:.0f} at {label}"
    heads = {
        "usg": "Sensitive groups indoors",
        "unhealthy": "Practice cancelled",
        "very_unhealthy": "All outdoor activity cancelled",
        "hazardous": "Shelter in place",
    }
    return f"{heads.get(band_to, 'Band now ' + band_def(band_to, policy)['label'])} {hhmm}, PM2.5 {pm:.0f} at {label}"


async def current_band(session: AsyncSession, site_id: int) -> str | None:
    """state.site_band, lazily restored from the newest decision_log row after a restart."""
    if site_id in state.site_band:
        return state.site_band[site_id]
    row = (await session.execute(
        select(DecisionLog).where(DecisionLog.site_id == site_id).order_by(DecisionLog.id.desc()).limit(1)
    )).scalar_one_or_none()
    state.site_band[site_id] = row.band_to if row else None
    return state.site_band[site_id]


async def update_site_band(session: AsyncSession, site_id: int, now_iso: str) -> list[tuple[str, dict]]:
    """Run after a telemetry batch. Returns WS events to broadcast: alert / alert_cleared / decision_card."""
    policy = await policy_for_site(session, site_id)
    worst = await worst_outdoor(session, site_id, now_iso, policy)
    if worst is None:
        return []
    node_id, pm, _latest = worst
    new_band = band_key(pm, policy)
    old_band = await current_band(session, site_id)
    if new_band == old_band:
        return []
    nodes = await node_index(session)
    node = nodes[node_id]
    sites = await site_index(session)
    hhmm = sim_hhmm(now_iso)
    direction = "first" if old_band is None else ("improving" if band_index(new_band) < band_index(old_band) else "worsening")
    text = _text(direction, new_band, hhmm, pm, node["label"], policy)
    session.add(DecisionLog(site_id=site_id, band_from=old_band, band_to=new_band, pm25=round(pm, 1),
                            node_id=node_id, guidance=band_def(new_band, policy)["guidance"], text=text,
                            changed_at=now_iso))
    state.site_band[site_id] = new_band
    events: list[tuple[str, dict]] = []

    open_adv = (await session.execute(
        select(Alert).where(Alert.site_id == site_id, Alert.kind == "ACTIVITY_ADVISORY", Alert.cleared_at.is_(None))
    )).scalars().all()
    for adv in open_adv:
        adv.cleared_at = now_iso
        events.append(("alert_cleared", await alert_to_dict(session, adv)))
    if direction == "worsening":
        alert = Alert(tenant_id=sites[site_id]["tenant_id"], site_id=site_id, zone_id=node["zone_id"], node_id=node_id,
                      kind="ACTIVITY_ADVISORY", priority=4, band_from=old_band, band_to=new_band, reason=text,
                      metrics={"pm25": round(pm, 1), "rolling_pm25": round(pm, 1), "pm_rise": 0, "temp_rise": 0,
                               "gas_delta": 0, "regional": round(pm, 1)},
                      started_at=now_iso, cleared_at=None)
        session.add(alert)
        await session.flush()
        events.append(("alert", await alert_to_dict(session, alert)))
    await session.flush()
    card = await get_decision_card(session, site_id, log_limit=5)
    if card:
        events.append(("decision_card", card))
    return events


def _log_entry(row: DecisionLog, nodes: dict[str, dict]) -> dict:
    return {
        "at": row.changed_at, "band_from": row.band_from, "band_to": row.band_to, "pm25": row.pm25,
        "node_id": row.node_id, "node_label": nodes.get(row.node_id, {}).get("label", row.node_id),
        "guidance": row.guidance, "text": row.text,
    }


async def get_decision_card(session: AsyncSession, site_id: int, log_limit: int = 20) -> dict | None:
    """DecisionCard shape from CONTRACT §3.1; None until the site has a band."""
    rows = (await session.execute(
        select(DecisionLog).where(DecisionLog.site_id == site_id).order_by(DecisionLog.id.desc()).limit(log_limit)
    )).scalars().all()
    if not rows:
        return None
    latest = rows[0]
    policy = await policy_for_site(session, site_id)
    nodes = await node_index(session)
    band = latest.band_to
    band_info = band_def(band, policy)
    node_id, pm, as_of = latest.node_id, latest.pm25, latest.changed_at
    now_iso = max((r["ts"] for nid, r in state.latest.items() if nodes.get(nid, {}).get("site_id") == site_id),
                  default=None)
    if now_iso:
        worst = await worst_outdoor(session, site_id, now_iso, policy)
        if worst:
            node_id, pm, as_of = worst
    return {
        "site_id": site_id,
        "band": band,
        "pm25": round(pm, 1),
        "node_id": node_id,
        "node_label": nodes.get(node_id, {}).get("label", node_id),
        "headline": band_info["headline"],
        "guidance": band_info["guidance"],
        "changed_at": latest.changed_at,
        "as_of": as_of,
        "window_minutes": int(policy["rolling_minutes"]),
        "log": [_log_entry(r, nodes) for r in rows],
    }


async def _site_or_404(session: AsyncSession, site_id: int, principal: Principal) -> dict:
    sites = await site_index(session)
    site = sites.get(site_id)
    if site is None:
        raise ApiError("NOT_FOUND", f"site {site_id} not found")
    same_tenant_or_responder(principal, site["tenant_id"])
    return site


@router.get("/sites/{site_id}/decision-card")
async def decision_card_route(site_id: int, session: SessionDep,
                              principal: Principal = Depends(require_roles("admin", "responder", "teacher"))) -> dict:
    await _site_or_404(session, site_id, principal)
    card = await get_decision_card(session, site_id)
    if card is None:
        raise ApiError("NOT_FOUND", "no readings for this site yet")
    return ok(card)


def _bucket(ts: str, step: int) -> str:
    dt = parse_iso(ts)
    minute = (dt.minute // step) * step
    return dt.replace(minute=minute, second=0, microsecond=0).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@router.get("/sites/{site_id}/air")
async def air_route(site_id: int, session: SessionDep,
                    principal: Principal = Depends(require_roles("admin", "responder", "teacher")),
                    minutes: int = Query(180, ge=5, le=1440), step: int = Query(5, ge=1, le=60)) -> dict:
    await _site_or_404(session, site_id, principal)
    nodes = await node_index(session)
    site_nodes = {nid: n for nid, n in nodes.items() if n["site_id"] == site_id}
    if step not in (1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30, 60):
        step = 5
    while (minutes // step) * len(site_nodes) > AIR_MAX_POINTS and step < 60:
        step = min(60, step * 2)
    latest_ts = (await session.execute(
        select(Reading.ts).where(Reading.node_id.in_(list(site_nodes))).order_by(Reading.ts.desc()).limit(1)
    )).scalar_one_or_none()
    series_by_node: dict[str, dict[str, list[float]]] = {nid: {} for nid in site_nodes}
    if latest_ts:
        since = iso_plus(latest_ts, -minutes * 60)
        rows = (await session.execute(
            select(Reading.node_id, Reading.ts, Reading.pm25, Reading.temp_c)
            .where(Reading.node_id.in_(list(site_nodes)), Reading.ts >= since).order_by(Reading.ts)
        )).all()
        for nid, ts, pm25, temp_c in rows:
            bucket = series_by_node[nid].setdefault(_bucket(ts, step), [0.0, 0.0, 0])
            bucket[0] += pm25
            bucket[1] += temp_c
            bucket[2] += 1
    series = []
    regional_buckets: dict[str, list[float]] = {}
    outdoor_ids = set(await outdoor_node_ids(session, site_id))
    for nid, n in site_nodes.items():
        points = [{"ts": b, "pm25": round(v[0] / v[2], 1), "temp_c": round(v[1] / v[2], 1)}
                  for b, v in sorted(series_by_node[nid].items())]
        if nid in outdoor_ids:
            for pt in points:
                regional_buckets.setdefault(pt["ts"], []).append(pt["pm25"])
        series.append({"node_id": nid, "label": n["label"], "indoor": n["indoor"], "points": points})
    regional = [{"ts": b, "pm25": round(median(v), 1)} for b, v in sorted(regional_buckets.items())]
    hist_rows = (await session.execute(
        select(DecisionLog).where(DecisionLog.site_id == site_id).order_by(DecisionLog.id.desc()).limit(50)
    )).scalars().all()
    band_history = [_log_entry(r, nodes) for r in reversed(hist_rows)]
    return ok({"site_id": site_id, "minutes": minutes, "step": step, "series": series,
               "regional": regional, "band_history": band_history})
