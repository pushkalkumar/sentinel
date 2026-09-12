"""Sentinel simulator entrypoint (CONTRACT §7).

Run standalone: `../backend/.venv/bin/python main.py [--speed 60] [--seed 42]`.
Starts paused at 07:30. Never crashes when the backend is down; reconnects on its own.
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import time
from datetime import datetime, timezone
from pathlib import Path

from backend_client import BackendClient
from clock import SPEEDS, TICK_S, SimClock, parse_jump, parse_speed
from control import start_server
from mesh import Mesh
from world import NodeInfo, Overrides, load_nodes, phase, reading, regional_pm25

SIM_DIR = Path(__file__).resolve().parent
TOPOLOGY_PATH = SIM_DIR.parent / "shared" / "topology.json"

LOOP_PERIOD_S = 0.05
STATE_PUSH_PERIOD_S = 1.0
MAX_TICKS_PER_LOOP = 4       # after a stall, do not flood the backend with catch-up ticks
TELEMETRY_QUEUE_MAX = 20

log = logging.getLogger("sim")


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def parse_args() -> argparse.Namespace:
    load_env_file(SIM_DIR / ".env")
    p = argparse.ArgumentParser(description="Sentinel simulator")
    p.add_argument("--backend", default=os.getenv("SENTINEL_BACKEND", "http://127.0.0.1:8000"))
    p.add_argument("--sim-key", default=os.getenv("SENTINEL_SIM_KEY", "sentinel-sim"))
    p.add_argument("--speed", type=float, default=float(os.getenv("SIM_SPEED", "60")))
    p.add_argument("--drop", type=float, default=float(os.getenv("SIM_DROP", "0.15")))
    p.add_argument("--seed", type=int, default=int(os.getenv("SIM_SEED", "42")))
    p.add_argument("--control-port", type=int, default=int(os.getenv("SIM_CONTROL_PORT", "8001")))
    p.add_argument("--verbose", action="store_true")
    return p.parse_args()


def wall_ts() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


class Simulator:
    def __init__(self, args: argparse.Namespace) -> None:
        self.seed = args.seed
        self.nodes: list[NodeInfo] = load_nodes(TOPOLOGY_PATH)
        self.clock = SimClock(speed=args.speed if args.speed in SPEEDS else 60.0)
        self.overrides = Overrides()
        self.client = BackendClient(args.backend, args.sim_key)
        self.mesh = Mesh(self.nodes, self.client, drop_rate=args.drop, seed=args.seed)
        self.control_port = args.control_port
        self.latest: dict[str, dict] = {}
        self.next_tick_t = self.clock.next_tick_after(self.clock.sim_t)
        self._telemetry_q: asyncio.Queue[list[dict]] = asyncio.Queue(maxsize=TELEMETRY_QUEUE_MAX)
        self._state_push_wanted = asyncio.Event()

    # ---- SimState (§7.4) ------------------------------------------------ #
    def state(self) -> dict:
        t = self.clock.sim_t
        self.overrides.prune(t)
        regional = regional_pm25(t)
        return {
            "connected": self.client.connected,
            "playing": self.clock.playing,
            "speed": int(self.clock.speed),
            "sim_t": int(t),
            "sim_ts": self.clock.sim_ts(),
            "sim_clock": self.clock.sim_clock(),
            "phase": phase(t, self.overrides),
            "regional_pm25": round(regional + self.overrides.smoke_boost(t, regional), 1),
            "overrides": {"fire_nodes": self.overrides.fire_nodes, "smoke_boost": self.overrides.smoke_active},
            "drop_rate": self.mesh.drop_rate,
            "ttl": 8,
            "tick_s": TICK_S,
            "nodes": {nid: {"pm25": r["pm25"], "temp_c": r["temp_c"], "mq2_raw": r["mq2_raw"]}
                      for nid, r in self.latest.items()},
            "messages_in_flight": self.mesh.in_flight,
            "wall_ts": wall_ts(),
        }

    # ---- control (§3.7 / §7.5) ------------------------------------------ #
    async def apply_control(self, body: dict) -> dict:
        action = body.get("action")
        t = self.clock.sim_t
        if action == "play":
            self.clock.playing = True
        elif action == "pause":
            self.clock.playing = False
        elif action == "speed":
            self.clock.speed = float(parse_speed(body.get("speed")))
        elif action in ("jump", "reset"):
            # "reset" is the backend's demo-reset alias: jump calm, drop every override, play.
            target = "calm" if action == "reset" else body.get("t")
            if target is None:
                raise ValueError("jump needs t: calm|smoke|fire, seconds since 07:00, or HH:MM")
            self._jump(parse_jump(target))
            key = target.strip().lower() if isinstance(target, str) else ""
            if key == "calm":
                self.overrides.reset()
            elif key == "fire":
                self._trigger_fire("gym")
            self._emit_tick(self.clock.sim_t)
            self.clock.playing = True  # a jump is a demo beat; the clock must move for ramps to play out
        elif action == "trigger_fire":
            node_id = body.get("node_id")
            if not isinstance(node_id, str) or node_id not in self.mesh.nodes:
                raise ValueError(f"unknown node_id {node_id!r}")
            self._trigger_fire(node_id)
            self.clock.playing = True
        elif action == "trigger_smoke":
            self.overrides.trigger_smoke(t)
            self.clock.playing = True
        elif action == "clear":
            self.overrides.clear(t)
        else:
            raise ValueError("action must be play|pause|speed|jump|reset|trigger_fire|trigger_smoke|clear")
        log.info("control %s -> %s %s x%d phase=%s", action, self.clock.sim_clock(),
                 "playing" if self.clock.playing else "paused", int(self.clock.speed), phase(self.clock.sim_t, self.overrides))
        self._state_push_wanted.set()
        return self.state()

    def _jump(self, t: float) -> None:
        self.clock.jump(t)
        self.next_tick_t = self.clock.next_tick_after(t)
        # A fire lit "in the future" relative to a backward jump would ramp from negative time; re-anchor it.
        for node_id, t0 in list(self.overrides.fire.items()):
            if t0 > t:
                self.overrides.fire[node_id] = t
        if self.overrides.smoke_t0 is not None and self.overrides.smoke_t0 > t:
            self.overrides.smoke_t0 = t

    def _trigger_fire(self, node_id: str) -> None:
        t = self.clock.sim_t
        self.overrides.trigger_fire(node_id, t)
        now = reading(self.mesh.nodes[node_id], t, self.overrides, self.seed, self.clock.sim_ts())
        payload = {"alert": "LOCAL_ALARM", "pm25": now["pm25"], "temp_c": now["temp_c"]}
        self.mesh.relay(self.mesh.new_msg_id(), node_id, "alarm", payload)

    def relay(self, msg_id: str, origin: str, kind: str, payload: dict) -> dict | None:
        return self.mesh.relay(msg_id, origin, kind, payload)

    # ---- telemetry ------------------------------------------------------ #
    def _emit_tick(self, t: float) -> None:
        self.overrides.prune(t)
        ts = self.clock.sim_ts(t)
        batch = [reading(node, t, self.overrides, self.seed, ts) for node in self.nodes]
        for r in batch:
            self.latest[r["node_id"]] = r
        if self._telemetry_q.full():
            self._telemetry_q.get_nowait()  # drop the oldest tick rather than block the clock
        self._telemetry_q.put_nowait(batch)

    async def _ticker(self) -> None:
        last = time.monotonic()
        while True:
            await asyncio.sleep(LOOP_PERIOD_S)
            now = time.monotonic()
            dt, last = now - last, now
            if not self.clock.playing:
                continue
            self.clock.advance(dt)
            emitted = 0
            while self.next_tick_t <= self.clock.sim_t and emitted < MAX_TICKS_PER_LOOP:
                self._emit_tick(self.next_tick_t)
                self.next_tick_t += TICK_S
                emitted += 1
            if self.next_tick_t <= self.clock.sim_t:  # still behind after the cap: skip ahead
                self.next_tick_t = self.clock.next_tick_after(self.clock.sim_t)
            if not self.clock.playing:
                log.info("auto-paused at 20:00")
                self._state_push_wanted.set()

    async def _telemetry_worker(self) -> None:
        while True:
            batch = await self._telemetry_q.get()
            result = await self.client.post_telemetry(batch)
            if result and isinstance(result.get("data"), dict):
                d = result["data"]
                if d.get("alerts_opened") or d.get("alerts_cleared") or d.get("rejected"):
                    log.info("telemetry %s: %s", batch[0]["ts"][11:19], d)

    async def _state_pusher(self) -> None:
        while True:
            try:
                await asyncio.wait_for(self._state_push_wanted.wait(), timeout=STATE_PUSH_PERIOD_S)
            except asyncio.TimeoutError:
                pass
            self._state_push_wanted.clear()
            await self.client.post_sim_state(self.state())

    # ---- lifecycle ------------------------------------------------------ #
    async def run(self) -> None:
        log.info("seed=%d speed=%dx drop=%.2f backend=%s nodes=%d start=%s (paused)",
                 self.seed, int(self.clock.speed), self.mesh.drop_rate, self.client.base_url,
                 len(self.nodes), self.clock.sim_clock())
        await self.client.start()
        await self.mesh.start()
        runner = await start_server(self, self.control_port)
        # Prime the dashboard with one tick so nodes are not blank before the operator presses play.
        self._emit_tick(self.clock.sim_t)
        tasks = [asyncio.create_task(self._ticker(), name="ticker"),
                 asyncio.create_task(self._telemetry_worker(), name="telemetry"),
                 asyncio.create_task(self._state_pusher(), name="sim-state")]
        stop = asyncio.Event()
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            try:
                loop.add_signal_handler(sig, stop.set)
            except NotImplementedError:
                pass
        try:
            await stop.wait()
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)
            await self.mesh.close()
            if runner is not None:
                await runner.cleanup()
            await self.client.close()
            log.info("stopped")


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s [%(name)s] %(message)s", datefmt="%H:%M:%S")
    logging.getLogger("aiohttp").setLevel(logging.WARNING)
    asyncio.run(Simulator(args).run())


if __name__ == "__main__":
    main()
