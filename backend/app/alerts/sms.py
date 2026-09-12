"""Simulated SMS fan-out, dedup, all-clear tracker and GET /sms/outbox (CONTRACT §3.5, §5.4)."""
from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.bands import band_def, band_index
from app.alerts.serialize import node_index, site_index, zone_index
from app.deps import Principal, SessionDep, require_roles
from app.envelope import ok
from app.models import Alert, SmsLog, SmsRecipient
from app.state import state
from app.timefmt import iso_plus, now_iso, parse_iso, sim_hhmm

router = APIRouter()

OUTBOX_LABEL = "SMS provider disabled in demo. These are the messages the engine would have sent."
ALL_CLEAR_SEVERITY = 0
ALL_CLEAR_BAND_DROP = 2


def _provider_id() -> str:
    return "SIM-" + secrets.token_hex(4)


def _body(alert: Alert, site_name: str, zone_name: str, node_label: str) -> str:
    hhmm = sim_hhmm(alert.started_at)
    if alert.kind == "LOCAL_FIRE":
        return (f"SENTINEL ALERT ({site_name}, {zone_name}): FIRE detected at {node_label} {hhmm}. "
                f"Evacuate {zone_name} to muster points. Do not re-enter. Reply STOP to opt out.")
    pm = float((alert.metrics or {}).get("pm25", 0))
    return (f"SENTINEL ALERT ({site_name}, {zone_name}): Air quality HAZARDOUS (PM2.5 {pm:.0f}) {hhmm}. "
            "Shelter indoors, close windows, run filtration. Reply STOP to opt out.")


def message_dict(row: SmsLog, alert_kind: str, zone_name: str, recipient_label: str) -> dict:
    return {
        "id": row.id, "alert_id": row.alert_id, "alert_kind": alert_kind, "zone_id": row.zone_id,
        "zone_name": zone_name, "phone_e164": row.phone_e164, "recipient_label": recipient_label,
        "severity": row.severity, "body": row.body, "status": row.status, "provider_msg_id": row.provider_msg_id,
        "sent_at": row.sent_at, "sim_at": row.sim_at,
    }


async def _recent_sends(session: AsyncSession, zone_id: int, severity: int, since_iso: str) -> set[int]:
    """recipient ids already covered by a row at this zone with severity <= alert priority inside the dedup window."""
    rows = (await session.execute(
        select(SmsLog.recipient_id).where(
            SmsLog.zone_id == zone_id, SmsLog.severity > ALL_CLEAR_SEVERITY, SmsLog.severity <= severity,
            SmsLog.sim_at >= since_iso,
        )
    )).all()
    return {r[0] for r in rows}


async def fan_out(session: AsyncSession, alert: Alert, policy: dict) -> list[dict]:
    """Insert sms_log rows for an opened priority <= 2 alert. Returns outbox message dicts for WS sms_sent."""
    if alert.priority > 2:
        return []
    sites = await site_index(session)
    zones = await zone_index(session)
    nodes = await node_index(session)
    site_name = sites.get(alert.site_id, {}).get("name", "")
    zone_name = zones.get(alert.zone_id, {}).get("name", "")
    node_label = nodes.get(alert.node_id or "", {}).get("label", alert.node_id or "")
    dedup_s = int(policy["sms_dedup_minutes"]) * 60
    since_iso = iso_plus(alert.started_at, -dedup_s)
    covered = await _recent_sends(session, alert.zone_id, alert.priority, since_iso)
    recipients = (await session.execute(
        select(SmsRecipient).where(SmsRecipient.zone_id == alert.zone_id, SmsRecipient.opted_out_at.is_(None))
    )).scalars().all()
    body = _body(alert, site_name, zone_name, node_label)
    wall = now_iso()
    rows = []
    for r in recipients:
        if r.id in covered:
            continue
        row = SmsLog(alert_id=alert.id, recipient_id=r.id, zone_id=alert.zone_id, phone_e164=r.phone_e164,
                     body=body, severity=alert.priority, status="simulated", provider_msg_id=_provider_id(),
                     sent_at=wall, sim_at=alert.started_at)
        session.add(row)
        rows.append((row, r.label))
    await session.flush()
    state.pending_all_clear[alert.site_id] = {
        "since_ts": None, "alert_id": alert.id, "band_at_alert": state.site_band.get(alert.site_id),
    }
    return [message_dict(row, alert.kind, zone_name, label) for row, label in rows]


async def check_all_clear(session: AsyncSession, site_id: int, now_iso_sim: str, policy: dict) -> list[dict]:
    """CONTRACT §5.4 all-clear: band >= 2 levels below the band at alert time for all_clear_minutes, once."""
    pending = state.pending_all_clear.get(site_id)
    if not pending:
        return []
    band_now = state.site_band.get(site_id)
    base = pending.get("band_at_alert")
    if base is None or band_index(band_now) > band_index(base) - ALL_CLEAR_BAND_DROP:
        state.pending_all_clear[site_id] = {**pending, "since_ts": None}
        return []
    since = pending.get("since_ts")
    if since is None:
        state.pending_all_clear[site_id] = {**pending, "since_ts": now_iso_sim}
        return []
    elapsed = parse_iso(now_iso_sim).timestamp() - parse_iso(since).timestamp()
    if elapsed < int(policy["all_clear_minutes"]) * 60:
        return []
    alert = await session.get(Alert, pending["alert_id"])
    state.pending_all_clear.pop(site_id, None)
    if alert is None:
        return []
    sites = await site_index(session)
    zones = await zone_index(session)
    zone_name = zones.get(alert.zone_id, {}).get("name", "")
    label = band_def(band_now, policy)["label"]
    body = (f"SENTINEL ({sites.get(site_id, {}).get('name', '')}, {zone_name}): All clear {sim_hhmm(now_iso_sim)}. "
            f"Air quality back to {label}. Normal operations resume.")
    sent = (await session.execute(
        select(SmsLog.recipient_id, SmsLog.phone_e164).where(SmsLog.alert_id == alert.id, SmsLog.severity > 0)
    )).all()
    recipients = {r.id: r for r in (await session.execute(
        select(SmsRecipient).where(SmsRecipient.id.in_([s[0] for s in sent]))
    )).scalars().all()}
    wall = now_iso()
    rows = []
    for rid, phone in sent:
        row = SmsLog(alert_id=alert.id, recipient_id=rid, zone_id=alert.zone_id, phone_e164=phone, body=body,
                     severity=ALL_CLEAR_SEVERITY, status="simulated", provider_msg_id=_provider_id(),
                     sent_at=wall, sim_at=now_iso_sim)
        session.add(row)
        rows.append(row)
    await session.flush()
    return [message_dict(row, "ALL_CLEAR", zone_name, recipients.get(row.recipient_id).label
                         if recipients.get(row.recipient_id) else "") for row in rows]


@router.get("/sms/outbox")
async def outbox(session: SessionDep, principal: Principal = Depends(require_roles("admin", "responder", "teacher")),
                 site_id: int | None = Query(None), limit: int = Query(200, ge=1, le=1000)) -> dict:
    zones = await zone_index(session)
    base = select(SmsLog, Alert.kind, Alert.site_id, SmsRecipient.label).join(Alert, Alert.id == SmsLog.alert_id) \
        .join(SmsRecipient, SmsRecipient.id == SmsLog.recipient_id)
    count_q = select(func.count()).select_from(SmsLog).join(Alert, Alert.id == SmsLog.alert_id)
    if site_id is not None:
        base = base.where(Alert.site_id == site_id)
        count_q = count_q.where(Alert.site_id == site_id)
    if principal.role != "responder":
        base = base.where(Alert.tenant_id == principal.tenant_id)
        count_q = count_q.where(Alert.tenant_id == principal.tenant_id)
    rows = (await session.execute(base.order_by(SmsLog.id.desc()).limit(limit))).all()
    total = (await session.execute(count_q)).scalar_one()
    messages = [message_dict(row, "ALL_CLEAR" if row.severity == 0 else kind,
                             zones.get(row.zone_id, {}).get("name", ""), label)
                for row, kind, _site, label in rows]
    return ok({"provider": "disabled", "label": OUTBOX_LABEL, "count": total, "messages": messages})
