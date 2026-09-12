"""Backend HTTP client (CONTRACT §3.9). Never raises to callers; backs off while the backend is down."""
from __future__ import annotations

import asyncio
import logging
import time

import aiohttp

log = logging.getLogger("sim.backend")

BACKOFF_MIN_S = 0.5
BACKOFF_MAX_S = 5.0
REQUEST_TIMEOUT_S = 3.0
REJECT_LOG_EVERY_S = 30.0


class BackendClient:
    def __init__(self, base_url: str, sim_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.sim_key = sim_key
        self.connected = False
        self._session: aiohttp.ClientSession | None = None
        self._backoff = BACKOFF_MIN_S
        self._down_until = 0.0
        self._ever_reported = False
        self._last_reject_log: dict[str, float] = {}

    async def start(self) -> None:
        self._session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=REQUEST_TIMEOUT_S),
            headers={"X-Sim-Key": self.sim_key},
        )

    async def close(self) -> None:
        if self._session is not None:
            await self._session.close()
            self._session = None

    # ---- public posts -------------------------------------------------- #
    async def post_telemetry(self, readings: list[dict]) -> dict | None:
        return await self._post("/api/ingest/telemetry", readings)

    async def post_mesh_message(self, body: dict) -> dict | None:
        return await self._post("/api/ingest/mesh-message", body)

    async def post_sim_state(self, body: dict) -> dict | None:
        return await self._post("/api/ingest/sim-state", body)

    # ---- internals ------------------------------------------------------ #
    async def _post(self, path: str, body: object) -> dict | None:
        if self._session is None or time.monotonic() < self._down_until:
            return None
        try:
            async with self._session.post(self.base_url + path, json=body) as resp:
                if resp.status >= 500:
                    self._mark_down(f"{path} -> HTTP {resp.status}")
                    return None
                payload = await resp.json(content_type=None)
                if resp.status >= 400:
                    # Backend is up but rejected us (bad key, route not ready): log sparingly, stay connected.
                    self._log_reject(path, resp.status, payload)
                    self._mark_up()
                    return None
                self._mark_up()
                return payload if isinstance(payload, dict) else None
        except (aiohttp.ClientError, asyncio.TimeoutError, OSError, ValueError) as exc:
            self._mark_down(f"{path}: {exc.__class__.__name__}")
            return None

    def _log_reject(self, path: str, status: int, payload: object) -> None:
        now = time.monotonic()
        if now - self._last_reject_log.get(path, -REJECT_LOG_EVERY_S) < REJECT_LOG_EVERY_S:
            return
        self._last_reject_log[path] = now
        log.warning("%s -> HTTP %s: %s", path, status, payload)

    def _mark_up(self) -> None:
        if not self.connected:
            log.info("backend connected at %s", self.base_url)
        self.connected = True
        self._backoff = BACKOFF_MIN_S
        self._ever_reported = False

    def _mark_down(self, reason: str) -> None:
        if self.connected or not self._ever_reported:
            log.warning("backend unreachable (%s); retrying with backoff up to %.0fs", reason, BACKOFF_MAX_S)
            self._ever_reported = True
        self.connected = False
        self._down_until = time.monotonic() + self._backoff
        self._backoff = min(self._backoff * 2, BACKOFF_MAX_S)
