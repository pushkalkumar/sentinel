"""Judge-walkthrough regressions: the 60x fire, site scoping, the rewind, the silent-node clear and sim reset.

Every test drives the real ingest pipeline; only the simulator's clock is stubbed. The in-memory database is
shared with the other test modules, so each test starts from `_fresh()` (the same wipe the reset action uses).
"""
import asyncio
import os

os.environ.setdefault("SENTINEL_DB", "sqlite+aiosqlite:///:memory:")

import httpx
import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app.core import sim as sim_mod
from app.db import SessionLocal
from app.security import sign_token
from app.timefmt import iso_plus

SIM_HEADERS = {"X-Sim-Key": "sentinel-sim"}
ADMIN = {"Authorization": "Bearer " + sign_token(
    {"uid": 1, "role": "admin", "tenant_id": 1, "site_id": 1, "name": "Dana"})}
WAREHOUSE_ADMIN = {"Authorization": "Bearer " + sign_token(
    {"uid": 9, "role": "admin", "tenant_id": 2, "site_id": 2, "name": "Priya"})}

CAMPUS = {"hub": 0.7, "library": 0.7, "science": 0.7, "cafeteria": 0.7, "arts": 0.7, "gym": 0.7,
          "field": 1.0, "parking": 1.0}
WAREHOUSE = ("w-a01", "w-a07", "w-a14", "w-b03", "w-b10", "w-dock")
T0 = "2026-09-12T13:40:00.000Z"
CALM_TS = "2026-09-12T07:30:00.000Z"


def reading(node_id: str, ts: str, pm25: float, temp_c: float = 22.0, mq2: int | None = None) -> dict:
    return {"node_id": node_id, "ts": ts, "pm1": pm25 * 0.62, "pm25": pm25, "pm10": pm25 * 1.3,
            "temp_c": temp_c, "rh": 45.0, "mq2_raw": int(180 + 0.3 * pm25) if mq2 is None else mq2,
            "rssi": -70, "battery_pct": 100.0}


def campus_tick(ts: str, regional: float, *, fire_ramp: float = 0.0, gym_pm: float | None = None,
                skip: tuple[str, ...] = ()) -> list[dict]:
    """One tick for site 1. fire_ramp raises the gym only; skip leaves a node silent."""
    rows = []
    for node_id, factor in CAMPUS.items():
        if node_id in skip:
            continue
        pm = regional * factor
        temp = 22.0
        mq2 = None
        if node_id == "gym":
            if gym_pm is not None:
                pm = gym_pm
            pm += 180 * fire_ramp
            temp = 22.0 + 6 * fire_ramp
            mq2 = int(180 + 0.3 * pm + 300 * fire_ramp)
        rows.append(reading(node_id, ts, pm, temp, mq2))
    return rows


def warehouse_tick(ts: str, pm25: float) -> list[dict]:
    return [reading(node_id, ts, pm25) for node_id in WAREHOUSE]


async def _fresh() -> None:
    """Wipe what earlier tests (and earlier beats) left behind, exactly as the reset action does."""
    async with SessionLocal() as session:
        await sim_mod._wipe_engine_rows(session)
        await session.commit()
    sim_mod._clear_runtime_state()


async def feed(client: AsyncClient, rows: list[dict]) -> dict:
    res = await client.post("/api/ingest/telemetry", json=rows, headers=SIM_HEADERS)
    assert res.status_code == 200, res.text
    return res.json()["data"]


async def open_alerts(client: AsyncClient, site_id: int = 1, headers: dict = ADMIN) -> list[dict]:
    res = await client.get(f"/api/alerts?site_id={site_id}", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()["data"]


class StubSim:
    """Answers /control and /relay like the simulator. jump calm rewinds the clock; nothing ticks on its own."""

    def __init__(self) -> None:
        self.t = 24900                      # 13:55
        self.playing = True
        self.controls: list[dict] = []
        self.app = FastAPI()
        self.app.post("/control")(self.control)
        self.app.post("/relay")(self.relay)

    def state(self) -> dict:
        return {"connected": True, "playing": self.playing, "speed": 60, "sim_t": self.t,
                "sim_ts": iso_plus("2026-09-12T07:00:00.000Z", self.t),
                "sim_clock": iso_plus("2026-09-12T07:00:00.000Z", self.t)[11:16],
                "phase": "calm", "regional_pm25": 6.0,
                "overrides": {"fire_nodes": [], "smoke_boost": False},
                "drop_rate": 0.0, "ttl": 8, "tick_s": 30, "nodes": {}, "messages_in_flight": 0}

    async def control(self, request: Request) -> dict:
        body = await request.json()
        self.controls.append(body)
        if body.get("action") == "jump":
            self.t = 1800 if body.get("t") == "calm" else 24900
            self.playing = True
        elif body.get("action") == "play":
            self.playing = True
        return {"ok": True, "data": self.state(), "error": None}

    async def relay(self, _request: Request) -> dict:
        return {"ok": True, "data": {"queued": True}, "error": None}


@pytest.fixture
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            await _fresh()
            yield c


@pytest.fixture
async def stub_client(client, monkeypatch):
    """`client` with the simulator stubbed, and the cached sim state primed at 13:55 so a jump reads as backward."""
    stub = StubSim()
    real = httpx.AsyncClient

    def to_stub(**kwargs):
        kwargs.pop("transport", None)
        return real(transport=ASGITransport(app=stub.app), base_url="http://sim", **kwargs)

    monkeypatch.setattr(httpx, "AsyncClient", to_stub)
    sim_mod.cache_sim_state(stub.state())
    client.stub = stub
    yield client
    monkeypatch.setattr(httpx, "AsyncClient", real)


# ---------------------------------------------------------------- judge item 1

async def test_fire_after_a_jump_opens_local_fire_within_three_readings(client):
    """60 s between readings (what 60x and 300x deliver) and only minutes of history: the fire must still open.

    At 60x the 5-minute and 2-minute lookbacks find nothing right after a jump. The engine falls back to the
    oldest recent sample and to the level checks (heat against the neighbours, gas over baseline), so the gym
    opens LOCAL_FIRE instead of the "no heat — ask staff to check" smoke suspect the judge saw.
    """
    jump_ts = "2026-09-12T13:55:00.000Z"
    for i in range(4):                       # 3 min of calm history, 60 s apart
        await feed(client, campus_tick(iso_plus(jump_ts, 60 * i), 50))
    assert not [a for a in await open_alerts(client) if a["kind"] != "ACTIVITY_ADVISORY"]

    fire_start = iso_plus(jump_ts, 60 * 4)
    kinds: list[str] = []
    for i, ramp in enumerate((0.5, 1.0, 1.0)):
        await feed(client, campus_tick(iso_plus(fire_start, 60 * i), 50, fire_ramp=ramp))
        kinds = [a["kind"] for a in await open_alerts(client)]
        if "LOCAL_FIRE" in kinds:
            break
    assert "LOCAL_FIRE" in kinds, f"after {len(kinds) and i + 1} readings the engine said {kinds}"

    fire = next(a for a in await open_alerts(client) if a["kind"] == "LOCAL_FIRE")
    assert fire["node_id"] == "gym" and fire["priority"] == 1
    assert fire["metrics"]["pm_rise"] > 40, fire["metrics"]
    assert fire["metrics"]["gas_delta"] > 150 or fire["metrics"]["temp_excess"] > 3, fire["metrics"]
    assert "ask staff to check" not in fire["reason"]

    explain = (await client.get("/api/nodes/gym/explain", headers=ADMIN)).json()["data"]
    assert explain["branch"] == "LOCAL_FIRE"
    rows = {c["name"]: c for c in explain["checks"]}
    assert rows["pm_rise"]["pass"] and rows["ratio"]["pass"], explain["checks"]
    # the heat-or-gas half of the rule has to show a row the judge can point at, not a silent 0
    heat_or_gas = [c for c in explain["checks"] if c["name"] in ("temp_rise", "temp_vs_neighbours", "gas_delta")]
    assert any(c["pass"] for c in heat_or_gas), explain["checks"]
    assert all(c["lhs"] != 0 for c in heat_or_gas), explain["checks"]


# ---------------------------------------------------------------- judge item 3

async def test_site_scoping_keeps_the_warehouse_off_the_school_card(client):
    """Both sites live at once, the warehouse far dirtier: the school's card, alerts and overview stay its own."""
    for i in range(8):
        ts = iso_plus(T0, 30 * i)
        await feed(client, campus_tick(ts, 20))              # school: good air
        await feed(client, warehouse_tick(ts, 60 + 10 * i))  # warehouse: climbing hard

    school = (await client.get("/api/sites/1/overview", headers=ADMIN)).json()["data"]
    school_nodes = {n["id"] for n in school["nodes"]}
    assert school_nodes == set(CAMPUS) | {"xenon-a", "xenon-b"}
    assert not school_nodes & set(WAREHOUSE)
    assert school["decision_card"]["site_id"] == 1
    assert school["decision_card"]["node_id"] in school_nodes
    assert all(a["site_id"] == 1 for a in school["open_alerts"])

    warehouse = (await client.get("/api/sites/2/overview", headers=WAREHOUSE_ADMIN)).json()["data"]
    assert warehouse["decision_card"]["site_id"] == 2
    assert warehouse["decision_card"]["node_id"] in set(WAREHOUSE)

    card = (await client.get("/api/sites/1/decision-card", headers=ADMIN)).json()["data"]
    assert card["node_id"] in school_nodes and card["node_label"] not in ("Aisle B / Rack 10",)

    # judge item 9: ?site_id= alone is what the banner reads - this site's open alerts, worst first, every zone.
    listed = await open_alerts(client)
    assert [a["id"] for a in listed] == [a["id"] for a in school["open_alerts"]]
    assert all(a["cleared_at"] is None and a["site_id"] == 1 for a in listed)
    assert [a["priority"] for a in listed] == sorted(a["priority"] for a in listed)
    assert {a["zone_id"] for a in listed} <= {z["id"] for z in school["zones"]}


# ---------------------------------------------------------------- judge items 2 and 6

async def test_rewind_closes_alerts_started_after_the_jump(client):
    await _open_gym_fire(client)
    fire = next(a for a in await open_alerts(client) if a["kind"] == "LOCAL_FIRE")

    async with SessionLocal() as session:
        events = await sim_mod.rewind_history(session, CALM_TS)
    kinds = [payload["kind"] for type_, payload in events if type_ == "alert_cleared"]
    assert "LOCAL_FIRE" in kinds, events

    after = await client.get("/api/alerts?site_id=1&open=false", headers=ADMIN)
    row = next(a for a in after.json()["data"] if a["id"] == fire["id"])
    assert row["cleared_at"] == CALM_TS
    assert row["reason"].startswith("Cleared: rewound to 07:30")
    assert not await open_alerts(client)


async def test_clear_check_runs_for_a_node_that_stopped_reporting(client):
    """The gym goes silent while the sky catches up: the clear check still closes its alert (judge item 6)."""
    await _open_gym_fire(client)
    assert [a["kind"] for a in await open_alerts(client) if a["node_id"] == "gym"] == ["LOCAL_FIRE"]

    quiet_start = iso_plus(T0, 30 * 13)
    for i in range(9):       # fire out, gym at 100 while neighbours sit at 35: still 2.9x, nothing clears
        await feed(client, campus_tick(iso_plus(quiet_start, 30 * i), 50, gym_pm=100))
    assert [a["kind"] for a in await open_alerts(client) if a["node_id"] == "gym"] == ["LOCAL_FIRE"]

    silent_start = iso_plus(quiet_start, 30 * 9)
    cleared = 0
    for i in range(4):       # gym reports nothing; the regional rises past 1.5x of its last reading
        result = await feed(client, campus_tick(iso_plus(silent_start, 30 * i), 150, skip=("gym",)))
        cleared += result["alerts_cleared"]
    assert cleared >= 1
    assert not [a for a in await open_alerts(client) if a["node_id"] == "gym"]

    node = (await client.get("/api/nodes/gym", headers=ADMIN)).json()["data"]
    assert node["status"] != "alert" and node["open_alerts"] == []


async def _open_gym_fire(client: AsyncClient) -> None:
    for i in range(10):
        await feed(client, campus_tick(iso_plus(T0, 30 * i), 50))
    for i in range(3):
        await feed(client, campus_tick(iso_plus(T0, 30 * (10 + i)), 50, fire_ramp=min(1.0, 0.5 + 0.5 * i)))
    assert [a["kind"] for a in await open_alerts(client) if a["node_id"] == "gym"] == ["LOCAL_FIRE"]


# ---------------------------------------------------------------- judge item 2: reset

async def test_reset_returns_the_demo_to_the_opening_beat(stub_client):
    client = stub_client
    await _open_gym_fire(client)

    inc = await client.post("/api/incidents", json={"type": "trapped", "count": 2, "text": "door jammed"},
                            headers={"X-Device-Fp": "demo-judge-phone", "X-Node-Id": "gym"})
    assert inc.status_code == 201, inc.text
    code = inc.json()["data"]["code"]
    drill = await client.post("/api/drills", json={"site_id": 1, "kind": "fire"}, headers=ADMIN)
    assert drill.status_code in (201, 409), drill.text
    await asyncio.sleep(0)   # let the fire-and-forget relay task reach the stub

    res = await client.post("/api/sim/control", json={"action": "reset"}, headers=ADMIN)
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert [c.get("action") for c in client.stub.controls[-2:]] == ["jump", "play"]
    assert client.stub.controls[-2].get("t") == "calm"
    assert data["sim_clock"] == "07:30" and data["playing"] is True
    assert data["reset"]["deleted"]["alerts"] >= 1 and data["reset"]["deleted"]["readings"] >= 1
    assert code in data["reset"]["incidents_resolved"]

    assert await open_alerts(client) == []
    assert (await client.get("/api/alerts?site_id=1&open=false", headers=ADMIN)).json()["data"] == []
    assert (await client.get("/api/sms/outbox?site_id=1", headers=ADMIN)).json()["data"]["count"] == 0
    assert (await client.get("/api/mesh/log", headers=ADMIN)).json()["data"]["entries"] == []
    assert (await client.get("/api/drills/active?site_id=1", headers=ADMIN)).json()["data"] is None
    assert (await client.get("/api/sites/1/decision-card", headers=ADMIN)).status_code == 404

    status = (await client.get(f"/api/incidents/{code}", headers={"X-Device-Fp": "demo-judge-phone"})).json()["data"]
    assert status["status"] == "resolved"
    assert any(ev["note"] == "Demo reset" or "resolved" in ev["note"].lower() for ev in status["timeline"])

    overview = (await client.get("/api/sites/1/overview", headers=ADMIN)).json()["data"]
    assert overview["open_alerts"] == [] and overview["open_incidents"] == []
    assert overview["decision_card"] is None and overview["active_drill"] is None
