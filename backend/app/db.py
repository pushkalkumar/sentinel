"""Async SQLite engine and session (CONTRACT §1.1). WAL + NORMAL sync + foreign keys on every connection."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import BACKEND_DIR, settings
from app.models import Base

log = logging.getLogger("sentinel.db")

engine = create_async_engine(settings.db_url)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragmas(dbapi_conn, _record) -> None:
    cur = dbapi_conn.cursor()
    cur.execute("PRAGMA journal_mode=WAL")
    cur.execute("PRAGMA synchronous=NORMAL")
    cur.execute("PRAGMA foreign_keys=ON")
    cur.close()


def _db_file_path() -> Path | None:
    """File behind a sqlite URL, or None for :memory:. Relative paths resolve against backend/ (uvicorn cwd)."""
    prefix = "sqlite+aiosqlite:///"
    if not settings.db_url.startswith(prefix):
        return None
    raw = settings.db_url[len(prefix):]
    if raw in ("", ":memory:"):
        return None
    path = Path(raw)
    return path if path.is_absolute() else (Path.cwd() / path)


def _delete_db_file() -> None:
    path = _db_file_path()
    if path is None:
        return
    for suffix in ("", "-wal", "-shm"):
        candidate = Path(str(path) + suffix)
        if candidate.exists():
            candidate.unlink()
            log.info("deleted %s (SENTINEL_RESET_DB=1)", candidate)


async def init_db() -> None:
    if settings.reset_db:
        await engine.dispose()
        _delete_db_file()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


__all__ = ["engine", "SessionLocal", "init_db", "get_session", "BACKEND_DIR"]
