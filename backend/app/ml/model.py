"""Load weights.json once; score a feature vector; flag a drifting sensor. Advisory only (rules decide)."""
from __future__ import annotations

import json
import math
from functools import lru_cache
from pathlib import Path
from statistics import median

from app.ml.features import FEATURE_NAMES, _ts

WEIGHTS_PATH = Path(__file__).with_name("weights.json")
HUMAN_DECIDES = ("Advisory only. The rule engine opens and closes alerts; this model is a second opinion. "
                 "A person on site decides what to do.")
BRANCH_FOR_CLASS = {"fire": "LOCAL_FIRE", "sky": "HAZARDOUS_SMOKE", "suspect": "LOCAL_SMOKE_SUSPECT", "clear": "CLEAR"}


@lru_cache(maxsize=1)
def load_weights() -> dict:
    return json.loads(WEIGHTS_PATH.read_text())


def basis() -> str:
    w = load_weights()
    tr = w["training"]
    return (f"Multinomial logistic regression on {len(w['features'])} engineered features, trained on "
            f"{tr['n_samples']} synthetic windows generated from the simulator's own sensor curves "
            f"(held-out accuracy {tr['accuracy_held_out']:.1%}). Synthetic data only; not validated on real fires.")


def assess(features: dict[str, float]) -> dict:
    """Class probabilities plus the per-feature contributions that pushed the winning class."""
    w = load_weights()
    z = [(float(features.get(name, 0.0)) - m) / s for name, m, s in zip(w["features"], w["means"], w["stds"])]
    logits = [sum(c * v for c, v in zip(row[:-1], z)) + row[-1] for row in w["coefs"]]
    top = max(logits)
    exps = [math.exp(v - top) for v in logits]
    total = sum(exps)
    p = {cls: round(e / total, 4) for cls, e in zip(w["classes"], exps)}
    winner = max(p, key=p.get)
    k = w["classes"].index(winner)
    # Contribution relative to the average class, so a feature that pushes every class equally scores zero.
    n_cls = len(w["classes"])
    contributions = []
    for i, name in enumerate(w["features"]):
        mean_coef = sum(row[i] for row in w["coefs"]) / n_cls
        contributions.append({"name": name, "value": round(float(features.get(name, 0.0)), 2),
                              "contribution": round((w["coefs"][k][i] - mean_coef) * z[i], 3)})
    contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)
    return {"p": p, "top_class": winner, "top_features": contributions[:3], "basis": basis(),
            "human_decides": HUMAN_DECIDES}


def drift(node_history: list[dict], neighbour_histories: list[list[dict]]) -> dict:
    """Robust z-score of this node's persistent offset from its neighbours over the last 30 min.

    Offset per tick = node pm25 - neighbour median pm25 at that tick. An EWMA of the offsets is the baseline;
    the score is that baseline divided by the robust spread (MAD) of the offsets. A fire also scores high here, so
    the note only calls it drift when the offset is steady, not rising.
    """
    cfg = load_weights()["drift"]
    if not node_history or not neighbour_histories:
        return {"score": 0.0, "flagged": False, "note": "not enough neighbour data to compare"}
    now = _ts(node_history[-1])
    recent = [r for r in node_history if now - _ts(r) <= cfg["window_s"]]
    offsets = []
    for r in recent:
        t = _ts(r)
        nb = []
        for h in neighbour_histories:
            near = [x for x in h if abs(_ts(x) - t) <= 45]
            if near:
                nb.append(float(min(near, key=lambda x: abs(_ts(x) - t))["pm25"]))
        if len(nb) >= 2:
            offsets.append(float(r["pm25"]) - median(nb))
    if len(offsets) < cfg["min_points"]:
        return {"score": 0.0, "flagged": False, "note": f"only {len(offsets)} comparable ticks; need {cfg['min_points']}"}
    ewma = offsets[0]
    for o in offsets[1:]:
        ewma = cfg["ewma_alpha"] * o + (1 - cfg["ewma_alpha"]) * ewma
    med = median(offsets)
    mad = median(abs(o - med) for o in offsets) * 1.4826 + 1e-6
    score = ewma / mad
    half = len(offsets) // 2
    trend = median(offsets[half:]) - median(offsets[:half])
    flagged = abs(score) > cfg["z_threshold"] and abs(trend) < abs(med)
    if flagged:
        note = (f"node sits {ewma:+.1f} µg/m³ from its neighbours and has for 30 min (robust z {score:.1f}); "
                "steady offset looks like sensor drift or a dirty inlet, not an event. Check the sensor.")
    elif abs(score) > cfg["z_threshold"]:
        note = f"offset {ewma:+.1f} is large but still moving (robust z {score:.1f}); an event, not drift"
    else:
        note = f"tracking neighbours (robust z {score:.1f})"
    return {"score": round(score, 2), "flagged": flagged, "note": note}


__all__ = ["assess", "drift", "basis", "load_weights", "FEATURE_NAMES", "BRANCH_FOR_CLASS", "HUMAN_DECIDES"]
