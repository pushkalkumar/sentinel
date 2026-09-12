"""Hardware (Xenon) nodes are hidden from node lists unless they reported within HARDWARE_LIVE_S of wall time."""
import os

os.environ["SENTINEL_DB"] = "sqlite+aiosqlite:///:memory:"

import pytest
from httpx import ASGITransport, AsyncClient

from app.core import nodes as core_nodes
from app.core.nodes import HARDWARE_LIVE_S, hardware_reported_recently, is_hardware, visible_nodes
from app.models import Node
from app.state import state

T0 = 1_000_000.0
SIM_NODES = ("arts", "cafeteria", "field", "gym", "hub", "library", "parking", "science")


def _node(id_, neighbours=(), fw="0.9.2-sim"):
    return Node(id=id_, site_id=1, zone_id=1, label=id_, lat=0.0, lng=0.0, map_x=0.0, map_y=0.0,
                indoor=True, is_gateway=False, neighbours=list(neighbours), fw_version=fw)


def _reading(ts, node_id="xenon-a"):
    return {"node_id": node_id, "ts": ts, "pm1": 1.0, "pm25": 2.0, "pm10": 3.0, "temp_c": 22.0, "rh": 40.0,
            "mq2_raw": 200, "rssi": -60, "battery_pct": 98.0}


@pytest.fixture(autouse=True)
def clean_state():
    for nid in ("xenon-a", "xenon-b"):
        state.rings.pop(nid, None)
        state.latest.pop(nid, None)
    core_nodes._hardware_seen.clear()
    yield
    for nid in ("xenon-a", "xenon-b"):
        state.rings.pop(nid, None)
        state.latest.pop(nid, None)
    core_nodes._hardware_seen.clear()


@pytest.fixture
async def client():
    from app.main import app

    async with app.router.lifespan_context(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            yield c


def test_is_hardware_by_id_or_firmware():
    assert is_hardware(_node("xenon-a"))
    assert is_hardware(_node("board-9", fw="xenon-ble-0.1"))
    assert not is_hardware(_node("gym"))


def test_fake_ring_reading_expires_after_120s_wall_time():
    assert not hardware_reported_recently("xenon-a", now=T0)

    state.ring("xenon-a").append(_reading("2026-09-12T13:45:00.000Z"))
    assert hardware_reported_recently("xenon-a", now=T0)
    assert hardware_reported_recently("xenon-a", now=T0 + HARDWARE_LIVE_S)
    assert not hardware_reported_recently("xenon-a", now=T0 + HARDWARE_LIVE_S + 1)

    state.ring("xenon-a").append(_reading("2026-09-12T13:45:05.000Z"))
    assert hardware_reported_recently("xenon-a", now=T0 + 300)


def test_visible_nodes_hides_silent_hardware_and_shows_relay_neighbour():
    gym, a, b = _node("gym"), _node("xenon-a", ["xenon-b"]), _node("xenon-b", ["xenon-a", "hub"])
    nodes = [gym, a, b]

    assert [n.id for n in visible_nodes(nodes, now=T0)] == ["gym"]

    state.ring("xenon-a").append(_reading("2026-09-12T13:45:00.000Z"))
    assert [n.id for n in visible_nodes(nodes, now=T0)] == ["gym", "xenon-a", "xenon-b"]
    assert [n.id for n in visible_nodes(nodes, now=T0 + HARDWARE_LIVE_S + 1)] == ["gym"]


async def test_nodes_endpoint_hides_hardware_until_it_reports(client):
    res = await client.get("/api/nodes?site_id=1")
    assert res.status_code == 200, res.text
    ids = [n["id"] for n in res.json()["data"]]
    assert ids == sorted(SIM_NODES)

    state.ring("xenon-a").append(_reading("2026-09-12T13:45:00.000Z"))
    res = await client.get("/api/nodes?site_id=1")
    data = res.json()["data"]
    assert [n["id"] for n in data] == sorted(SIM_NODES + ("xenon-a", "xenon-b"))
    flags = {n["id"]: n["hardware"] for n in data}
    assert flags["xenon-a"] is True and flags["xenon-b"] is True and flags["gym"] is False
