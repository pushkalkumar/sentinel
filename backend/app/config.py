"""Runtime settings (CONTRACT §9). Loads backend/.env if present; env vars win."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent
load_dotenv(BACKEND_DIR / ".env")


def _truthy(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    secret: str = field(default_factory=lambda: os.getenv("SENTINEL_SECRET", "sentinel-dev-secret-change-me"))
    sim_key: str = field(default_factory=lambda: os.getenv("SENTINEL_SIM_KEY", "sentinel-sim"))
    sim_url: str = field(default_factory=lambda: os.getenv("SENTINEL_SIM_URL", "http://127.0.0.1:8001"))
    db_url: str = field(default_factory=lambda: os.getenv("SENTINEL_DB", "sqlite+aiosqlite:///./sentinel.db"))
    reset_db: bool = field(default_factory=lambda: _truthy(os.getenv("SENTINEL_RESET_DB", "0")))
    topology_path: Path = field(default_factory=lambda: REPO_DIR / "shared" / "topology.json")
    token_max_age_s: int = 86400
    sim_connected_window_s: float = 5.0
    version: str = "0.1.0"


settings = Settings()
