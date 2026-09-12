# Integration notes

The only cross-agent channel. One line per request, format: `[HH:MM] [agent] [path] [what you need, one sentence] [blocking: yes|no]`.
The integrator applies or reassigns each line; do not edit files you do not own.

[10:55] [scaffold] [backend/app/main.py] `GET /api/health` lives permanently in main.py, not core/sim.py; backend-core must not redefine it (BUILD_PLAN §1.2 / §4.12 amended by orchestrator). [blocking: no]
[10:55] [scaffold] [backend/requirements.txt] Added `greenlet==3.5.5`; SQLAlchemy async raises without it and BUILD_PLAN's list omitted it. [blocking: no]
[10:55] [scaffold] [backend/app/alerts/bands.py] `band_key` body is implemented (CONTRACT §5.1 rule) alongside DEFAULT_POLICY; backend-alerts may keep or rewrite it, signature fixed. [blocking: no]
[10:55] [scaffold] [backend/app/main.py] Routers are mounted via importlib over ROUTER_MODULES; a module without `router` is skipped with a warning, so an implement agent can never break boot by omitting it. [blocking: no]
[10:55] [scaffold] [backend/pytest.ini] `asyncio_mode = auto`; tests need no `@pytest.mark.asyncio`. [blocking: no]
[10:55] [scaffold] SCAFFOLD A READY
[11:00] [submission-docs] [Makefile] `make install` assumes backend/.venv exists; on a clean clone it does not (gitignored), so README tells users to run `uv venv backend/.venv --python 3.13` first; consider adding that as the first line of the install target so `git clone && make install && make dev` works as written. [blocking: no]
