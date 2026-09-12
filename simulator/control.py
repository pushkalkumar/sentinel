"""Simulator control API on 127.0.0.1:8001 (CONTRACT §7.5). Envelope responses, 422 on bad input."""
from __future__ import annotations

import logging
import re
from typing import Protocol

from aiohttp import web

log = logging.getLogger("sim.control")

_MSG_ID = re.compile(r"^m-[0-9a-f]{8}$")


class Controllable(Protocol):
    def state(self) -> dict: ...
    async def apply_control(self, body: dict) -> dict: ...  # raises ValueError on bad input
    def relay(self, msg_id: str, origin: str, kind: str, payload: dict) -> dict | None: ...


def ok(data: object, status: int = 200) -> web.Response:
    return web.json_response({"ok": True, "data": data, "error": None}, status=status)


def fail(code: str, message: str, status: int, details: object = None) -> web.Response:
    return web.json_response(
        {"ok": False, "data": None, "error": {"code": code, "message": message, "details": details}},
        status=status)


async def _json_body(request: web.Request) -> dict:
    try:
        body = await request.json()
    except Exception as exc:  # aiohttp raises JSONDecodeError subclasses; any parse failure is a 422
        raise ValueError(f"body must be JSON: {exc}") from exc
    if not isinstance(body, dict):
        raise ValueError("body must be a JSON object")
    return body


def build_app(sim: Controllable) -> web.Application:
    async def get_state(_: web.Request) -> web.Response:
        return ok(sim.state())

    async def post_control(request: web.Request) -> web.Response:
        try:
            body = await _json_body(request)
            data = await sim.apply_control(body)
        except ValueError as exc:
            return fail("VALIDATION_ERROR", str(exc), 422)
        return ok(data)

    async def post_relay(request: web.Request) -> web.Response:
        try:
            body = await _json_body(request)
        except ValueError as exc:
            return fail("VALIDATION_ERROR", str(exc), 422)
        msg_id = body.get("msg_id")
        origin = body.get("origin_node")
        kind = body.get("kind")
        payload = body.get("payload")
        if not isinstance(msg_id, str) or not _MSG_ID.match(msg_id):
            return fail("VALIDATION_ERROR", "msg_id must match m-XXXXXXXX (8 lowercase hex)", 422)
        if kind not in ("incident", "alarm"):
            return fail("VALIDATION_ERROR", "kind must be incident or alarm", 422)
        if not isinstance(origin, str):
            return fail("VALIDATION_ERROR", "origin_node is required", 422)
        if payload is None:
            payload = {}
        if not isinstance(payload, dict):
            return fail("VALIDATION_ERROR", "payload must be an object", 422)
        planned = sim.relay(msg_id, origin, kind, payload)
        if planned is None:
            return fail("VALIDATION_ERROR", f"unknown origin_node {origin!r}", 422)
        return ok(planned, status=202)

    async def not_found(_: web.Request) -> web.Response:
        return fail("NOT_FOUND", "no such route on the simulator", 404)

    app = web.Application()
    app.router.add_get("/state", get_state)
    app.router.add_post("/control", post_control)
    app.router.add_post("/relay", post_relay)
    app.router.add_route("*", "/{tail:.*}", not_found)
    return app


async def start_server(sim: Controllable, port: int) -> web.AppRunner | None:
    runner = web.AppRunner(build_app(sim), access_log=None)
    await runner.setup()
    try:
        await web.TCPSite(runner, "127.0.0.1", port).start()
    except OSError as exc:
        log.error("control server could not bind 127.0.0.1:%d (%s); telemetry continues without it", port, exc)
        await runner.cleanup()
        return None
    log.info("control api listening on http://127.0.0.1:%d (GET /state, POST /control, POST /relay)", port)
    return runner
