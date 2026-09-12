"""Time Machine feed (NOVELTY §3.1): GET /api/timeline, shaped as frontend `TimelineResponse`."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.bands import DEFAULT_POLICY, band_key
from app.deps import Principal, SessionDep, require_roles
from app.envelope import ApiError, ok
from app.models import Alert, DecisionLog, Incident, Node, Reading, Site, Tenant
from app.state import state
from app.timefmt import fmt_iso, now_iso, parse_iso

router = APIRouter()

DAY_START_HHMM = "07:00:00.000Z"
MIN_STEP_S = 1
MAX_STEP_S = 86400

# Decimation happens in SQL so a full day (14 nodes x 1560 readings at 30 s) stays under 300 ms.
# strftime('%s') understands the contract's `...Z` suffix; integer division buckets by step.
DECIMATE_SQL = text("""
    SELECT r.node_id AS node_id,
           CAST(strftime('%s', r.ts) / :step AS INTEGER) AS bucket,
           AVG(r.pm25) AS pm25,
           AVG(r.temp_c) AS temp_c
    FROM readings r
    JOIN nodes n ON n.id = r.node_id
    WHERE n.site_id = :site_id AND r.ts >= :ts_from AND r.ts <= :ts_to
    GROUP BY r.node_id, bucket
    ORDER BY bucket, r.node_id
""")


def _bucket_iso(bucket: int, step: int) -> str:
    return fmt_iso(datetime.fromtimestamp(bucket * step, tz=timezone.utc))


def _valid_iso(value: str | None, name: str) -> str | None:
    if value is None or value == "":
        return None
    try:
        return fmt_iso(parse_iso(value))
    except ValueError as exc:
        raise ApiError("VALIDATION_ERROR", f"{name} must be an ISO 8601 timestamp") from exc


def sim_now_iso() -> str | None:
    sim = state.sim_state
    return sim.get("sim_ts") if isinstance(sim, dict) else None


async def _latest_reading_ts(session: AsyncSession, site_id: int) -> str | None:
    stmt = (
        select(Reading.ts)
        .join(Node, Node.id == Reading.node_id)
        .where(Node.site_id == site_id)
        .order_by(Reading.ts.desc())
        .limit(1)
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def default_range(session: AsyncSession, site_id: int) -> tuple[str, str]:
    """07:00 on the demo day up to the latest reading (falling back to sim clock, then wall clock)."""
    end = await _latest_reading_ts(session, site_id) or sim_now_iso() or now_iso()
    start = f"{end[:10]}T{DAY_START_HHMM}"
    if start > end:
        start = end
    return start, end


async def _policy_for_site(session: AsyncSession, site: Site) -> dict:
    tenant = await session.get(Tenant, site.tenant_id)
    return tenant.policy_pack if tenant and tenant.policy_pack else DEFAULT_POLICY


async def gate_site(session: AsyncSession, principal: Principal, site_id: int) -> Site:
    site = await session.get(Site, site_id)
    if site is None:
        raise ApiError("NOT_FOUND", f"site {site_id} not found")
    if principal.role == "responder":
        return site
    if principal.tenant_id != site.tenant_id:
        raise ApiError("FORBIDDEN", "site belongs to another tenant")
    return site


async def decimated_readings(session: AsyncSession, site_id: int, step: int, ts_from: str, ts_to: str,
                             policy: dict) -> list[dict]:
    rows = await session.execute(DECIMATE_SQL, {"step": step, "site_id": site_id, "ts_from": ts_from, "ts_to": ts_to})
    out = []
    for node_id, bucket, pm25, temp_c in rows:
        pm25 = round(float(pm25), 1)
        out.append({
            "node_id": node_id,
            "sim_ts": _bucket_iso(int(bucket), step),
            "pm25": pm25,
            "temp_c": round(float(temp_c), 1),
            "band": band_key(pm25, policy),
        })
    return out


async def alerts_in_range(session: AsyncSession, site_id: int, ts_from: str, ts_to: str) -> list[dict]:
    stmt = (
        select(Alert, Node.label)
        .outerjoin(Node, Node.id == Alert.node_id)
        .where(
            Alert.site_id == site_id,
            Alert.started_at <= ts_to,
            (Alert.cleared_at.is_(None)) | (Alert.cleared_at >= ts_from),
        )
        .order_by(Alert.started_at)
    )
    return [
        {
            "id": a.id, "kind": a.kind, "priority": a.priority, "node_id": a.node_id,
            "node_label": label or a.node_id or "", "started_at": a.started_at,
            "cleared_at": a.cleared_at, "reason": a.reason,
        }
        for a, label in (await session.execute(stmt)).all()
    ]


async def decisions_in_range(session: AsyncSession, site_id: int, ts_from: str, ts_to: str) -> list[dict]:
    stmt = (
        select(DecisionLog, Node.label)
        .outerjoin(Node, Node.id == DecisionLog.node_id)
        .where(DecisionLog.site_id == site_id, DecisionLog.changed_at >= ts_from, DecisionLog.changed_at <= ts_to)
        .order_by(DecisionLog.changed_at)
    )
    return [
        {
            "at": d.changed_at, "band_from": d.band_from, "band_to": d.band_to, "pm25": d.pm25,
            "node_id": d.node_id, "node_label": label or d.node_id, "guidance": d.guidance, "text": d.text,
        }
        for d, label in (await session.execute(stmt)).all()
    ]


async def incidents_in_range(session: AsyncSession, site_id: int, ts_from: str, ts_to: str) -> list[dict]:
    stmt = (
        select(Incident)
        .where(Incident.site_id == site_id, Incident.sim_at.is_not(None),
               Incident.sim_at >= ts_from, Incident.sim_at <= ts_to)
        .order_by(Incident.sim_at)
    )
    return [
        {
            "code": i.code, "type": i.type, "sim_at": i.sim_at, "trust_score": i.trust_score,
            "status": i.status, "node_id": i.node_id,
        }
        for i in (await session.execute(stmt)).scalars().all()
    ]


@router.get("/timeline")
async def timeline(
    session: SessionDep,
    site_id: int = Query(1),
    step: int = Query(300, ge=MIN_STEP_S, le=MAX_STEP_S),
    ts_from: str | None = Query(None, alias="from"),
    ts_to: str | None = Query(None, alias="to"),
    principal: Principal = Depends(require_roles("admin", "teacher", "responder")),
) -> dict:
    site = await gate_site(session, principal, site_id)
    default_from, default_to = await default_range(session, site_id)
    start = _valid_iso(ts_from, "from") or default_from
    end = _valid_iso(ts_to, "to") or default_to
    if start > end:
        raise ApiError("VALIDATION_ERROR", "from must not be after to")
    policy = await _policy_for_site(session, site)
    return ok({
        "site_id": site_id,
        "step_s": step,
        "from": start,
        "to": end,
        "sim_now": sim_now_iso(),
        "readings": await decimated_readings(session, site_id, step, start, end, policy),
        "alerts": await alerts_in_range(session, site_id, start, end),
        "decisions": await decisions_in_range(session, site_id, start, end),
        "incidents": await incidents_in_range(session, site_id, start, end),
    })
