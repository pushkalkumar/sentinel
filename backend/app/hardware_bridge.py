"""Serial bridge from the Xenon B gateway (hardware/xenon/node_b) to the backend ingest API.

Reads one JSON line per BLE message from the gateway's USB serial port and forwards:
  * telemetry  {"node":"xenon-a","seq":12,"temp_c":23.0,"batt_mv":4012,"rssi":-61,...}
      -> POST /api/ingest/telemetry as node "xenon-a"
  * button     {"kind":"button","msg_id":"m-3f9a","origin":"xenon-a","hop_count":1,"ttl":7,"rssi":-58}
      -> POST /api/ingest/mesh-message twice: xenon-a -> xenon-b (the real BLE hop, status ok)
         then xenon-b -> hub (this bridge, status delivered), so the map hop animation and mesh log
         show xenon-a -> xenon-b -> hub.

Timestamps: readings are stamped with the simulator's clock (GET /api/sim/state.sim_ts), not wall time.
The alert engine and the site band roll over "the latest reading ts"; a wall-clock reading from a real
board would make xenon-a the only node inside the rolling window and flap the site band. When the
simulator is down the bridge falls back to wall time.

Run:  cd backend && .venv/bin/python -m app.hardware_bridge [--port /dev/tty.usbmodemXXXX]
Never exits on serial or HTTP errors; Ctrl-C stops it.
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone

import httpx
import serial
from serial.tools import list_ports

log = logging.getLogger("sentinel.bridge")

PARTICLE_VID = 0x2B04
BAUD = 115200
FIELD_NODE = "xenon-a"
GATEWAY_NODE = "xenon-b"
SITE_GATEWAY = "hub"
HOP_PACE_S = 0.4              # same pacing as the simulator so the animation reads the same
HTTP_TIMEOUT_S = 3.0
SERIAL_RETRY_S = 2.0
PROBE_S = 7.0                 # node_b prints at least every 5 s; a silent Particle port is node_a
SIM_STATE_MAX_AGE_S = 2.0
# LiPo curve is not linear but for a demo readout this is honest enough: 3.3 V empty, 4.2 V full.
BATT_EMPTY_MV, BATT_FULL_MV = 3300, 4200


def wall_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def battery_pct(batt_mv: float) -> float:
    pct = (batt_mv - BATT_EMPTY_MV) / (BATT_FULL_MV - BATT_EMPTY_MV) * 100
    return round(max(0.0, min(100.0, pct)), 1)


def particle_ports() -> list[str]:
    return sorted(p.device for p in list_ports.comports() if p.vid == PARTICLE_VID)


def port_speaks_json(device: str) -> bool:
    try:
        with serial.Serial(device, BAUD, timeout=1) as ser:
            deadline = time.monotonic() + PROBE_S
            while time.monotonic() < deadline:
                line = ser.readline().decode("utf-8", "replace").strip()
                if line.startswith("{"):
                    return True
    except (serial.SerialException, OSError) as exc:
        log.warning("probe %s failed: %s", device, exc)
    return False


def autodetect_port() -> str | None:
    ports = particle_ports()
    if not ports:
        return None
    if len(ports) == 1:
        return ports[0]
    log.info("%d Particle ports (%s); probing for the one printing JSON", len(ports), ", ".join(ports))
    for device in ports:
        if port_speaks_json(device):
            return device
    return None


class Backend:
    def __init__(self, base_url: str, sim_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {"X-Sim-Key": sim_key}
        self.client = httpx.Client(base_url=self.base_url, timeout=HTTP_TIMEOUT_S)
        self._sim_ts: str | None = None
        self._sim_ts_at = 0.0

    def _reset(self) -> None:
        try:
            self.client.close()
        finally:
            self.client = httpx.Client(base_url=self.base_url, timeout=HTTP_TIMEOUT_S)

    def post(self, path: str, body: object) -> dict | None:
        """Returns the envelope `data` or None; never raises."""
        try:
            resp = self.client.post(path, json=body, headers=self.headers)
        except httpx.HTTPError as exc:
            log.warning("POST %s failed: %s", path, exc)
            self._reset()
            return None
        if resp.status_code != 200:
            log.warning("POST %s -> %d %s", path, resp.status_code, resp.text[:160])
            return None
        try:
            return resp.json().get("data")
        except ValueError:
            log.warning("POST %s -> non-JSON body", path)
            return None

    def reading_ts(self) -> tuple[str, str]:
        """(ts, clock_name). Sim clock when the simulator is connected, wall clock otherwise."""
        now = time.monotonic()
        if now - self._sim_ts_at < SIM_STATE_MAX_AGE_S and self._sim_ts:
            return self._sim_ts, "sim"
        try:
            data = self.client.get("/api/sim/state").json().get("data") or {}
        except (httpx.HTTPError, ValueError) as exc:
            log.warning("GET /api/sim/state failed: %s", exc)
            data = {}
        if data.get("connected") and data.get("sim_ts"):
            self._sim_ts, self._sim_ts_at = data["sim_ts"], now
            return self._sim_ts, "sim"
        return wall_now_iso(), "wall"


def telemetry_reading(msg: dict, ts: str) -> dict:
    # The Xenon has no PM, humidity or gas sensor; those fields are zero placeholders, not measurements.
    return {
        "node_id": FIELD_NODE, "ts": ts,
        "pm1": 0.0, "pm25": 0.0, "pm10": 0.0,
        "temp_c": float(msg.get("temp_c", 0.0)), "rh": 0.0, "mq2_raw": 0,
        "rssi": int(msg.get("rssi", -100)), "battery_pct": battery_pct(float(msg.get("batt_mv", 0))),
    }


def button_hops(msg: dict) -> list[dict]:
    base = {
        "msg_id": str(msg.get("msg_id", "m-0000"))[:16], "origin_node": FIELD_NODE, "kind": "button",
        "payload": {"press": msg.get("press"), "rssi": msg.get("rssi"), "radio": "ble", "source": "xenon"},
    }
    ttl = int(msg.get("ttl", 7))
    return [
        {**base, "path": [FIELD_NODE, GATEWAY_NODE], "ttl": ttl, "delivered": False,
         "hop": {"from": FIELD_NODE, "to": GATEWAY_NODE, "attempt": 1, "status": "ok"}},
        {**base, "path": [FIELD_NODE, GATEWAY_NODE, SITE_GATEWAY], "ttl": ttl - 1, "delivered": True,
         "hop": {"from": GATEWAY_NODE, "to": SITE_GATEWAY, "attempt": 1, "status": "delivered"}},
    ]


def handle_line(line: str, backend: Backend) -> None:
    try:
        msg = json.loads(line)
    except ValueError:
        log.info("skip non-JSON: %s", line[:120])
        return
    if not isinstance(msg, dict):
        return

    if msg.get("kind") == "button":
        hops = button_hops(msg)
        first = backend.post("/api/ingest/mesh-message", hops[0])
        time.sleep(HOP_PACE_S)
        second = backend.post("/api/ingest/mesh-message", hops[1])
        log.info("button %s press=%s rssi=%s -> %s -> %s -> %s (%s, %s)",
                 msg.get("msg_id"), msg.get("press"), msg.get("rssi"), FIELD_NODE, GATEWAY_NODE, SITE_GATEWAY,
                 "logged" if first else "hop1 failed", "delivered" if second else "hop2 failed")
        return

    if msg.get("node") == FIELD_NODE and "seq" in msg:
        ts, clock = backend.reading_ts()
        data = backend.post("/api/ingest/telemetry", telemetry_reading(msg, ts))
        outcome = "unreachable" if data is None else (
            "accepted" if data.get("accepted") else
            "duplicate ts (sim paused?)" if data.get("duplicates") else
            "rejected (node not seeded? run make seed)")
        log.info("telemetry seq=%s temp_c=%s batt_mv=%s rssi=%s ts=%s(%s) -> %s",
                 msg.get("seq"), msg.get("temp_c"), msg.get("batt_mv"), msg.get("rssi"), ts, clock, outcome)
        return

    log.info("gateway: %s", line[:160])


def run(port: str | None, backend: Backend) -> None:
    while True:
        device = port or autodetect_port()
        if device is None:
            log.warning("no Particle serial port found; retrying in %.0fs", SERIAL_RETRY_S)
            time.sleep(SERIAL_RETRY_S)
            continue
        try:
            with serial.Serial(device, BAUD, timeout=1) as ser:
                log.info("listening on %s -> %s", device, backend.base_url)
                while True:
                    raw = ser.readline()
                    if not raw:
                        continue
                    line = raw.decode("utf-8", "replace").strip()
                    if line:
                        handle_line(line, backend)
        except (serial.SerialException, OSError) as exc:
            log.warning("serial %s: %s; reconnecting in %.0fs", device, exc, SERIAL_RETRY_S)
            time.sleep(SERIAL_RETRY_S)
        except Exception:  # noqa: BLE001 - the bridge must outlive any single bad line
            log.exception("unexpected error; continuing")
            time.sleep(SERIAL_RETRY_S)


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Forward Xenon B serial JSON to the Sentinel backend")
    ap.add_argument("--port", help="gateway serial port, e.g. /dev/tty.usbmodem1401 (default: auto-detect)")
    ap.add_argument("--backend", default="http://127.0.0.1:8000", help="backend base URL")
    ap.add_argument("--sim-key", default=None, help="X-Sim-Key (default: SENTINEL_SIM_KEY or sentinel-sim)")
    args = ap.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(asctime)s bridge %(levelname)s %(message)s",
                        datefmt="%H:%M:%S")
    from app.config import settings
    backend = Backend(args.backend, args.sim_key or settings.sim_key)
    try:
        run(args.port, backend)
    except KeyboardInterrupt:
        log.info("stopped")
    return 0


if __name__ == "__main__":
    sys.exit(main())
