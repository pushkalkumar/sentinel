import os
import re

os.environ["SENTINEL_DB"] = "sqlite+aiosqlite:///:memory:"

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.trust import haversine, new_code, normalise_code, score_incident

CODE_RE = re.compile(r"^SN-[A-HJ-NP-Z2-9]{4}$")
GYM = {"id": "gym", "lat": 47.65443, "lng": -122.30136}
FIRE_LATEST = {"ts": "2026-09-12T14:30:30.000Z", "pm25": 247.1, "temp_c": 27.9, "mq2_raw": 492}
CALM_LATEST = {"ts": "2026-09-12T10:00:00.000Z", "pm25": 8.0, "temp_c": 21.0, "mq2_raw": 200}
FIRE_ALERT = {"kind": "LOCAL_FIRE", "priority": 1, "cleared_at": None}


def _score(**overrides):
    kwargs = dict(node=None, latest=None, history=[], open_alerts=[], crowd_devices=0, reporter_role=None,
                  lat=None, lng=None, false_flags=0, incident_type="trapped")
    kwargs.update(overrides)
    return score_incident(**kwargs)


# ---------------------------------------------------------------- trust (CONTRACT §4.3)

def test_trust_judge_at_gym_during_fire_is_verified_70():
    score, label, breakdown = _score(node=GYM, latest=FIRE_LATEST, open_alerts=[FIRE_ALERT])
    assert (score, label) == (70, "verified")
    assert [b["layer"] for b in breakdown] == ["proximity", "sensor", "crowd", "role", "gps", "history"]


def test_trust_second_judge_same_type_is_90():
    score, label, _ = _score(node=GYM, latest=FIRE_LATEST, open_alerts=[FIRE_ALERT], crowd_devices=1)
    assert (score, label) == (90, "verified")


def test_trust_library_during_calm_is_likely_40():
    score, label, _ = _score(node={"id": "library"}, latest=CALM_LATEST)
    assert (score, label) == (40, "likely")


def test_trust_internet_report_is_capped_unverified_0():
    score, label, breakdown = _score()
    assert (score, label) == (0, "unverified")
    assert breakdown[-1]["layer"] == "cap"


def test_trust_teacher_no_node_is_likely_50():
    score, label, breakdown = _score(reporter_role="teacher")
    assert (score, label) == (50, "likely")
    assert all(b["layer"] != "cap" for b in breakdown)


def test_trust_teacher_at_gym_during_fire_is_100():
    score, label, _ = _score(node=GYM, latest=FIRE_LATEST, open_alerts=[FIRE_ALERT], reporter_role="teacher")
    assert (score, label) == (100, "verified")


def test_trust_gps_far_penalty_and_history():
    score, _, breakdown = _score(node=GYM, latest=CALM_LATEST, lat=47.70, lng=-122.30, false_flags=1)
    gps = next(b for b in breakdown if b["layer"] == "gps")
    assert gps["points"] == -30
    assert score == 0


def test_trust_never_raises_on_garbage():
    score, label, breakdown = _score(node=object(), latest="nope", history=None, open_alerts=[1, 2])
    assert 0 <= score <= 100 and label in {"verified", "likely", "unverified"} and len(breakdown) >= 6


def test_new_code_and_normalise():
    code = new_code(set())
    assert CODE_RE.match(code)
    assert normalise_code(" 7k3f ") == "SN-7K3F"
    assert normalise_code("sn-7k3f") == "SN-7K3F"


def test_haversine_seattle_block():
    assert 90 < haversine(47.65443, -122.30136, 47.65533, -122.30136) < 110


# ---------------------------------------------------------------- HTTP flow

@pytest.fixture
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


async def _login(client, email):
    res = await client.post("/api/auth/login", json={"email": email, "password": "sentinel"})
    assert res.status_code == 200, res.text
    return res.json()["data"]["token"]


async def test_login_staff_me(client):
    token = await _login(client, "admin@sentinel.demo")
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["data"]["user"]["email"] == "admin@sentinel.demo"
    assert me.json()["data"]["user"]["site_id"] == 1

    bad = await client.post("/api/auth/login", json={"email": "admin@sentinel.demo", "password": "nope"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "UNAUTHORIZED"

    staff = await client.post("/api/auth/staff", json={"staff_code": "t-3b-7q2"})
    data = staff.json()["data"]
    assert staff.status_code == 200 and data["role"] == "teacher"
    assert data["class"]["roster_size"] == 30 and data["class"]["muster_node_id"] == "field"
    assert "active_drill" in data

    unknown = await client.post("/api/auth/staff", json={"staff_code": "T-0000"})
    assert unknown.status_code == 401


async def test_nodes_and_overview(client):
    from app.seed import load_topology

    seeded_nodes = sum(len(s["nodes"]) for s in load_topology()["sites"])
    res = await client.get("/api/nodes")
    assert res.status_code == 200 and len(res.json()["data"]) == seeded_nodes
    assert all(n["status"] == "offline" for n in res.json()["data"])

    gym = await client.get("/api/nodes/gym")
    data = gym.json()["data"]
    assert data["ssid"] == "SENTINEL-gym" and data["site"]["id"] == 1 and "text" in data["banner"]

    missing = await client.get("/api/nodes/nope")
    assert missing.status_code == 404

    token = await _login(client, "admin@sentinel.demo")
    ov = await client.get("/api/sites/1/overview", headers={"Authorization": f"Bearer {token}"})
    body = ov.json()["data"]
    site1_nodes = next(len(s["nodes"]) for s in load_topology()["sites"] if s["id"] == 1)
    assert len(body["nodes"]) == site1_nodes
    assert {n["site_id"] for n in body["nodes"]} == {1}
    assert ["hub", "library"] in body["links"] and ["library", "hub"] not in body["links"]
    assert body["stats"]["recipients"] == 24
    assert body["zones"][0]["node_ids"]

    other = await client.get("/api/sites/2/overview", headers={"Authorization": f"Bearer {token}"})
    assert other.status_code == 403

    readings = await client.get("/api/nodes/gym/readings", headers={"Authorization": f"Bearer {token}"})
    assert readings.json()["data"]["readings"] == []

    sites = await client.get("/api/sites", headers={"Authorization": f"Bearer {token}"})
    assert [s["id"] for s in sites.json()["data"]] == [1]


async def test_incident_lifecycle(client):
    headers = {"X-Device-Fp": "fp-test1", "X-Node-Id": "gym"}
    res = await client.post("/api/incidents", json={"type": "trapped", "count": 2}, headers=headers)
    assert res.status_code == 201, res.text
    created = res.json()["data"]
    code = created["code"]
    assert CODE_RE.match(code) and created["via"] == "node" and created["trust_label"] == "likely"

    no_fp = await client.post("/api/incidents", json={"type": "fire"}, headers={"X-Node-Id": "gym"})
    assert no_fp.status_code == 400 and no_fp.json()["error"]["code"] == "MISSING_DEVICE_FP"

    blocked = await client.post("/api/incidents", json={"type": "fire", "count": 1},
                                headers={"X-Device-Fp": "demo-blocked-device", "X-Node-Id": "gym"})
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "DEVICE_BLOCKED"

    bad_node = await client.post("/api/incidents", json={"type": "fire"},
                                 headers={"X-Device-Fp": "fp-x", "X-Node-Id": "nowhere"})
    assert bad_node.status_code == 422

    public = await client.get(f"/api/incidents/{code.lower()}", headers={"X-Device-Fp": "fp-test1"})
    pub = public.json()["data"]
    assert pub["status"] == "received" and "trust_breakdown" not in pub and pub["timeline"][0]["note"] == "Report received"

    short = await client.get(f"/api/incidents/{code[3:]}", headers={"X-Device-Fp": "fp-test1"})
    assert short.status_code == 200

    # mesh relay delivered -> relayed event + mesh summary
    relay = await client.post("/api/ingest/mesh-message", headers={"X-Sim-Key": "sentinel-sim"}, json={
        "msg_id": "m-4f9a1c2b", "origin_node": "gym", "kind": "incident",
        "payload": {"code": code, "type": "trapped", "count": 2},
        "path": ["gym", "science", "hub"], "hop": {"from": "science", "to": "hub", "attempt": 1, "status": "delivered"},
        "ttl": 6, "delivered": True,
    })
    assert relay.status_code == 200 and relay.json()["data"]["logged"] is True

    responder = await _login(client, "responder@sentinel.demo")
    rh = {"Authorization": f"Bearer {responder}"}
    full = (await client.get(f"/api/incidents/{code}", headers=rh)).json()["data"]
    assert full["mesh"] == {"msg_id": "m-4f9a1c2b", "path": ["gym", "science", "hub"], "delivered": True, "hops": 2}
    assert [e["action"] for e in full["events"]] == ["created", "relayed"]
    assert "2 hops" in full["events"][1]["note"]

    queue = (await client.get("/api/responder/incidents", headers=rh)).json()["data"]
    assert queue["count"] == 1 and queue["incidents"][0]["code"] == code

    admin = await _login(client, "admin@sentinel.demo")
    ah = {"Authorization": f"Bearer {admin}"}
    forbidden = await client.post(f"/api/incidents/{code}/events", headers=ah, json={"action": "resolve", "note": "nope"})
    assert forbidden.status_code == 403
    msg = await client.post(f"/api/incidents/{code}/events", headers=ah, json={"action": "message", "note": "Stay put."})
    assert msg.status_code == 200

    resolved = await client.post(f"/api/incidents/{code}/events", headers=rh,
                                 json={"action": "resolve", "note": "walked out"})
    assert resolved.status_code == 200 and resolved.json()["data"]["status"] == "resolved"

    again = await client.post(f"/api/incidents/{code}/events", headers=rh, json={"action": "acknowledge", "note": ""})
    assert again.status_code == 409 and again.json()["error"]["code"] == "INVALID_TRANSITION"

    audit = (await client.get("/api/responder/audit", headers=rh)).json()["data"]["events"]
    assert audit[0]["action"] == "resolve" and audit[0]["incident_code"] == code
    assert audit[0]["actor_name"].startswith("Lt. Marcus Reyes")

    listed = (await client.get("/api/incidents?status=all", headers=rh)).json()["data"]
    assert listed["count"] == 1
    assert (await client.get("/api/incidents", headers=rh)).json()["data"]["count"] == 0

    log = (await client.get("/api/mesh/log", headers=rh)).json()["data"]["entries"]
    assert log[0]["msg_id"] == "m-4f9a1c2b" and log[0]["status"] == "delivered"


async def test_flag_false_blocks_device_after_three(client):
    responder = await _login(client, "responder@sentinel.demo")
    rh = {"Authorization": f"Bearer {responder}"}
    for _ in range(3):
        res = await client.post("/api/incidents", json={"type": "other"},
                                headers={"X-Device-Fp": "fp-prankster", "X-Node-Id": "library"})
        assert res.status_code == 201
        code = res.json()["data"]["code"]
        flagged = await client.post(f"/api/incidents/{code}/events", headers=rh,
                                    json={"action": "flag_false", "note": "prank"})
        assert flagged.status_code == 200 and flagged.json()["data"]["status"] == "false"
    blocked = await client.post("/api/incidents", json={"type": "other"},
                                headers={"X-Device-Fp": "fp-prankster", "X-Node-Id": "library"})
    assert blocked.status_code == 403 and blocked.json()["error"]["code"] == "DEVICE_BLOCKED"


async def test_rate_limit_after_three_open(client):
    headers = {"X-Device-Fp": "fp-spammer"}
    for _ in range(3):
        assert (await client.post("/api/incidents", json={"type": "water"}, headers=headers)).status_code == 201
    limited = await client.post("/api/incidents", json={"type": "water"}, headers=headers)
    assert limited.status_code == 429 and limited.json()["error"]["code"] == "RATE_LIMITED"


async def test_sim_state_offline_and_control_gates(client):
    res = await client.get("/api/sim/state")
    assert res.status_code == 200 and res.json()["ok"] is True
    unauth = await client.post("/api/sim/control", json={"action": "play"})
    assert unauth.status_code == 401

    push = await client.post("/api/ingest/sim-state", headers={"X-Sim-Key": "sentinel-sim"},
                             json={"connected": True, "playing": True, "sim_t": 0, "sim_ts": "2026-09-12T07:00:00.000Z",
                                   "phase": "calm"})
    assert push.status_code == 200
    cached = (await client.get("/api/sim/state")).json()["data"]
    assert cached["connected"] is True and cached["phase"] == "calm"

    bad_key = await client.post("/api/ingest/sim-state", headers={"X-Sim-Key": "wrong"}, json={})
    assert bad_key.status_code == 401
