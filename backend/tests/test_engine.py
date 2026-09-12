"""Engine unit tests: CONTRACT §7.2 gym-fire numbers, sky-vs-building, escalation, suspect debounce, WEA helpers."""
import os

os.environ.setdefault("SENTINEL_DB", "sqlite+aiosqlite:///:memory:")

from app.alerts.bands import DEFAULT_POLICY  # noqa: E402
from app.alerts.engine import evaluate
from app.alerts.wea import simplify_ring, truncate_words
from app.timefmt import iso_plus

T0 = "2026-09-12T14:30:00.000Z"


def reading(ts: str, pm25: float, temp_c: float = 21.5, mq2: int = 200) -> dict:
    return {"ts": ts, "pm1": pm25 * 0.62, "pm25": pm25, "pm10": pm25 * 1.3, "temp_c": temp_c, "rh": 45.0,
            "mq2_raw": mq2, "rssi": -70, "battery_pct": 100.0}


def history(pm25: float = 75.0, minutes: int = 30, temp_c: float = 21.5, mq2: int = 200) -> list[dict]:
    """30 s ticks ending 30 s before T0, oldest first."""
    steps = minutes * 2
    return [reading(iso_plus(T0, -30 * (steps - i)), pm25, temp_c, mq2) for i in range(steps)]


def neighbours(values: list[float]) -> list[dict]:
    return [{**reading(T0, v), "node_id": f"n{i}"} for i, v in enumerate(values)]


def test_gym_fire_numbers_open_local_fire():
    fire = reading(T0, 255.0, temp_c=27.5, mq2=500)
    decisions, record = evaluate(fire, history(), neighbours([75, 74, 76, 75, 108, 107, 73]), [], DEFAULT_POLICY, "unhealthy")
    opened = [d for d in decisions if d.action == "open"]
    assert [d.kind for d in opened] == ["LOCAL_FIRE"]
    assert opened[0].priority == 1
    assert "fire at this node, not the sky" in opened[0].reason
    assert record["branch"] == "LOCAL_FIRE"
    assert len(record["checks"]) == 4 and all(c["pass"] for c in record["checks"])
    assert record["ratio"] > 3


def test_every_node_rising_is_the_sky_not_a_fire():
    # Node jumped to 255 but so did every neighbour: ratio test fails, hazardous branch wins.
    smoke = reading(T0, 255.0, temp_c=27.5, mq2=500)
    decisions, record = evaluate(smoke, history(), neighbours([250, 248, 255, 252, 249]), [], DEFAULT_POLICY, "hazardous")
    assert all(d.kind != "LOCAL_FIRE" for d in decisions)
    assert [d.kind for d in decisions if d.action == "open"] == ["HAZARDOUS_SMOKE"]
    assert record["branch"] == "HAZARDOUS_SMOKE"


def test_jump_with_no_history_never_opens_fire():
    fire = reading(T0, 255.0, temp_c=27.5, mq2=500)
    decisions, record = evaluate(fire, [], neighbours([75, 74, 76]), [], DEFAULT_POLICY, None)
    assert decisions == []
    assert record["pm_rise"] == 0 and record["branch"] == "CLEAR"


def test_escalation_replaces_open_hazardous_smoke():
    fire = reading(T0, 255.0, temp_c=27.5, mq2=500)
    open_alerts = [{"kind": "HAZARDOUS_SMOKE", "priority": 2}]
    decisions, _ = evaluate(fire, history(), neighbours([75, 74, 76]), open_alerts, DEFAULT_POLICY, "unhealthy")
    actions = [(d.action, d.kind) for d in decisions]
    assert ("clear", "HAZARDOUS_SMOKE") in actions
    assert ("open", "LOCAL_FIRE") in actions
    opened = next(d for d in decisions if d.action == "open")
    assert opened.reason.startswith("Escalated from HAZARDOUS_SMOKE: ")


def test_local_smoke_suspect_needs_two_consecutive_readings():
    spike = reading(T0, 160.0)   # no heat, no gas, 2.1x neighbours
    first, record1 = evaluate(spike, history(), neighbours([75, 74, 76]), [], DEFAULT_POLICY, "unhealthy", 0)
    assert first == [] and record1["suspect_streak"] == 1
    second, record2 = evaluate(spike, history(), neighbours([75, 74, 76]), [], DEFAULT_POLICY, "unhealthy",
                               record1["suspect_streak"])
    assert [(d.action, d.kind, d.priority) for d in second] == [("open", "LOCAL_SMOKE_SUSPECT", 3)]
    assert record2["branch"] == "LOCAL_SMOKE_SUSPECT"


def test_local_fire_clears_after_three_quiet_minutes():
    quiet_hist = history(pm25=75.0)
    quiet = reading(T0, 76.0)
    decisions, record = evaluate(quiet, quiet_hist, neighbours([75, 74, 76]), [{"kind": "LOCAL_FIRE", "priority": 1}],
                                 DEFAULT_POLICY, "unhealthy")
    assert [(d.action, d.kind) for d in decisions] == [("clear", "LOCAL_FIRE")]
    assert record["branch"] == "CLEAR"


def test_open_fire_stays_reported_while_burning():
    burning = reading(T0, 255.0, temp_c=27.5, mq2=500)
    plateau = history(pm25=255.0, temp_c=27.5, mq2=500)   # pm_rise 0: rule no longer matches but fire is open
    decisions, record = evaluate(burning, plateau, neighbours([75, 74, 76]), [{"kind": "LOCAL_FIRE", "priority": 1}],
                                 DEFAULT_POLICY, "unhealthy")
    assert decisions == []
    assert record["branch"] == "LOCAL_FIRE"


def test_wea_truncation_and_polygon_cap():
    long_text = " ".join(["word"] * 40)
    cut = truncate_words(long_text, 90)
    assert len(cut) <= 90 and not cut.endswith(" ") and cut.endswith("word")
    ring = [[i / 1000.0, (i % 7) / 1000.0] for i in range(300)] + [[0.0, 0.0]]
    simplified, flag = simplify_ring(ring)
    assert flag is True and len(simplified) <= 100
    small = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]
    assert simplify_ring(small) == (small, False)


# ---------------------------------------------------------------- ingest pipeline (in-memory app)

from httpx import ASGITransport, AsyncClient  # noqa: E402

SIM_HEADERS = {"X-Sim-Key": "sentinel-sim"}
CAMPUS = {"hub": 0.7, "library": 0.7, "science": 0.7, "cafeteria": 0.7, "arts": 0.7, "gym": 0.7, "field": 1.0, "parking": 1.0}


def tick(ts: str, regional: float, fire_ramp: float = 0.0) -> list[dict]:
    rows = []
    for nid, factor in CAMPUS.items():
        pm = regional * factor + (180 * fire_ramp if nid == "gym" else 0)
        rows.append({"node_id": nid, "ts": ts, "pm1": pm * 0.62, "pm25": pm, "pm10": pm * 1.3,
                     "temp_c": 22 + (6 * fire_ramp if nid == "gym" else 0), "rh": 45,
                     "mq2_raw": int(180 + 0.3 * pm + (300 * fire_ramp if nid == "gym" else 0)),
                     "rssi": -70, "battery_pct": 100})
    return rows


async def test_ingest_pipeline_fire_sms_explain_wea_and_clear():
    from app.main import app
    from app.security import sign_token

    admin = {"Authorization": "Bearer " + sign_token({"uid": 1, "role": "admin", "tenant_id": 1, "site_id": 1, "name": "a"})}
    responder = {"Authorization": "Bearer " + sign_token({"uid": 2, "role": "responder", "tenant_id": 3, "name": "r"})}
    t0 = "2026-09-12T13:40:00.000Z"
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            for i in range(80):   # 40 sim min of rising regional smoke, 20 -> 75: moderate, usg, unhealthy
                res = await c.post("/api/ingest/telemetry", json=tick(iso_plus(t0, 30 * i), 20 + 55 * i / 80), headers=SIM_HEADERS)
                assert res.status_code == 200 and res.json()["data"]["accepted"] == 8
            card = (await c.get("/api/sites/1/decision-card", headers=admin)).json()["data"]
            assert card["band"] == "unhealthy" and card["node_id"] in ("field", "parking")
            assert card["headline"] == "Cancel outdoor practice and recess"

            t1 = iso_plus(t0, 30 * 80)
            for i in range(6):    # gym fire, 60 s ramp
                await c.post("/api/ingest/telemetry", json=tick(iso_plus(t1, 30 * i), 75, min(1.0, 30 * i / 60)), headers=SIM_HEADERS)
            open_alerts = (await c.get("/api/alerts?open=true&site_id=1", headers=admin)).json()["data"]
            fires = [a for a in open_alerts if a["kind"] == "LOCAL_FIRE"]
            assert len(fires) == 1 and fires[0]["node_id"] == "gym" and fires[0]["node_label"] == "Gymnasium"
            outbox = (await c.get("/api/sms/outbox?site_id=1", headers=admin)).json()["data"]
            assert outbox["count"] == 12 and "FIRE detected at Gymnasium" in outbox["messages"][0]["body"]
            explain = (await c.get("/api/nodes/gym/explain", headers=admin)).json()["data"]
            assert explain["branch"] == "LOCAL_FIRE" and len(explain["checks"]) >= 3
            draft = await c.get(f"/api/wea/draft?alert_id={fires[0]['id']}", headers=responder)
            data = draft.json()["data"]
            assert data["event_code"] == "FRW" and len(data["text_90"]) <= 90 and len(data["text_360"]) <= 360
            assert data["cap_xml"].startswith("<?xml") and data["disclaimer"]
            advisories = [a for a in open_alerts if a["kind"] == "ACTIVITY_ADVISORY"]
            assert advisories and card["log"][0]["text"].startswith("Practice cancelled")
            bad = await c.get(f"/api/wea/draft?alert_id={advisories[0]['id']}", headers=responder)
            assert bad.status_code == 409 and bad.json()["error"]["code"] == "INVALID_TRANSITION"

            t2 = iso_plus(t1, 30 * 6)
            for i in range(16):   # override decays over 120 s, engine clears ~3 min later
                await c.post("/api/ingest/telemetry", json=tick(iso_plus(t2, 30 * i), 75, max(0.0, 1 - 30 * i / 120)), headers=SIM_HEADERS)
            still_open = (await c.get("/api/alerts?open=true&site_id=1", headers=admin)).json()["data"]
            assert not [a for a in still_open if a["kind"] == "LOCAL_FIRE"]
            dup = await c.post("/api/ingest/telemetry", json=tick(t0, 60), headers=SIM_HEADERS)
            assert dup.json()["data"]["duplicates"] == 8
