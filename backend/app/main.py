"""Sentinel backend entrypoint (BUILD_PLAN §1.2). Routers live in app.core / app.alerts / app.drills."""
from __future__ import annotations

import importlib
import logging
import time
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app import ws
from app.config import settings
from app.db import SessionLocal, engine, init_db
from app.envelope import install_exception_handlers, ok
from app.seed import seed_if_empty
from app.state import state
from app.timefmt import now_iso

# uvicorn configures only its own loggers; without this the app's INFO lines (seed, reset, startup) never print.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("sentinel")

ROUTER_MODULES = (
    "app.core.auth", "app.core.nodes", "app.core.sites", "app.core.incidents", "app.core.mesh", "app.core.sim",
    "app.alerts.ingest", "app.alerts.routes",
    "app.drills.routes", "app.drills.timeline",
    "app.ai.routes",
    "app.demo",
    "app.ml.routes",
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.reset_db:
        log.warning("SENTINEL_RESET_DB=1: dropping the database and reseeding")
    await init_db()
    async with SessionLocal() as session:
        seeded = await seed_if_empty(session)
    log.info("sentinel %s ready: db=%s seeded=%s sim_url=%s routers=%d",
             settings.version, settings.db_url, "fresh" if seeded else "existing", settings.sim_url, len(MOUNTED))
    yield
    await engine.dispose()


app = FastAPI(title="Sentinel", version=settings.version, lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
install_exception_handlers(app)

api = APIRouter(prefix="/api")


def sim_connected() -> bool:
    return state.sim_state is not None and (time.time() - state.sim_last_push_wall) <= settings.sim_connected_window_s


@api.get("/health")
async def health() -> dict:
    """CONTRACT §3.2. Lives here (not in core/sim.py) so smoke works before any implement agent finishes."""
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001 - health must answer even when the db is broken
        log.exception("health: db check failed")
        db_ok = False
    return ok({
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "sim_connected": sim_connected(),
        "ws_clients": ws.hub.count(),
        "version": settings.version,
        "wall_now": now_iso(),
    })


def _mount_routers(target: APIRouter) -> list[str]:
    mounted = []
    for name in ROUTER_MODULES:
        module = importlib.import_module(name)
        router = getattr(module, "router", None)
        if router is None:
            log.warning("%s has no `router`; skipped", name)
            continue
        target.include_router(router)
        mounted.append(name)
    return mounted


MOUNTED = _mount_routers(api)
app.include_router(api)
app.include_router(ws.router)          # /live, no prefix
