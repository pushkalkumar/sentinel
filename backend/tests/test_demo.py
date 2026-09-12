"""Demo runner: the seven chapters run in order against the ASGI app with an in-memory DB and a stub simulator.

The stub answers /control and /relay like the real simulator, but instead of ticking on a clock it feeds the
telemetry each beat would have produced straight back into /api/ingest/telemetry, so the alert engine, decision
card and mesh log are the real ones. Only the clock is faked.
"""
import asyncio
import os

os.environ.setdefault("SENTINEL_DB", "sqlite+aiosqlite:///:memory:")

import httpx
import pytest
from fastapi import FastAPI, Request
from httpx import ASGITransport, AsyncClient

from app import demo
from app.security import sign_token
from app.timefmt import iso_plus

ADMIN = {"uid": 1, "role": "admin", "tenant_id": 1, "site_id": 1, "class_id": None, "name": "Dana"}
RESPONDER = {"uid": 2, "role": "responder", "tenant_id": 3, "site_id": None, "class_id": None, "name": "Reyes"}
TEACHER_3B = {"uid": 4, "role": "teacher", "tenant_id": 1, "site_id": 1, "class_id": 2, "name": "J. Lindqvist"}

SIM_HEADERS = {"X-Sim-Key": "sentinel-sim"}
DAY = "2026-09-12T"
CALM_T, SMOKE_T = 1800, 24900                     # 07:30 and 13:55 as seconds since 07:00
CAMPUS = {"hub": 0.7, "library": 0.7, "science": 0.7, "cafeteria": 0.7, "arts": 0.7, "gym": 0.7, "field": 1.0, "parking": 1.0}
TICK = 30


def auth(payload: dict) -> dict:
    return {"Authorization": f"Bearer {sign_token(payload)}"}


def sim_ts(t: int) -> str:
    return iso_plus(DAY + "07:00:00.000Z", t)


def tick(ts: str, regional: float, fire_ramp: float = 0.0) -> list[dict]:
    rows = []
    for nid, factor in CAMPUS.items():
        pm = regional * factor + (180 * fire_ramp if nid == "gym" else 0)
        rows.append({"node_id": nid, "ts": ts, "pm1": pm * 0.62, "pm25": pm, "pm10": pm * 1.3,
                     "temp_c": 22 + (6 * fire_ramp if nid == "gym" else 0), "rh": 45,
                     "mq2_raw": int(180 + 0.3 * pm + (300 * fire_ramp if nid == "gym" else 0)),
                     "rssi": -70, "battery_pct": 100})
    return rows


class StubSim:
    """Replays the simulator's control surface; every beat pushes its readings into the backend synchronously."""

    def __init__(self, backend: AsyncClient, db_lock: asyncio.Lock) -> None:
        self.backend = backend
        self.db_lock = db_lock
        self.t = CALM_T
        self.speed = 60
        self.playing = False
        self.fire_nodes: list[str] = []
        self.smoke = False
        self.regional = 5.0
        self.controls: list[dict] = []
        self.relays: list[dict] = []
        self.app = FastAPI()
        self.app.post("/control")(self.control)
        self.app.post("/relay")(self.relay)

    def state(self) -> dict:
        return {"connected": True, "playing": self.playing, "speed": self.speed, "sim_t": self.t,
                "sim_ts": sim_ts(self.t), "sim_clock": sim_ts(self.t)[11:16],
                "phase": "fire" if self.fire_nodes else ("smoke" if self.smoke else "calm"),
                "regional_pm25": self.regional,
                "overrides": {"fire_nodes": list(self.fire_nodes), "smoke_boost": self.smoke},
                "drop_rate": 0.0, "ttl": 8, "tick_s": TICK, "nodes": {}, "messages_in_flight": 0}

    async def feed(self, rows: list[dict]) -> None:
        res = await self.backend.post("/api/ingest/telemetry", json=rows, headers=SIM_HEADERS)
        assert res.status_code == 200, res.text

    async def control(self, request: Request) -> dict:
        body = await request.json()
        self.controls.append(body)
        action = body.get("action")
        if action == "play":
            self.playing = True
        elif action == "pause":
            self.playing = False
        elif action == "speed":
            self.speed = int(body["speed"])
        elif action == "jump":
            await self.jump(body["t"])
        elif action == "trigger_fire":
            await self.trigger_fire(body["node_id"])
        elif action == "clear":
            await self.clear()
        else:
            return {"ok": False, "data": None, "error": {"code": "VALIDATION_ERROR", "message": f"bad action {action}"}}
        return {"ok": True, "data": self.state(), "error": None}

    async def jump(self, target: str) -> None:
        if target == "calm":
            self.t, self.regional, self.fire_nodes, self.smoke = CALM_T, 5.0, [], False
            for i in range(8):    # 4 quiet minutes ending at 07:30 so rolling means exist
                await self.feed(tick(sim_ts(CALM_T - TICK * (7 - i)), 5.0))
        elif target == "smoke":
            self.smoke, self.regional = True, 75.0
            start = SMOKE_T - TICK * 40
            for i in range(41):   # 20 sim minutes of regional smoke rising 20 -> 75: the card ends "unhealthy"
                await self.feed(tick(sim_ts(start + TICK * i), 20 + 55 * i / 40))
            self.t = SMOKE_T
        else:
            raise ValueError(target)
        self.playing = True

    async def trigger_fire(self, node_id: str) -> None:
        self.fire_nodes = [node_id]
        for i in range(1, 7):     # 60 s ramp at the gym while the neighbours stay flat
            await self.feed(tick(sim_ts(self.t + TICK * i), self.regional, min(1.0, TICK * i / 60)))
        self.t += TICK * 6
        self.playing = True

    async def clear(self) -> None:
        self.fire_nodes, self.smoke = [], False
        for i in range(1, 15):    # fire decays over 2 min, sky clears over 3: the engine closes its own alerts
            ramp = max(0.0, 1 - TICK * i / 120)
            self.regional = max(5.0, 75 - 70 * i / 6)
            await self.feed(tick(sim_ts(self.t + TICK * i), self.regional, ramp))
        self.t += TICK * 14

    async def relay(self, request: Request) -> dict:
        """Two hops gym -> science -> hub. The relay task runs concurrently with the demo's polling, and on the
        in-memory DB every session shares one connection, so hold the lock the poll sessions take."""
        body = await request.json()
        self.relays.append(body)
        path = [body["origin_node"], "science", "hub"]
        async with self.db_lock:
            for hop_from, hop_to, status, delivered in (("gym", "science", "ok", False), ("science", "hub", "delivered", True)):
                res = await self.backend.post("/api/ingest/mesh-message", headers=SIM_HEADERS, json={
                    "msg_id": body["msg_id"], "origin_node": body["origin_node"], "kind": body["kind"],
                    "payload": body["payload"], "path": path, "ttl": 6, "delivered": delivered,
                    "hop": {"from": hop_from, "to": hop_to, "attempt": 1, "status": status},
                })
                assert res.status_code == 200, res.text
        return {"ok": True, "data": {"queued": True}, "error": None}


class LockedSessionFactory:
    """`async with factory() as session` that also holds `lock`: the demo's poll sessions never roll back the
    shared in-memory connection while the stub's relay task is mid-write."""

    def __init__(self, inner, lock: asyncio.Lock) -> None:
        self.inner, self.lock = inner, lock

    def __call__(self):
        return _LockedSession(self.inner(), self.lock)


class _LockedSession:
    def __init__(self, session, lock: asyncio.Lock) -> None:
        self.session, self.lock = session, lock

    async def __aenter__(self):
        await self.lock.acquire()
        return await self.session.__aenter__()

    async def __aexit__(self, *exc):
        try:
            return await self.session.__aexit__(*exc)
        finally:
            self.lock.release()


@pytest.fixture
async def client(monkeypatch):
    from app.main import app

    monkeypatch.setattr(demo, "PACE_S", 0.0)
    db_lock = asyncio.Lock()
    monkeypatch.setattr(demo, "SessionLocal", LockedSessionFactory(demo.SessionLocal, db_lock))
    real_client = httpx.AsyncClient
    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            stub = StubSim(c, db_lock)

            def to_stub(**kwargs):
                kwargs.pop("transport", None)
                return real_client(transport=ASGITransport(app=stub.app), base_url="http://sim", **kwargs)

            monkeypatch.setattr(httpx, "AsyncClient", to_stub)   # app.core.sim and app.core.mesh resolve it at call time
            c.stub = stub
            yield c
            monkeypatch.setattr(httpx, "AsyncClient", real_client)
            await c.post("/api/demo/reset", headers=auth(ADMIN))


async def run(client: AsyncClient, chapter: str, who: dict = ADMIN) -> dict:
    res = await client.post("/api/demo/chapter", json={"id": chapter}, headers=auth(who))
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["id"] == chapter
    return data


async def test_script_lists_seven_chapters_in_order_and_is_operator_only(client):
    res = await client.get("/api/demo/script", headers=auth(ADMIN))
    assert res.status_code == 200
    chapters = res.json()["data"]
    assert [c["id"] for c in chapters] == ["calm", "smoke", "fire", "report", "responder", "drill", "allclear"]
    assert all(c["title"] and c["caption"] and c["duration_s"] > 0 for c in chapters)

    assert (await client.get("/api/demo/script", headers=auth(RESPONDER))).status_code == 200
    assert (await client.get("/api/demo/script", headers=auth(TEACHER_3B))).status_code == 403
    assert (await client.get("/api/demo/script")).status_code == 401

    unknown = await client.post("/api/demo/chapter", json={"id": "encore"}, headers=auth(ADMIN))
    assert unknown.status_code == 404 and unknown.json()["error"]["code"] == "NOT_FOUND"


async def test_chapters_run_in_order_and_rerun_safely(client):
    stub = client.stub

    calm = await run(client, "calm")
    after = calm["state_after"]
    assert after["sim"]["playing"] is True and after["sim"]["speed"] == 60 and after["sim"]["sim_clock"] == "07:30"
    assert after["sim"]["overrides"] == {"fire_nodes": [], "smoke_boost": False}
    assert after["band"] == "good" and after["alerts"] == []
    assert after["incident"] is None and after["drill"] is None
    assert [c["action"] for c in stub.controls] == ["jump", "speed", "play"]

    smoke = await run(client, "smoke")
    assert smoke["result"]["card_flipped"] is True
    after = smoke["state_after"]
    assert after["band"] == "unhealthy" and after["sim"]["sim_clock"] == "13:55"
    assert [a["kind"] for a in after["alerts"]] == ["ACTIVITY_ADVISORY"]

    fire = await run(client, "fire")
    assert fire["result"]["triggered"] is True and fire["result"]["local_fire"] is True
    assert fire["result"]["history_ready"] is True              # 20 min of smoke readings sat in the ring first
    after = fire["state_after"]
    assert after["sim"]["overrides"]["fire_nodes"] == ["gym"]
    kinds = {(a["kind"], a["node_id"]) for a in after["alerts"]}
    assert ("LOCAL_FIRE", "gym") in kinds
    assert after["alerts"][0]["kind"] == "LOCAL_FIRE"          # priority order: the fire outranks the advisory

    # re-running 'fire' while the gym burns must not light it twice
    again = await run(client, "fire")
    assert again["result"]["triggered"] is False and again["result"]["alert_id"] == fire["result"]["alert_id"]
    assert sum(1 for c in stub.controls if c.get("action") == "trigger_fire") == 1

    report = await run(client, "report")
    assert report["result"]["created"] is True and report["result"]["relayed"] is True
    code = report["result"]["code"]
    assert report["result"]["trust_label"] == "verified" and report["result"]["trust_score"] >= 70
    inc = report["state_after"]["incident"]
    assert inc["code"] == code and inc["status"] == "received"
    assert inc["type"] == "trapped" and inc["count"] == 2 and inc["text"] == "Gym storage room, door jammed"
    assert inc["node_label"] == "Gymnasium"
    assert inc["mesh"]["delivered"] is True and inc["mesh"]["path"] == ["gym", "science", "hub"] and inc["mesh"]["hops"] == 2
    assert [e["action"] for e in inc["events"]] == ["created", "relayed"]
    assert len(stub.relays) == 1 and stub.relays[0]["payload"]["code"] == code

    # the open report is reused, not duplicated
    again = await run(client, "report")
    assert again["result"]["created"] is False and again["result"]["code"] == code
    assert len(stub.relays) == 1

    responder = await run(client, "responder", who=RESPONDER)
    assert responder["result"] == {"code": code, "applied": ["acknowledge", "en_route", "resolve"], "status": "resolved"}
    inc = responder["state_after"]["incident"]
    assert inc["status"] == "resolved"
    events = [(e["action"], e["note"]) for e in inc["events"]]
    assert events[-1] == ("resolve", "Crew 3 walked both out")
    assert events[-2][0] == "en_route" and events[-2][1]
    assert events[-3] == ("acknowledge", "")
    assert all(e["actor_name"].startswith("Lt. Marcus Reyes") for e in inc["events"][-3:])
    audit = (await client.get("/api/responder/audit", headers=auth(RESPONDER))).json()["data"]["events"]
    assert {ev["ip"] for ev in audit if ev["incident_code"] == code and ev["actor_role"] == "responder"} == {demo.DEMO_IP}

    drill = await run(client, "drill")
    assert drill["result"]["created"] is True
    assert drill["result"]["summary"] == {
        "classes": 6, "submitted": 6, "matched": 4, "with_missing": 2, "pending": 0,
        "present_total": 165, "missing_total": 3, "roster_total": 168,
    }
    drill_id = drill["result"]["drill_id"]
    full = (await client.get(f"/api/drills/{drill_id}", headers=auth(ADMIN))).json()["data"]
    assert full["ended_at"] is not None
    by_name = {c["name"]: c for c in full["classes"]}
    assert by_name["5A"]["rollcall"]["missing_refs"] == ["S-5A-12"] and by_name["5A"]["state"] == "missing"
    assert by_name["3B"]["rollcall"]["missing_refs"] == ["S-3B-07", "S-3B-19"] and by_name["3B"]["rollcall"]["present"] == 28
    assert {n for n, c in by_name.items() if c["state"] == "matched"} == {"3A", "4A", "4B", "5B"}
    assert all(c["rollcall"]["node_id"] == c["muster_node_id"] for c in full["classes"])
    assert (await client.get("/api/drills/active?site_id=1", headers=auth(ADMIN))).json()["data"] is None
    assert drill["state_after"]["drill"]["id"] == drill_id and drill["state_after"]["drill"]["ended_at"]

    allclear = await run(client, "allclear")
    assert allclear["result"] == {"alerts_cleared": True, "advisory_open": False}
    after = allclear["state_after"]
    assert after["alerts"] == [] and after["sim"]["overrides"] == {"fire_nodes": [], "smoke_boost": False}
    assert after["band"] in ("good", "moderate", "usg")        # practice is back on; the 10-min mean is still decaying
    assert after["incident"]["status"] == "resolved" and after["drill"]["id"] == drill_id


async def test_calm_resets_an_open_drill_and_incident(client):
    await run(client, "calm")
    await run(client, "smoke")
    await run(client, "fire")
    report = await run(client, "report")
    code = report["result"]["code"]
    drill = (await client.post("/api/drills", json={"site_id": 1, "kind": "fire"}, headers=auth(ADMIN))).json()["data"]

    calm = await run(client, "calm")
    assert calm["result"] == {"drill_ended": drill["id"], "incident_resolved": code}
    after = calm["state_after"]
    assert after["alerts"] == [] and after["incident"]["status"] == "resolved" and after["drill"]["ended_at"]
    assert after["sim"]["sim_clock"] == "07:30"
    inc = (await client.get(f"/api/incidents/{code}", headers=auth(RESPONDER))).json()["data"]
    assert inc["status"] == "resolved" and inc["events"][-1]["note"] == "Demo reset"


async def test_reset_removes_demo_rows_keeps_seed_and_is_idempotent(client):
    for chapter in ("calm", "smoke", "fire", "report", "responder", "drill"):
        await run(client, chapter)
    code = (await client.get("/api/incidents?status=all", headers=auth(RESPONDER))).json()["data"]["incidents"][0]["code"]

    first = (await client.post("/api/demo/reset", headers=auth(ADMIN))).json()["data"]
    assert first["deleted"]["incidents"] == [code] and len(first["deleted"]["drills"]) == 1
    assert first["state_after"]["incident"] is None and first["state_after"]["drill"] is None
    assert first["state_after"]["alerts"] == [] and first["state_after"]["sim"]["sim_clock"] == "07:30"

    assert (await client.get(f"/api/incidents/{code}", headers=auth(RESPONDER))).status_code == 404
    assert (await client.get("/api/drills?site_id=1", headers=auth(ADMIN))).json()["data"] == []
    mesh_rows = (await client.get("/api/mesh/log?limit=100", headers=auth(ADMIN))).json()["data"]["entries"]
    assert not [r for r in mesh_rows if (r.get("payload") or {}).get("code") == code]

    # seed rows are untouched: users still log in, classes and rosters still size the drill summary
    login = await client.post("/api/auth/login", json={"email": "admin@sentinel.demo", "password": "sentinel"})
    assert login.status_code == 200
    fresh = (await client.post("/api/drills", json={"site_id": 1, "kind": "fire"}, headers=auth(ADMIN))).json()["data"]
    assert fresh["summary"]["classes"] == 6 and fresh["summary"]["roster_total"] == 168
    await client.post(f"/api/drills/{fresh['id']}/end", headers=auth(ADMIN))

    second = (await client.post("/api/demo/reset", headers=auth(ADMIN))).json()["data"]
    assert second["deleted"] == {"incidents": [], "drills": []} and second["drill_ended"] is None
    assert second["state_after"]["incident"] is None and second["state_after"]["alerts"] == []
    assert second["state_after"]["sim"]["sim_clock"] == "07:30"
    assert second["state_after"]["drill"]["id"] == fresh["id"]      # a hand-started drill is not demo data

    # a fresh story after reset starts from nothing
    report = await run(client, "report")
    assert report["result"]["created"] is True and report["result"]["code"] != code
