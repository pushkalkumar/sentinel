"""ML second opinion: gym-fire numbers -> fire, every node rising -> sky, calm -> clear, model card, drift flag."""
import os

os.environ.setdefault("SENTINEL_DB", "sqlite+aiosqlite:///:memory:")

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402

from app.ml.features import FEATURE_NAMES, compute_features  # noqa: E402
from app.ml.model import assess, drift, load_weights  # noqa: E402
from app.timefmt import iso_plus  # noqa: E402

T0 = "2026-09-12T14:30:00.000Z"


def reading(ts: str, pm25: float, temp_c: float = 21.5, mq2: int = 200, rh: float = 45.0) -> dict:
    return {"ts": ts, "pm25": pm25, "temp_c": temp_c, "rh": rh, "mq2_raw": mq2}


def flat(pm25: float, minutes: int = 30, temp_c: float = 21.5, mq2: int = 200, end: str = T0) -> list[dict]:
    steps = minutes * 2
    return [reading(iso_plus(end, -30 * (steps - i)), pm25, temp_c, mq2) for i in range(steps)]


def test_gym_fire_numbers_score_fire():
    history = flat(75.0) + [reading(T0, 255.0, temp_c=27.5, mq2=500, rh=32.0)]
    neighbours = [flat(v) + [reading(T0, v)] for v in (75, 74, 76, 75, 108, 107, 73)]
    features = compute_features(history, neighbours)
    assert set(features) == set(FEATURE_NAMES)
    assert features["pm_rise_5m"] > 150 and features["temp_rise_2m"] > 5 and features["ratio_to_neighbour_median"] > 3
    out = assess(features)
    assert out["p"]["fire"] > 0.8
    assert out["top_class"] == "fire" and len(out["top_features"]) == 3
    assert "synthetic" in out["basis"].lower() and "human_decides" in out


def test_every_node_rising_is_the_sky():
    history = flat(240.0) + [reading(T0, 255.0)]
    neighbours = [flat(v) + [reading(T0, v)] for v in (250, 248, 255, 252, 249)]
    out = assess(compute_features(history, neighbours))
    assert out["top_class"] == "sky"


def test_calm_morning_is_clear():
    history = flat(8.0) + [reading(T0, 8.4)]
    neighbours = [flat(v) + [reading(T0, v)] for v in (7.5, 8.2, 9.0, 8.1)]
    out = assess(compute_features(history, neighbours))
    assert out["top_class"] == "clear"
    assert abs(sum(out["p"].values()) - 1.0) < 1e-3


def test_steady_offset_flags_drift_but_rising_node_does_not():
    neighbours = [flat(v) for v in (20.0, 21.0, 19.5, 20.5)]
    steady = flat(52.0)
    flagged = drift(steady, neighbours)
    assert flagged["flagged"] is True and flagged["score"] > 3 and "drift" in flagged["note"]
    rising = [reading(r["ts"], 20.0 + i * 2.0) for i, r in enumerate(steady)]
    assert drift(rising, neighbours)["flagged"] is False


def test_weights_carry_training_metadata():
    tr = load_weights()["training"]
    for key in ("n_samples", "accuracy_held_out", "confusion_matrix", "date", "n_test"):
        assert key in tr
    assert tr["accuracy_held_out"] > 0.9


@pytest.mark.asyncio
async def test_model_card_and_assess_endpoints():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            card = await client.get("/api/ml/model-card")
            missing = await client.get("/api/ml/assess", params={"node_id": "nope"})
            gym = await client.get("/api/ml/assess", params={"node_id": "gym"})
            site = await client.get("/api/ml/assess-all", params={"site_id": 1})
    body = card.json()
    assert body["ok"] is True
    data = body["data"]
    for key in ("classes", "features", "training", "limits", "authority", "basis", "human_decides"):
        assert key in data
    assert data["authority"] == "rules decide, model advises"
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "NOT_FOUND"
    assert gym.status_code == 200 and gym.json()["data"]["rule_branch"] in {"CLEAR", "LOCAL_FIRE", "HAZARDOUS_SMOKE", "LOCAL_SMOKE_SUSPECT"}
    assert "agreement" in gym.json()["data"] and "human_decides" in gym.json()["data"]
    assert site.status_code == 200 and "disagreements" in site.json()["data"]
