"""Offline trainer: labelled windows from the simulator's own curves -> weights.json.

Run from backend/: `.venv/bin/python -m app.ml.train`. Imports simulator/world.py by path and never modifies it.
Labels come from the scenario that generated the window (ground truth of the synthetic world), not from the
rule engine, so the model is an independent second opinion rather than a copy of the rules.
"""
from __future__ import annotations

import importlib.util
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

from app.ml.features import FEATURE_NAMES, compute_features

REPO = Path(__file__).resolve().parents[3]
WEIGHTS_PATH = Path(__file__).with_name("weights.json")
CLASSES = ("fire", "sky", "clear", "suspect")
SEEDS = (1, 2, 3)
TICK_SPACINGS_S = (10, 30, 60)          # stands in for 1x / 60x / 300x playback: how sparse the ring is
NOISE_MULTIPLIERS = (0.5, 1.0, 2.0)
WINDOW_S = 35 * 60
FIRE_AGES_S = (200, 240, 400, 1500)
FIRE_LABEL_MIN_RAMP = 0.35
SKY_LABEL_MIN_REGIONAL = 100.0
SKY_SCALE_RANGE = (1.3, 2.2)
SUSPECT_BUMPS = (60.0, 120.0)           # PM-only spikes (dust, aerosol, vape): the one scenario world.py lacks
SUSPECT_RAMP_S = 120
HELD_OUT_FRACTION = 0.2
L2 = 1e-3
LR = 0.2
EPOCHS = 1500
DRIFT = {"ewma_alpha": 0.1, "window_s": 1800, "z_threshold": 3.0, "min_points": 10}


def load_world():
    spec = importlib.util.spec_from_file_location("sentinel_sim_world", REPO / "simulator" / "world.py")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def sim_ts(world, t: float) -> str:
    base = datetime(2026, 9, 12, world.DAY_START_H, 0, 0, tzinfo=timezone.utc)
    return (base + timedelta(seconds=t)).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _noisy(r: dict, rng: random.Random, mult: float) -> dict:
    """Extra sensor noise on top of world.py's own (mult <= 1 leaves the reading as generated)."""
    extra = max(0.0, mult - 1.0)
    if extra == 0.0:
        return r
    out = dict(r)
    out["pm25"] = max(0.0, r["pm25"] + rng.gauss(0, 1.5 * extra))
    out["temp_c"] = r["temp_c"] + rng.gauss(0, 0.15 * extra)
    out["rh"] = min(100.0, max(1.0, r["rh"] + rng.gauss(0, 0.8 * extra)))
    out["mq2_raw"] = max(0, int(round(r["mq2_raw"] + rng.gauss(0, 4.0 * extra))))
    return out


def _bump(age_s: float, amplitude: float) -> float:
    return amplitude * min(1.0, max(0.0, age_s / SUSPECT_RAMP_S))


def label_for(world, node, t_end: float, ov, suspect: dict[str, float], bump_amp: float) -> str | None:
    ramp = ov.fire_ramp(node.id, t_end)
    if ramp > 0.0:
        return "fire" if ramp >= FIRE_LABEL_MIN_RAMP else None    # smoulder is ambiguous; leave it out
    if node.id in suspect:
        return "suspect" if _bump(t_end - suspect[node.id], bump_amp) >= 0.5 * bump_amp else None
    regional = world.regional_pm25(t_end) + ov.smoke_boost(t_end, world.regional_pm25(t_end))
    return "sky" if regional >= SKY_LABEL_MIN_REGIONAL else "clear"


def scenarios(world, site_nodes, rng: np.random.Generator):
    """Yield (t_end, overrides, suspect_map, bump_amp, name)."""
    h = lambda hh: (hh - world.DAY_START_H) * 3600.0  # noqa: E731
    yield h(9.0 + rng.uniform(0, 3.0)), world.Overrides(), {}, 0.0, "calm"
    yield h(14.5 + rng.uniform(0, 2.0)), world.Overrides(), {}, 0.0, "sky_scheduled"
    t = h(10.0 + rng.uniform(0, 2.0))
    ov = world.Overrides()
    ov.trigger_smoke(t - 600)
    yield t, ov, {}, 0.0, "sky_forced"
    for age in FIRE_AGES_S:
        for base_hour in (10.5, 15.5):
            t = h(base_hour + rng.uniform(0, 1.0))
            ov = world.Overrides()
            ov.trigger_fire(site_nodes[rng.integers(len(site_nodes))].id, t - age)
            yield t, ov, {}, 0.0, f"fire_{age}s"
    for amp in SUSPECT_BUMPS:
        for base_hour in (9.5, 15.5):
            t = h(base_hour + rng.uniform(0, 1.0))
            target = site_nodes[rng.integers(len(site_nodes))].id
            yield t, world.Overrides(), {target: t - 180}, amp, f"suspect_{int(amp)}"


def build_dataset(world, nodes):
    X, y, scenario_names = [], [], []
    sites = sorted({n.site_id for n in nodes})
    for seed in SEEDS:
        for tick_s in TICK_SPACINGS_S:
            rng = np.random.default_rng(seed * 1000 + tick_s)
            noise_rng = random.Random(seed * 7919 + tick_s)
            for site_id in sites:
                site_nodes = [n for n in nodes if n.site_id == site_id]
                for t_end, ov, suspect, amp, name in scenarios(world, site_nodes, rng):
                    base = _windows_with_bump(world, site_nodes, seed, tick_s, t_end, ov, suspect, amp)
                    labels = {n.id: label_for(world, n, t_end, ov, suspect, amp) for n in site_nodes}
                    variants = [(base, name)]
                    if name.startswith("sky"):
                        # Heavier smoke day than the scripted one: scaling every node together keeps the label
                        # (everyone climbing together is the sky) and stops the model reading raw level as fire.
                        k = float(rng.uniform(*SKY_SCALE_RANGE))
                        variants.append(({nid: [{**r, "pm25": r["pm25"] * k} for r in h] for nid, h in base.items()},
                                         name + "_scaled"))
                    for noise_mult, (variant, vname) in ((m, v) for m in NOISE_MULTIPLIERS for v in variants):
                        hists = {nid: [_noisy(r, noise_rng, noise_mult) for r in h] for nid, h in variant.items()}
                        for node in site_nodes:
                            label = labels[node.id]
                            if label is None:
                                continue
                            others = [hists[n.id] for n in site_nodes if n.id != node.id]
                            f = compute_features(hists[node.id], others)
                            X.append([f[k] for k in FEATURE_NAMES])
                            y.append(CLASSES.index(label))
                            scenario_names.append(vname)
    return np.asarray(X, dtype=float), np.asarray(y, dtype=int), scenario_names


def _windows_with_bump(world, nodes, seed, tick_s, t_end, ov, suspect, amp):
    ticks = np.arange(t_end - WINDOW_S, t_end + 1e-9, tick_s)
    histories: dict[str, list[dict]] = {}
    for node in nodes:
        hist = []
        for t in ticks:
            r = world.reading(node, float(t), ov, seed, sim_ts(world, float(t)))
            if node.id in suspect:
                r["pm25"] = r["pm25"] + _bump(float(t) - suspect[node.id], amp)
            hist.append(r)
        histories[node.id] = hist
    return histories


def softmax(z: np.ndarray) -> np.ndarray:
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def fit_logreg(Xz: np.ndarray, y: np.ndarray, n_classes: int) -> np.ndarray:
    """Multinomial logistic regression by full-batch gradient descent. Returns (classes, features+1) with bias last."""
    n, d = Xz.shape
    Xb = np.hstack([Xz, np.ones((n, 1))])
    W = np.zeros((n_classes, d + 1))
    Y = np.eye(n_classes)[y]
    # Class weights so the dominant "clear" class does not swamp the rarer fire/suspect windows.
    counts = np.bincount(y, minlength=n_classes).astype(float)
    sample_w = (n / (n_classes * counts))[y][:, None]
    for _ in range(EPOCHS):
        P = softmax(Xb @ W.T)
        grad = ((P - Y) * sample_w).T @ Xb / n + L2 * np.hstack([W[:, :-1], np.zeros((n_classes, 1))])
        W -= LR * grad
    return W


def evaluate(W, Xz, y, n_classes):
    pred = np.argmax(np.hstack([Xz, np.ones((len(Xz), 1))]) @ W.T, axis=1)
    cm = np.zeros((n_classes, n_classes), dtype=int)
    for t, p in zip(y, pred):
        cm[t, p] += 1
    return float((pred == y).mean()), cm


def main() -> dict:
    world = load_world()
    nodes = world.load_nodes(REPO / "shared" / "topology.json")
    X, y, names = build_dataset(world, nodes)
    rng = np.random.default_rng(2026)
    idx = rng.permutation(len(X))
    n_test = int(len(X) * HELD_OUT_FRACTION)
    test, train = idx[:n_test], idx[n_test:]
    means, stds = X[train].mean(axis=0), X[train].std(axis=0) + 1e-9
    Xz = (X - means) / stds
    W = fit_logreg(Xz[train], y[train], len(CLASSES))
    acc, cm = evaluate(W, Xz[test], y[test], len(CLASSES))
    train_acc, _ = evaluate(W, Xz[train], y[train], len(CLASSES))
    weights = {
        "classes": list(CLASSES),
        "features": list(FEATURE_NAMES),
        "means": means.tolist(),
        "stds": stds.tolist(),
        "coefs": W.tolist(),
        "drift": DRIFT,
        "training": {
            "date": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
            "source": "simulator/world.py reading() curves + one synthetic PM-only bump scenario for 'suspect'",
            "n_samples": int(len(X)),
            "n_train": int(len(train)),
            "n_test": int(len(test)),
            "class_counts": {c: int((y == i).sum()) for i, c in enumerate(CLASSES)},
            "accuracy_held_out": round(acc, 4),
            "accuracy_train": round(train_acc, 4),
            "confusion_matrix": {"rows": "true", "cols": "predicted", "classes": list(CLASSES), "matrix": cm.tolist()},
            "seeds": list(SEEDS),
            "tick_spacings_s": list(TICK_SPACINGS_S),
            "noise_multipliers": list(NOISE_MULTIPLIERS),
            "scenarios": sorted(set(names)),
            "augmentations": ["sky windows duplicated with every node's PM2.5 scaled by U(%g, %g)" % SKY_SCALE_RANGE],
            "model": "multinomial logistic regression, standardised features, class-weighted, L2=%g" % L2,
        },
    }
    WEIGHTS_PATH.write_text(json.dumps(weights, indent=1))
    print(json.dumps(weights["training"], indent=1))
    return weights


if __name__ == "__main__":
    main()
