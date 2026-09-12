"""GET /api/ml/* : model card and live second opinion. Read-only over state.rings and the alerts table."""
from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.deps import SessionDep
from app.envelope import ApiError, ok
from app.ml.features import compute_features
from app.ml.model import BRANCH_FOR_CLASS, HUMAN_DECIDES, assess, basis, drift, load_weights
from app.models import Alert, Node
from app.state import state

router = APIRouter(prefix="/ml")

LIMITS = (
    "Trained only on synthetic windows from the demo simulator's curves; never validated on real fires or real smoke days.",
    "The 'suspect' class comes from a synthetic PM-only bump we added; the simulator has no such scenario.",
    "Seven hand-picked features; no raw time series, no camera, no audio.",
    "Cheap sensors (PMS5003, MQ-2) drift; the drift detector flags, it does not correct.",
    "Class probabilities are calibrated to the synthetic world, not to any real base rate.",
)


@router.get("/model-card")
async def model_card() -> dict:
    w = load_weights()
    return ok({
        "name": "Sentinel fire-vs-sky second opinion",
        "kind": w["training"]["model"],
        "classes": w["classes"],
        "features": w["features"],
        "training": w["training"],
        "drift_detector": {**w["drift"], "method": "EWMA of node-minus-neighbour-median PM2.5, robust z via MAD"},
        "limits": list(LIMITS),
        "authority": "rules decide, model advises",
        "basis": basis(),
        "human_decides": HUMAN_DECIDES,
    })


async def _open_branch(session, node_id: str) -> str:
    """The rule branch currently open at the node: live eval record first, else the highest-priority open alert."""
    last = state.last_eval.get(node_id)
    if last and last.get("branch"):
        return str(last["branch"])
    rows = (await session.execute(
        select(Alert).where(Alert.node_id == node_id, Alert.cleared_at.is_(None), Alert.kind != "ACTIVITY_ADVISORY")
        .order_by(Alert.priority)
    )).scalars().all()
    return rows[0].kind if rows else "CLEAR"


def _agrees(model_class: str, rule_branch: str) -> bool:
    """'sky' means every node climbing together. Below the hazardous threshold the rules voice that through the
    decision-card band, not an alert, so sky agrees with CLEAR as well as with HAZARDOUS_SMOKE."""
    if model_class == "sky":
        return rule_branch in {"CLEAR", "HAZARDOUS_SMOKE"}
    return BRANCH_FOR_CLASS[model_class] == rule_branch


async def _assess_node(session, node: Node, site_nodes: list[Node]) -> dict:
    history = list(state.rings.get(node.id, ()))
    neighbours = [list(state.rings[n.id]) for n in site_nodes if n.id != node.id and n.id in state.rings]
    rule_branch = await _open_branch(session, node.id)
    if not history:
        return {"node_id": node.id, "site_id": node.site_id, "sim_ts": None, "n_readings": 0, "features": None,
                "model": {"p": None, "top_class": None, "top_features": [], "basis": basis(),
                          "human_decides": HUMAN_DECIDES, "note": "no readings yet; nothing to assess"},
                "drift": {"score": 0.0, "flagged": False, "note": "no readings yet"},
                "rule_branch": rule_branch, "model_branch": None, "agreement": None,
                "authority": "rules decide, model advises", "human_decides": HUMAN_DECIDES}
    features = compute_features(history, neighbours)
    verdict = assess(features)
    return {
        "node_id": node.id,
        "site_id": node.site_id,
        "sim_ts": history[-1]["ts"] if history else None,
        "n_readings": len(history),
        "features": {k: round(v, 3) for k, v in features.items()},
        "model": verdict,
        "drift": drift(history, neighbours),
        "rule_branch": rule_branch,
        "model_branch": BRANCH_FOR_CLASS[verdict["top_class"]],
        "agreement": _agrees(verdict["top_class"], rule_branch),
        "authority": "rules decide, model advises",
        "human_decides": HUMAN_DECIDES,
    }


@router.get("/assess")
async def assess_node(session: SessionDep, node_id: str = Query(..., min_length=1)) -> dict:
    node = await session.get(Node, node_id)
    if node is None:
        raise ApiError("NOT_FOUND", f"node {node_id} not found")
    site_nodes = list((await session.execute(select(Node).where(Node.site_id == node.site_id))).scalars().all())
    return ok(await _assess_node(session, node, site_nodes))


@router.get("/assess-all")
async def assess_all(session: SessionDep, site_id: int = Query(...)) -> dict:
    site_nodes = list((await session.execute(select(Node).where(Node.site_id == site_id))).scalars().all())
    if not site_nodes:
        raise ApiError("NOT_FOUND", f"site {site_id} has no nodes")
    rows = [await _assess_node(session, n, site_nodes) for n in site_nodes if n.id in state.rings]
    return ok({
        "site_id": site_id,
        "nodes": rows,
        "disagreements": [r["node_id"] for r in rows if r["agreement"] is False],
        "authority": "rules decide, model advises",
        "basis": basis(),
        "human_decides": HUMAN_DECIDES,
    })
