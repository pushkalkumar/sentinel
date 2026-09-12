"""Virtual LoRa mesh (CONTRACT §7.1, §7.3).

14 VirtualNodes, one UDP socket each on 127.0.0.1:9000+i, run a real flood with msg_id
de-dup, ttl and per-link drops. Reporting to the backend follows the planned BFS path to the
site gateway, one POST per hop attempt, with the §7.3 pacing, so the hop animation is legible.
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
from collections import deque
from typing import Awaitable

from backend_client import BackendClient
from world import NodeInfo

log = logging.getLogger("sim.mesh")

BASE_PORT = 9000
TTL_START = 8
MAX_ATTEMPTS = 4
HOP_PACE_S = 0.4
RETRY_WAIT_S = 3.0
BACKOFF_MIN_S, BACKOFF_MAX_S = 0.010, 0.200
SEEN_CAP = 512


class _NodeProtocol(asyncio.DatagramProtocol):
    def __init__(self, mesh: "Mesh", node_id: str) -> None:
        self.mesh = mesh
        self.node_id = node_id
        self.transport: asyncio.DatagramTransport | None = None

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport  # type: ignore[assignment]

    def datagram_received(self, data: bytes, addr: tuple) -> None:
        try:
            msg = json.loads(data.decode())
        except (UnicodeDecodeError, json.JSONDecodeError):
            return
        self.mesh.on_datagram(self.node_id, msg)

    def error_received(self, exc: Exception) -> None:
        log.debug("udp error at %s: %s", self.node_id, exc)


class Mesh:
    def __init__(self, nodes: list[NodeInfo], client: BackendClient, drop_rate: float, seed: int) -> None:
        self.nodes = {n.id: n for n in nodes}
        self.client = client
        self.drop_rate = drop_rate
        self.rng = random.Random(seed ^ 0x6D657368)  # "mesh"; logged at startup by main
        self._protocols: dict[str, _NodeProtocol] = {}
        self._seen: dict[str, deque[str]] = {n.id: deque(maxlen=SEEN_CAP) for n in nodes}
        self._tasks: set[asyncio.Task] = set()
        self.in_flight = 0
        self.gateway_of: dict[int, str] = {n.site_id: n.id for n in nodes if n.is_gateway}

    # ---- lifecycle ------------------------------------------------------ #
    async def start(self) -> None:
        loop = asyncio.get_running_loop()
        bound = 0
        for node in self.nodes.values():
            port = BASE_PORT + node.index
            try:
                _, proto = await loop.create_datagram_endpoint(
                    lambda n=node.id: _NodeProtocol(self, n), local_addr=("127.0.0.1", port))
                self._protocols[node.id] = proto
                bound += 1
            except OSError as exc:
                log.warning("node %s could not bind udp :%d (%s); flood disabled for it", node.id, port, exc)
        log.info("mesh up: %d/%d virtual nodes bound on udp :%d-:%d, drop=%.0f%%",
                 bound, len(self.nodes), BASE_PORT, BASE_PORT + len(self.nodes) - 1, self.drop_rate * 100)

    async def close(self) -> None:
        for task in list(self._tasks):
            task.cancel()
        for proto in self._protocols.values():
            if proto.transport is not None:
                proto.transport.close()

    # ---- planning ------------------------------------------------------- #
    def planned_path(self, origin: str) -> list[str] | None:
        """BFS shortest path to the origin's site gateway, neighbour order as listed in topology."""
        node = self.nodes.get(origin)
        if node is None:
            return None
        gateway = self.gateway_of.get(node.site_id)
        if gateway is None:
            return None
        if origin == gateway:
            return [origin]
        parent: dict[str, str | None] = {origin: None}
        queue: deque[str] = deque([origin])
        while queue:
            current = queue.popleft()
            for nb in self.nodes[current].neighbours:
                if nb in parent or nb not in self.nodes:
                    continue
                parent[nb] = current
                if nb == gateway:
                    path = [nb]
                    while parent[path[-1]] is not None:
                        path.append(parent[path[-1]])  # type: ignore[arg-type]
                    return list(reversed(path))
                queue.append(nb)
        return None

    def new_msg_id(self) -> str:
        return "m-" + "".join(self.rng.choice("0123456789abcdef") for _ in range(8))

    # ---- relay entry point ---------------------------------------------- #
    def relay(self, msg_id: str, origin: str, kind: str, payload: dict) -> dict | None:
        path = self.planned_path(origin)
        if path is None:
            return None
        self._spawn(self._flood_origin(origin, msg_id, kind, payload))
        self._spawn(self._report(msg_id, origin, kind, payload, path))
        return {"msg_id": msg_id, "planned_path": path, "ttl": TTL_START}

    def _spawn(self, coro: Awaitable[None]) -> None:
        task = asyncio.ensure_future(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    # ---- real UDP flood ------------------------------------------------- #
    async def _flood_origin(self, origin: str, msg_id: str, kind: str, payload: dict) -> None:
        self._seen[origin].append(msg_id)
        await self._forward(origin, {"msg_id": msg_id, "origin": origin, "kind": kind,
                                     "payload": payload, "ttl": TTL_START, "from": origin}, exclude=None)

    def on_datagram(self, node_id: str, msg: dict) -> None:
        msg_id = msg.get("msg_id")
        if not isinstance(msg_id, str) or msg_id in self._seen[node_id]:
            return
        self._seen[node_id].append(msg_id)
        node = self.nodes[node_id]
        if node.is_gateway:
            log.debug("flood: %s reached gateway %s", msg_id, node_id)
            return
        ttl = int(msg.get("ttl", 0)) - 1
        if ttl <= 0:
            return
        fwd = dict(msg, ttl=ttl, **{"from": node_id})
        self._spawn(self._forward(node_id, fwd, exclude=msg.get("from")))

    async def _forward(self, node_id: str, msg: dict, exclude: str | None) -> None:
        await asyncio.sleep(self.rng.uniform(BACKOFF_MIN_S, BACKOFF_MAX_S))
        proto = self._protocols.get(node_id)
        if proto is None or proto.transport is None:
            return
        data = json.dumps(msg).encode()
        for nb in self.nodes[node_id].neighbours:
            if nb == exclude or nb not in self.nodes:
                continue
            if self.rng.random() < self.drop_rate:
                continue
            try:
                proto.transport.sendto(data, ("127.0.0.1", BASE_PORT + self.nodes[nb].index))
            except OSError as exc:
                log.debug("udp send %s->%s failed: %s", node_id, nb, exc)

    # ---- scripted reporting along the planned path (§7.3) --------------- #
    async def _report(self, msg_id: str, origin: str, kind: str, payload: dict, planned: list[str]) -> None:
        self.in_flight += 1
        try:
            await self._report_hops(msg_id, origin, kind, payload, planned)
        except asyncio.CancelledError:
            raise
        except Exception:  # reporting must never take the simulator down
            log.exception("relay %s reporting failed", msg_id)
        finally:
            self.in_flight -= 1

    async def _report_hops(self, msg_id: str, origin: str, kind: str, payload: dict, planned: list[str]) -> None:
        gateway = planned[-1]
        base = {"msg_id": msg_id, "origin_node": origin, "kind": kind, "payload": payload}
        path = [origin]

        if len(planned) == 1:  # originated at the gateway: one delivered hop, from == to
            await asyncio.sleep(HOP_PACE_S)
            await self._post(dict(base, path=list(path), ttl=TTL_START, delivered=True,
                                  hop={"from": origin, "to": origin, "attempt": 1, "status": "delivered"}))
            return

        for hop_index, (a, b) in enumerate(zip(planned, planned[1:]), start=1):
            ttl = TTL_START - hop_index
            attempt = 1
            while True:
                await asyncio.sleep(HOP_PACE_S)
                if self.rng.random() < self.drop_rate and attempt < MAX_ATTEMPTS:
                    await self._post(dict(base, path=list(path), ttl=ttl, delivered=False, dropped_at=f"{a}→{b}",
                                          hop={"from": a, "to": b, "attempt": attempt, "status": "dropped"}))
                    await asyncio.sleep(RETRY_WAIT_S)
                    attempt += 1
                    await self._post(dict(base, path=list(path), ttl=ttl, delivered=False,
                                          hop={"from": a, "to": b, "attempt": attempt, "status": "retry"}))
                    continue
                if attempt >= MAX_ATTEMPTS and self.rng.random() < self.drop_rate:
                    await self._post(dict(base, path=list(path), ttl=ttl, delivered=False, dropped_at=f"{a}→{b}",
                                          hop={"from": a, "to": b, "attempt": attempt, "status": "failed"}))
                    log.info("relay %s failed at %s→%s after %d attempts", msg_id, a, b, attempt)
                    return
                path.append(b)
                status = "delivered" if b == gateway else "ok"
                await self._post(dict(base, path=list(path), ttl=ttl, delivered=status == "delivered",
                                      hop={"from": a, "to": b, "attempt": attempt, "status": status}))
                break
        log.info("relay %s delivered to %s via %d hops: %s", msg_id, gateway, len(path) - 1, " -> ".join(path))

    async def _post(self, body: dict) -> None:
        await self.client.post_mesh_message(body)
