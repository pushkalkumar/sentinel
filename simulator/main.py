# OWNER: simulator
"""Sentinel simulator entrypoint (CONTRACT §7). Scaffold stub: parses config, prints, exits."""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from pathlib import Path

SIM_DIR = Path(__file__).resolve().parent
TOPOLOGY_PATH = SIM_DIR.parent / "shared" / "topology.json"


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
    return p.parse_args()


async def run(args: argparse.Namespace) -> None:
    topology = json.loads(TOPOLOGY_PATH.read_text())
    node_count = sum(len(s["nodes"]) for s in topology["sites"])
    print(f"[sim] scaffold stub: {node_count} nodes from {TOPOLOGY_PATH.name}, "
          f"backend={args.backend} speed={args.speed}x drop={args.drop} seed={args.seed} control=:{args.control_port}")
    print("[sim] world/mesh/control/clock/backend_client not implemented yet (OWNER: simulator)")


if __name__ == "__main__":
    asyncio.run(run(parse_args()))
