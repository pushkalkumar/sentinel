"""Sky vs Building explain endpoint (NOVELTY §3.2): GET /nodes/{id}/explain?at=."""
from __future__ import annotations

from statistics import median

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.alerts.engine import build_checks
from app.alerts.serialize import node_index
from app.deps import Principal, SessionDep, require_roles
from app.envelope import ApiError, ok
from app.models import NodeEval
from app.state import state
from app.timefmt import parse_iso

router = APIRouter()

OUTLIER_MAD_FACTOR = 3.0
OUTLIER_MAX_TEMP_RISE = 1.0
OUTLIER_MAX_GAS_DELTA = 50.0

VERDICT = {
    "HAZARDOUS_SMOKE": "Every node is high together. This is the sky, not the building.",
    "LOCAL_SMOKE_SUSPECT": "This node is climbing alone with no heat. Ask staff to look.",
    "CLEAR": "Nothing out of the ordinary at this node.",
}


def verdict_for(branch: str, ratio: float) -> str:
    if branch == "LOCAL_FIRE":
        return f"This node is {ratio:.1f}x its neighbours and heat is rising. This is a fire here, not smoke from outside."
    return VERDICT.get(branch, VERDICT["CLEAR"])


def is_outlier(pm25: float, neighbour_pm25: list[float], temp_rise: float, gas_delta: float) -> bool:
    """> 3 MAD from the neighbour median with no heat and no gas: sensor drift, not fire."""
    if len(neighbour_pm25) < 3:
        return False
    med = median(neighbour_pm25)
    mad = median(abs(v - med) for v in neighbour_pm25)
    if mad <= 0:
        mad = 1.0
    return abs(pm25 - med) > OUTLIER_MAD_FACTOR * mad and temp_rise < OUTLIER_MAX_TEMP_RISE and gas_delta < OUTLIER_MAX_GAS_DELTA


def _row_to_record(row: NodeEval) -> dict:
    return {
        "sim_ts": row.sim_ts, "pm25": row.pm25, "pm_rise": row.pm_rise, "temp_rise": row.temp_rise,
        "gas_delta": row.gas_delta, "regional": row.regional, "ratio": row.ratio,
        "neighbour_ids": row.neighbour_ids or [], "neighbour_pm25": row.neighbour_pm25 or [],
        "branch": row.branch, "thresholds": row.thresholds or {},
    }


async def _nearest_eval(session: AsyncSession, node_id: str, at: str) -> dict | None:
    before = (await session.execute(
        select(NodeEval).where(NodeEval.node_id == node_id, NodeEval.sim_ts <= at)
        .order_by(NodeEval.sim_ts.desc()).limit(1))).scalar_one_or_none()
    after = (await session.execute(
        select(NodeEval).where(NodeEval.node_id == node_id, NodeEval.sim_ts > at)
        .order_by(NodeEval.sim_ts.asc()).limit(1))).scalar_one_or_none()
    candidates = [r for r in (before, after) if r is not None]
    if not candidates:
        return None
    target = parse_iso(at).timestamp()
    best = min(candidates, key=lambda r: abs(parse_iso(r.sim_ts).timestamp() - target))
    return _row_to_record(best)


def explain_payload(node: dict, record: dict, nodes: dict[str, dict]) -> dict:
    thresholds = record.get("thresholds") or {}
    metrics = {k: record.get(k, 0.0) for k in ("pm25", "pm_rise", "temp_rise", "gas_delta", "regional")}
    metrics["regional"] = metrics["regional"] or 0.0
    branch = record.get("branch", "CLEAR")
    ratio = record.get("ratio") or (metrics["pm25"] / metrics["regional"] if metrics["regional"] else 0.0)
    checks = record.get("checks")
    if not checks and thresholds:
        checks = build_checks(branch, {**metrics, "neighbours": []}, {**thresholds})
    neighbour_pm = [float(v) for v in record.get("neighbour_pm25") or []]
    neighbours = [{"id": nid, "label": nodes.get(nid, {}).get("label", nid), "pm25": pm}
                  for nid, pm in zip(record.get("neighbour_ids") or [], neighbour_pm)]
    return {
        "node": {"id": node["id"], "label": node["label"], "site_id": node["site_id"], "indoor": node["indoor"]},
        "at": record.get("sim_ts"),
        "branch": branch,
        "verdict": verdict_for(branch, ratio),
        "eval": {**metrics, "ratio": round(ratio, 2)},
        "neighbours": neighbours,
        "checks": checks or [],
        "thresholds": thresholds,
        "outlier": is_outlier(metrics["pm25"], neighbour_pm, metrics["temp_rise"], metrics["gas_delta"]),
    }


@router.get("/nodes/{node_id}/explain")
async def explain(node_id: str, session: SessionDep,
                  _principal: Principal = Depends(require_roles("admin", "responder", "teacher")),
                  at: str | None = Query(None)) -> dict:
    nodes = await node_index(session)
    node = nodes.get(node_id)
    if node is None:
        raise ApiError("NOT_FOUND", f"node {node_id} not found")
    record = None
    if at:
        try:
            parse_iso(at)
        except ValueError as exc:
            raise ApiError("VALIDATION_ERROR", "at must be an ISO timestamp") from exc
        record = await _nearest_eval(session, node_id, at)
    if record is None:
        record = state.last_eval.get(node_id)
    if record is None:
        latest = (await session.execute(
            select(NodeEval).where(NodeEval.node_id == node_id).order_by(NodeEval.id.desc()).limit(1)
        )).scalar_one_or_none()
        record = _row_to_record(latest) if latest else None
    if record is None:
        raise ApiError("NOT_FOUND", f"no evaluation for node {node_id} yet")
    return ok(explain_payload(node, record, nodes))
