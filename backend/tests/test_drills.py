import os

os.environ.setdefault("SENTINEL_DB", "sqlite+aiosqlite:///:memory:")

import time
from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.db import SessionLocal
from app.models import DecisionLog, Node, Reading
from app.security import sign_token
from app.timefmt import fmt_iso
from sqlalchemy import delete, select

ADMIN = {"uid": 1, "role": "admin", "tenant_id": 1, "site_id": 1, "class_id": None, "name": "Dana"}
OPS_ADMIN = {"uid": 9, "role": "admin", "tenant_id": 2, "site_id": 2, "class_id": None, "name": "Priya"}
TEACHER_3B = {"uid": 4, "role": "teacher", "tenant_id": 1, "site_id": 1, "class_id": 2, "name": "J. Lindqvist"}
RESPONDER = {"uid": 2, "role": "responder", "tenant_id": 3, "site_id": None, "class_id": None, "name": "Reyes"}


def auth(payload: dict) -> dict:
    return {"Authorization": f"Bearer {sign_token(payload)}"}


@pytest.fixture
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c
            # leave no open drill behind so tests stay independent of ordering
            res = await c.get("/api/drills/active?site_id=1", headers=auth(ADMIN))
            if res.status_code == 200 and res.json()["data"]:
                await c.post(f"/api/drills/{res.json()['data']['id']}/end", headers=auth(ADMIN))


async def start_drill(client: AsyncClient, site_id: int = 1) -> dict:
    res = await client.post("/api/drills", json={"site_id": site_id, "kind": "fire"}, headers=auth(ADMIN))
    assert res.status_code == 201, res.text
    return res.json()["data"]


async def test_create_drill_returns_full_shape_and_conflicts_on_second(client):
    drill = await start_drill(client)
    assert drill["ended_at"] is None and drill["kind"] == "fire" and drill["is_real"] is False
    assert drill["summary"] == {
        "classes": 6, "submitted": 0, "matched": 0, "with_missing": 0, "pending": 6,
        "present_total": 0, "missing_total": 0, "roster_total": 168,
    }
    assert [c["name"] for c in drill["classes"]] == ["3A", "3B", "4A", "4B", "5A", "5B"]
    assert all(c["state"] == "pending" and c["rollcall"] is None for c in drill["classes"])
    assert drill["missing"] == []

    dup = await client.post("/api/drills", json={"site_id": 1, "kind": "fire"}, headers=auth(ADMIN))
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "CONFLICT"

    active = await client.get("/api/drills/active?site_id=1", headers=auth(TEACHER_3B))
    assert active.json()["data"]["id"] == drill["id"]

    listing = await client.get("/api/drills?site_id=1", headers=auth(RESPONDER))
    assert listing.status_code == 200
    head = listing.json()["data"][0]
    assert head["id"] == drill["id"] and "classes" not in head and "summary" in head


async def test_rollcall_flow_and_validation(client):
    drill = await start_drill(client)
    url = f"/api/drills/{drill['id']}/rollcall"

    res = await client.post(url, json={"class_id": 2, "node_id": "field", "present": 28,
                                       "missing_refs": ["S-3B-07", "S-3B-19"]}, headers=auth(TEACHER_3B))
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert data["summary"]["with_missing"] == 1 and data["summary"]["submitted"] == 1
    assert data["summary"]["present_total"] == 28 and data["summary"]["missing_total"] == 2
    assert len(data["missing"]) == 2
    assert data["missing"][0] == {"student_ref": "S-3B-07", "class_name": "3B", "node_label": "Athletic Field"}
    row = next(c for c in data["classes"] if c["class_id"] == 2)
    assert row["state"] == "missing" and row["rollcall"]["node_label"] == "Athletic Field"
    assert row["rollcall"]["elapsed_s"] >= 0

    bad = await client.post(url, json={"class_id": 2, "node_id": "field", "present": 27,
                                       "missing_refs": ["S-3B-07"]}, headers=auth(TEACHER_3B))
    assert bad.status_code == 422
    assert bad.json()["error"]["code"] == "VALIDATION_ERROR"
    assert bad.json()["error"]["message"] == "present + missing must equal roster size 30"

    off_roster = await client.post(url, json={"class_id": 2, "node_id": "field", "present": 29,
                                              "missing_refs": ["S-9Z-99"]}, headers=auth(TEACHER_3B))
    assert off_roster.status_code == 422 and off_roster.json()["error"]["code"] == "VALIDATION_ERROR"

    bad_node = await client.post(url, json={"class_id": 2, "node_id": "nope", "present": 30,
                                            "missing_refs": []}, headers=auth(TEACHER_3B))
    assert bad_node.status_code == 422

    wrong_class = await client.post(url, json={"class_id": 1, "node_id": "field", "present": 28,
                                               "missing_refs": []}, headers=auth(TEACHER_3B))
    assert wrong_class.status_code == 403 and wrong_class.json()["error"]["code"] == "FORBIDDEN"

    # resubmission updates the same row (UniqueConstraint), admin may submit any class
    again = await client.post(url, json={"class_id": 2, "node_id": "field", "present": 30,
                                         "missing_refs": []}, headers=auth(ADMIN))
    assert again.status_code == 200
    row = next(c for c in again.json()["data"]["classes"] if c["class_id"] == 2)
    assert row["state"] == "matched" and again.json()["data"]["summary"]["submitted"] == 1
    assert again.json()["data"]["missing"] == []

    responder = await client.post(url, json={"class_id": 1, "node_id": "field", "present": 28,
                                             "missing_refs": []}, headers=auth(RESPONDER))
    assert responder.status_code == 403


async def test_end_report_and_csv(client):
    drill = await start_drill(client)
    await client.post(f"/api/drills/{drill['id']}/rollcall", headers=auth(TEACHER_3B),
                      json={"class_id": 2, "node_id": "field", "present": 29, "missing_refs": ["S-3B-07"]})

    csv_res = await client.get(f"/api/export/drill/{drill['id']}.csv", headers=auth(ADMIN))
    assert csv_res.status_code == 200
    assert csv_res.headers["content-type"].startswith("text/csv")
    assert csv_res.headers["content-disposition"] == f'attachment; filename="sentinel-drill-{drill["id"]}.csv"'
    lines = csv_res.text.splitlines()
    assert lines[0] == "class,teacher,roster_size,present,missing_count,missing_refs,muster_node,submitted_at,elapsed_s"
    assert len(lines) == 7
    assert lines[1].startswith("3A,A. Okafor,28,,,,field,,")
    assert lines[2].startswith("3B,J. Lindqvist,30,29,1,S-3B-07,field,")

    teacher_csv = await client.get(f"/api/export/drill/{drill['id']}.csv", headers=auth(TEACHER_3B))
    assert teacher_csv.status_code == 403

    ended = await client.post(f"/api/drills/{drill['id']}/end", headers=auth(ADMIN))
    assert ended.status_code == 200 and ended.json()["data"]["ended_at"] is not None

    twice = await client.post(f"/api/drills/{drill['id']}/end", headers=auth(ADMIN))
    assert twice.status_code == 409 and twice.json()["error"]["code"] == "INVALID_TRANSITION"

    late = await client.post(f"/api/drills/{drill['id']}/rollcall", headers=auth(TEACHER_3B),
                             json={"class_id": 2, "node_id": "field", "present": 30, "missing_refs": []})
    assert late.status_code == 409 and late.json()["error"]["code"] == "INVALID_TRANSITION"

    report = await client.get(f"/api/drills/{drill['id']}/report", headers=auth(ADMIN))
    assert report.status_code == 200
    rep = report.json()["data"]
    assert rep["site"]["name"] == "Roosevelt High School"
    assert rep["started_by_name"] == "Dana Whitfield (Principal)"
    assert rep["compliance"]["statute"].startswith("RCW 28A.320.125")
    assert rep["compliance"]["all_classes_reported"] is False
    assert rep["compliance"]["time_to_full_rollcall_s"] is None
    assert rep["drill"]["id"] == drill["id"] and "classes" not in rep["drill"]
    assert len(rep["classes"]) == 6 and len(rep["missing"]) == 1
    assert rep["generated_at"].endswith("Z")

    assert (await client.get("/api/drills/active?site_id=1", headers=auth(ADMIN))).json()["data"] is None


async def test_tenant_gates(client):
    drill = await start_drill(client)
    other = await client.get(f"/api/drills/{drill['id']}", headers=auth(OPS_ADMIN))
    assert other.status_code == 403
    anon = await client.get(f"/api/drills/{drill['id']}")
    assert anon.status_code == 401
    missing = await client.get("/api/drills/999999", headers=auth(ADMIN))
    assert missing.status_code == 404 and missing.json()["error"]["code"] == "NOT_FOUND"
    teacher_create = await client.post("/api/drills", json={"site_id": 1, "kind": "fire"}, headers=auth(TEACHER_3B))
    assert teacher_create.status_code == 403


SIM_DAY = datetime(2026, 9, 12, 7, 0, tzinfo=timezone.utc)


async def seed_day(tick_s: int = 30, hours: float = 13.0) -> int:
    """One scripted day of readings for every site-1 node plus two decision-log rows."""
    async with SessionLocal() as session:
        node_ids = (await session.execute(select(Node.id).where(Node.site_id == 1))).scalars().all()
        await session.execute(delete(Reading))
        await session.execute(delete(DecisionLog))
        steps = int(hours * 3600 / tick_s)
        rows = []
        for i in range(steps):
            ts = fmt_iso(SIM_DAY + timedelta(seconds=i * tick_s))
            for n, node_id in enumerate(node_ids):
                pm = 8.0 + i * 0.1 + n
                rows.append(Reading(node_id=node_id, ts=ts, pm1=pm * 0.6, pm25=pm, pm10=pm * 1.3,
                                    temp_c=18.0 + i * 0.005, rh=50.0, mq2_raw=200, rssi=-70, battery_pct=99.0))
        session.add_all(rows)
        session.add(DecisionLog(site_id=1, band_from="moderate", band_to="usg", pm25=36.1, node_id="field",
                                guidance="Move sensitive groups indoors; limit intense practice to 60 min",
                                text="Practice limited 13:27, PM2.5 36 at Athletic Field",
                                changed_at=fmt_iso(SIM_DAY + timedelta(hours=6, minutes=27, seconds=30))))
        session.add(DecisionLog(site_id=1, band_from="usg", band_to="unhealthy", pm25=70.6, node_id="field",
                                guidance="Cancel outdoor practice and recess; PE indoors",
                                text="Practice cancelled 13:55, PM2.5 71 at Athletic Field",
                                changed_at=fmt_iso(SIM_DAY + timedelta(hours=6, minutes=55))))
        await session.commit()
        return len(node_ids)


async def test_timeline_decimates_in_sql_and_is_fast(client):
    node_count = await seed_day()
    started = time.perf_counter()
    res = await client.get("/api/timeline?site_id=1&step=300", headers=auth(ADMIN))
    elapsed = time.perf_counter() - started
    assert res.status_code == 200, res.text
    data = res.json()["data"]
    assert elapsed < 0.3, f"timeline took {elapsed:.3f}s"

    assert data["site_id"] == 1 and data["step_s"] == 300
    assert data["from"] == "2026-09-12T07:00:00.000Z"
    assert data["to"] == "2026-09-12T19:59:30.000Z"
    assert set(data) == {"site_id", "step_s", "from", "to", "sim_now", "readings", "alerts", "decisions", "incidents"}

    readings = data["readings"]
    buckets = 13 * 3600 // 300
    assert len(readings) == node_count * buckets
    first = readings[0]
    assert set(first) == {"node_id", "sim_ts", "pm25", "temp_c", "band"}
    assert first["sim_ts"] == "2026-09-12T07:00:00.000Z" and first["band"] in ("good", "moderate")
    per_node = {r["node_id"] for r in readings}
    assert len(per_node) == node_count
    # 10 raw readings per bucket, means land between the bucket's first and last sample
    gym = [r for r in readings if r["node_id"] == readings[0]["node_id"]]
    assert gym[0]["pm25"] < gym[1]["pm25"] < gym[-1]["pm25"]

    assert len(data["decisions"]) == 2
    assert data["decisions"][0]["node_label"] == "Athletic Field"
    assert data["decisions"][1]["band_to"] == "unhealthy" and data["decisions"][1]["at"] == "2026-09-12T13:55:00.000Z"
    assert data["alerts"] == [] and data["incidents"] == []


async def test_timeline_explicit_range_and_errors(client):
    await seed_day()
    res = await client.get("/api/timeline?site_id=1&step=600&from=2026-09-12T13:00:00.000Z&to=2026-09-12T14:00:00.000Z",
                           headers=auth(RESPONDER))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["from"] == "2026-09-12T13:00:00.000Z" and data["to"] == "2026-09-12T14:00:00.000Z"
    assert all("2026-09-12T13:" in r["sim_ts"] or r["sim_ts"] == "2026-09-12T14:00:00.000Z" for r in data["readings"])
    assert [d["at"][11:16] for d in data["decisions"]] == ["13:27", "13:55"]

    backwards = await client.get("/api/timeline?site_id=1&from=2026-09-12T15:00:00.000Z&to=2026-09-12T14:00:00.000Z",
                                 headers=auth(ADMIN))
    assert backwards.status_code == 422
    garbage = await client.get("/api/timeline?site_id=1&from=yesterday", headers=auth(ADMIN))
    assert garbage.status_code == 422 and garbage.json()["error"]["code"] == "VALIDATION_ERROR"
    other_tenant = await client.get("/api/timeline?site_id=2", headers=auth(ADMIN))
    assert other_tenant.status_code == 403
    zero_step = await client.get("/api/timeline?site_id=1&step=0", headers=auth(ADMIN))
    assert zero_step.status_code == 422


async def test_timeline_empty_site_has_sane_defaults(client):
    async with SessionLocal() as session:
        await session.execute(delete(Reading))
        await session.commit()
    res = await client.get("/api/timeline?site_id=2", headers=auth(OPS_ADMIN))
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["readings"] == [] and data["decisions"] == []
    assert data["from"] <= data["to"]
