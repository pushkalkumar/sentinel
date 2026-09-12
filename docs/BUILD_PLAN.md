# Sentinel BUILD_PLAN

Execution plan for the Frontier Cascadia build, Sept 12 2026. Written 10:30 AM. Devpost locks 17:30 PDT; everything must boot and pass the smoke list by **15:30**.

Product: **Sentinel**. Device: **Sentinel Node**. SSID `SENTINEL-<node_id>`. Incident codes `SN-XXXX`. The word "Cascadia" appears only in the event name "Frontier Cascadia".

---

## 0. Rules every agent obeys

### 0.1 Document precedence (when two docs disagree, the higher one wins)

1. `docs/CONTRACT.md` for every API shape, port, table, WS message, topology, node id, sim clock and control action. It is the integration contract. `shared/topology.json` (14 nodes: 8 campus + 6 warehouse) is the only node list. SIM_WORLD's Ravenna Ridge node ids (`main`, `sci`, `port`, `bus`, `w1..w6`) and its `/sim/*` endpoints are **not used**; take SIM_WORLD only for curve technique, the fire curve shape, battery model, hashed deterministic noise, and map drawing conventions.
2. `docs/DESIGN.md` for every visual decision: palette (signal cyan `#46D2E4` is the one accent; **not** amber), fonts (Archivo Variable, IBM Plex Sans Variable, IBM Plex Mono), radii, motion, component language, page layouts, copy rules. Where HARDWARE_3D.md names Bricolage/Geist/amber, substitute DESIGN tokens. HARDWARE_3D.md still governs 3D geometry, materials, part registry, scene technique and performance budget.
3. `docs/NOVELTY.md` §3 for the three add-on features, adapted to CONTRACT endpoints (jump is `POST /api/sim/control {action:"jump"}`, not `/sim/jump`).
4. `spec.md` for copy, pitch lines, BOM numbers, pin map, power budget.
5. This file for who owns which file and when.

### 0.2 File ownership

Every file in the repo has exactly one owner after the scaffold step. The owner list is in §2. **If you need a change in a file you do not own, do not edit it.** Append one line to `docs/INTEGRATION_NOTES.md`:

```
[HH:MM] [your-agent] [path] [what you need, one sentence] [blocking: yes|no]
```

The integrator (orchestrator) applies it or reassigns. CONTRACT.md mentions `docs/GAPS.md`; that file is `docs/INTEGRATION_NOTES.md`. One file, not two.

Scaffold-owned files are **frozen** after 11:15 (see §1.7). Stubs that a later agent owns are marked `// OWNER: <agent>` on line 1; the owner deletes that line when done.

### 0.3 Naming and stack (fixed)

- Frontend: Vite 7 + React 19.2 + TypeScript 5.8 + Tailwind v4 (`@tailwindcss/vite`) + react-router 7.18 + `motion` 13 + `@react-three/fiber` 9.7 + `@react-three/drei` 10.7 + `three` 0.186 + `zustand` 5 + `clsx` + `lucide-react`. Fonts via `@fontsource*` only. No other npm packages without an INTEGRATION_NOTES line.
- Backend: FastAPI 0.141 + SQLAlchemy 2.0.52 (async, aiosqlite) + itsdangerous + httpx + pydantic 2. Package `app` in `backend/`. One venv at `backend/.venv` (uv, Python 3.13), shared with the simulator.
- Simulator: Python asyncio + aiohttp 3.14 (client and control server). Stdlib otherwise.
- No runtime network except our own backend. No CDN, no tiles, no HDRI, no remote fonts, no `<Text>` from drei.
- Timestamps: CONTRACT §0.3 and §0.4. Sim timestamps are formatted with `timeZone: 'UTC'`.
- Every page with a simulated thing carries exactly one SIM tag with the exact string from DESIGN §6.13.

### 0.4 Clock (wall, PDT)

| Window | Phase | Who |
|---|---|---|
| 10:30 to 10:55 | SCAFFOLD phase A: backend + simulator + shared + Makefile | scaffold agent |
| 10:55 | checkpoint `SCAFFOLD A READY` in INTEGRATION_NOTES.md; backend-core, backend-alerts, backend-drills, simulator, hardware-docs, submission-docs start | |
| 10:55 to 11:15 | SCAFFOLD phase B: frontend | scaffold agent |
| 11:15 | checkpoint `SCAFFOLD B READY`; all fe-* agents start | |
| 12:45 | **mid-check**: phone report → `SN-XXXX` → responder queue row, end to end, on the real stack | integrator |
| 14:30 | agents stop adding features; only fix acceptance failures | all |
| 14:30 to 15:30 | INTEGRATE: build, boot, smoke list, screenshots, hotspot test | integrator + one helper |
| 15:30 to 16:45 | video, Devpost text, README final | submission-docs |
| 17:00 | lock (30 min buffer) | |

Cut order if behind at 14:00 (from spec §10.4, extended): warehouse floor-plan view → `/admin/nodes` provisioning UI (keep the table) → Time Machine transport controls (keep drag + LIVE) → 3D mesh scene (keep explode) → drill CSV/report page (keep grid) → hop dash animation (keep hop log) → trust breakdown rows (keep Verified/Likely pill) → SMS outbox page (keep the count on the decision card). Never cut: decision card, LOCAL_FIRE at gym, phone report with code, responder resolve, explode 3D, Sky vs Building panel.

---

## 1. SCAFFOLD step (one agent, sequential, 10:30 to 11:15)

The scaffold agent creates every directory, every shared module, every route stub, and the run tooling. It writes real code for the small shared pieces (envelope, auth deps, WS hub, seed, store slices, UI primitives, shells) and empty-but-typed stubs for everything an implement agent owns. Nothing it creates may be renamed later.

### 1.1 Current state (verified 10:25)

- `frontend/` exists from `npm create vite@latest frontend -- --template react-ts`; `node_modules` installed (181 packages); `react@19.2.8`, `vite@7.3.6`, `tailwindcss@4.3.3`, `react-router@7.18.3`, `@react-three/fiber@9.7.0`, `@react-three/drei@10.7.8`, `three@0.186.0`, `zustand@5.0.15`, `motion@13.2.0`, `clsx@2.1.1` present. **Wrong fonts installed** (bricolage-grotesque, geist, instrument-sans, jetbrains-mono). `lucide-react` missing. `vite.config.ts` has no proxy and no tailwind plugin. `src/` is the Vite template.
- `backend/.venv` exists (uv, CPython 3.13.5) with fastapi 0.141.1, uvicorn 0.52.4, sqlalchemy 2.0.52, aiosqlite 0.22.1, itsdangerous 2.2.0, httpx 0.28.1, pydantic 2.13.5, python-dotenv 1.2.3, pytest 9.1.1, pytest-asyncio 1.4.0, websockets 17.1. No `app/` package, no requirements file. `aiohttp` not installed.
- `simulator/` is empty. No `shared/`, no `hardware/`, no Makefile, no root README.
- git: two commits on `main`. The scaffold agent commits after phase A and after phase B.

### 1.2 Phase A commands (backend, simulator, shared, tooling)

Run from `/Users/pushkalkumar/Desktop/sentinel`.

```bash
# python deps (one venv, shared by backend and simulator)
cat > backend/requirements.txt <<'EOF'
fastapi==0.141.1
uvicorn[standard]==0.52.4
sqlalchemy==2.0.52
aiosqlite==0.22.1
itsdangerous==2.2.0
httpx==0.28.1
pydantic==2.13.5
python-dotenv==1.2.3
pytest==9.1.1
pytest-asyncio==1.4.0
EOF
cat > simulator/requirements.txt <<'EOF'
aiohttp==3.14.3
EOF
uv pip install --python backend/.venv/bin/python -r backend/requirements.txt -r simulator/requirements.txt

mkdir -p shared backend/app/core backend/app/alerts backend/app/drills backend/tests simulator hardware/firmware docs/screenshots
touch backend/app/__init__.py backend/app/core/__init__.py backend/app/alerts/__init__.py backend/app/drills/__init__.py backend/tests/__init__.py
```

Then write these files (content rules follow each path):

**`shared/topology.json`**: CONTRACT §1.2 verbatim. Do not edit a coordinate.

**`backend/app/config.py`**: `Settings` dataclass read from env with CONTRACT §9 defaults: `SENTINEL_SECRET`, `SENTINEL_SIM_KEY`, `SENTINEL_SIM_URL`, `SENTINEL_DB`, `SENTINEL_RESET_DB`. Loads `backend/.env` via python-dotenv if present. Export `settings = Settings()`.

**`backend/app/timefmt.py`**: `now_iso()` (CONTRACT §0.4), `sim_hhmm(iso) -> "14:31"`, `parse_iso(iso) -> datetime`, `iso_plus(iso, seconds) -> iso`.

**`backend/app/models.py`**: CONTRACT §1.1 verbatim, plus these additions (decided now so no agent has to touch models later):

```python
# on Incident:
    sim_at: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)   # (sim) sim_ts at creation, for the Time Machine track

class NodeEval(Base):
    """Rolling window of engine evaluations per node (NOVELTY §3.2). backend-alerts writes; keeps last 60 per node."""
    __tablename__ = "node_evals"
    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), index=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id"), index=True)
    sim_ts: Mapped[str] = mapped_column(String(32), index=True)
    pm25: Mapped[float] = mapped_column(Float)
    pm_rise: Mapped[float] = mapped_column(Float)
    temp_rise: Mapped[float] = mapped_column(Float)
    gas_delta: Mapped[float] = mapped_column(Float)
    regional: Mapped[float] = mapped_column(Float)
    ratio: Mapped[float] = mapped_column(Float)                 # pm25 / regional
    neighbour_ids: Mapped[list] = mapped_column(JSON, default=list)
    neighbour_pm25: Mapped[list] = mapped_column(JSON, default=list)
    branch: Mapped[str] = mapped_column(String(24))             # LOCAL_FIRE|HAZARDOUS_SMOKE|LOCAL_SMOKE_SUSPECT|CLEAR
    thresholds: Mapped[dict] = mapped_column(JSON, default=dict)
```

**`backend/app/db.py`**: `engine = create_async_engine(settings.db_url)`, `SessionLocal = async_sessionmaker(engine, expire_on_commit=False)`, `@event.listens_for(engine.sync_engine, "connect")` setting `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON`, `async def init_db()` (delete db file if `SENTINEL_RESET_DB=1`, then `create_all`), `async def get_session()` dependency.

**`backend/app/envelope.py`**: `ok(data)`, `class ApiError(Exception)` with `code, message, status, details`, the three exception handlers from CONTRACT §0.2 (`ApiError`, `HTTPException`, `RequestValidationError`, `Exception`) all emitting the envelope, `ERROR_STATUS` dict from the §0.2 table. Route handlers return `ok(data)`.

**`backend/app/security.py`**: `sign_token(payload: dict) -> str`, `verify_token(token) -> dict | None` (itsdangerous `URLSafeTimedSerializer(settings.secret, salt="sentinel-auth")`, `max_age=86400`), `sha256(s) -> str`.

**`backend/app/deps.py`**: `SessionDep = Annotated[AsyncSession, Depends(get_session)]`; `@dataclass class Principal: uid, role, tenant_id, site_id, class_id, name`; `async def current_user(request) -> Principal | None` (bearer optional); `def require_roles(*roles)` dependency factory raising `UNAUTHORIZED`/`FORBIDDEN`; `def require_sim_key(x_sim_key: str = Header(...))`; `def device_fp(x_device_fp: str | None = Header(None))` raising `MISSING_DEVICE_FP`; `def node_id_header(x_node_id: str | None = Header(None))`; `def client_ip(request) -> str`; `def same_tenant_or_responder(principal, tenant_id)` helper raising `FORBIDDEN`.

**`backend/app/state.py`**: one module-level singleton:

```python
@dataclass
class RuntimeState:
    rings: dict[str, deque]            # node_id -> deque(maxlen=240) of Reading-like dicts, oldest first (sim order)
    latest: dict[str, dict]            # node_id -> latest reading dict
    site_band: dict[int, str | None]   # site_id -> current decision-card band key
    pending_all_clear: dict[int, dict] # site_id -> {since_ts, alert_id, band_at_alert}
    sim_state: dict | None             # last SimState pushed by the simulator
    sim_last_push_wall: float          # time.time() of last sim-state push
    last_eval: dict[str, dict]         # node_id -> last NodeEval-like dict (for /explain)
state = RuntimeState(...)
```

Frozen. If you need a field, INTEGRATION_NOTES.

**`backend/app/ws.py`**: `class Hub` with `clients: dict[WebSocket, dict]`, `async def connect(ws, principal, device_fp)`, `def disconnect(ws)`, `async def broadcast(type: str, data: dict)` (envelope `{type, ts: now_iso(), data}`, JSON via `json.dumps(default=str)`, dead sockets pruned), `def count()`. `router = APIRouter()` with `@router.websocket("/live")`: parse `token` and `device_fp` query params, send `hello` per CONTRACT §6.1 (`sim` from `state.sim_state`), loop receiving text; `{"type":"ping"}` → `pong`. Export `hub = Hub()`. Everyone broadcasts through `hub.broadcast(...)`.

**`backend/app/seed.py`**: `async def seed_if_empty(session)` per CONTRACT §1.3: tenants (policy packs from CONTRACT §5.1; tenant 2 overrides `pm_rise: 30`), sites/zones/nodes from `shared/topology.json` (path resolved relative to this file: `Path(__file__).resolve().parents[2] / "shared" / "topology.json"`), users (password `sentinel`, staff codes), classes + roster, 36 SMS recipients, the `demo-blocked-device` history row. Idempotent (checks `count(tenants) == 0`).

**`backend/app/main.py`**:

```python
app = FastAPI(title="Sentinel", version="0.1.0", lifespan=lifespan)   # lifespan: init_db(); seed_if_empty()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
install_exception_handlers(app)
api = APIRouter(prefix="/api")
from app.core import auth, nodes, sites, incidents, mesh, sim
from app.alerts import ingest, routes as alert_routes
from app.drills import routes as drill_routes, timeline
for r in (auth, nodes, sites, incidents, mesh, sim, ingest, alert_routes, drill_routes, timeline):
    api.include_router(r.router)
app.include_router(api)
app.include_router(ws.router)          # /live, no prefix
```

Every module listed above is created by the scaffold as a stub: `from fastapi import APIRouter; router = APIRouter()` with the `# OWNER:` line. The health route lives in `app/core/sim.py` (owner backend-core) but the scaffold implements `GET /api/health` there immediately so `make smoke` works from minute one.

**Stubs with fixed signatures** (scaffold writes the signature and `raise NotImplementedError` or returns a neutral value; owner fills the body; signature never changes):

| File | Owner | Functions the rest of the backend imports |
|---|---|---|
| `app/core/nodes.py` | backend-core | `async def node_to_dict(session, node: Node) -> dict`; `async def compute_node_status(session, node_id) -> str`; `async def node_status_payload(session, node_id) -> dict` (the WS `node_status` data) |
| `app/core/incidents.py` | backend-core | `async def incident_to_dict(session, inc: Incident) -> dict`; `async def append_incident_event(session, inc, *, action, note, actor: Principal\|None, actor_role, ip) -> IncidentEvent` (also broadcasts `incident_event`) |
| `app/core/mesh.py` | backend-core | `async def relay_to_sim(msg_id, origin_node, kind, payload) -> None` |
| `app/alerts/serialize.py` | backend-alerts | `async def alert_to_dict(session, alert: Alert) -> dict` |
| `app/alerts/decision.py` | backend-alerts | `async def get_decision_card(session, site_id, log_limit=20) -> dict \| None` |
| `app/alerts/bands.py` | backend-alerts | `def band_key(pm25: float, policy: dict) -> str`; `DEFAULT_POLICY: dict` (CONTRACT §5.1 verbatim, used by seed) |
| `app/drills/service.py` | backend-drills | `async def get_active_drill(session, site_id) -> dict \| None`; `async def drill_to_dict(session, drill, full=True) -> dict` |

The scaffold writes `DEFAULT_POLICY` in `bands.py` for real (seed needs it); the rest are stubs.

**`backend/tests/test_smoke.py`**: one async test: app boots with `SENTINEL_DB=sqlite+aiosqlite:///:memory:`, `GET /api/health` returns the envelope. Owner after scaffold: backend-core.

**`simulator/`** skeleton: `main.py` (argparse/env, `asyncio.run(run())`, stub), `world.py`, `mesh.py`, `control.py`, `clock.py`, `backend_client.py` as empty stubs with `# OWNER: simulator`; `.env.example` per CONTRACT §9.

**`Makefile`** (root):

```make
PY=backend/.venv/bin/python
UVICORN=backend/.venv/bin/uvicorn
.PHONY: install backend sim frontend dev seed build smoke clean
install:      ; uv pip install --python $(PY) -r backend/requirements.txt -r simulator/requirements.txt && cd frontend && npm ci
backend:      ; cd backend && ../$(UVICORN) app.main:app --host 0.0.0.0 --port 8000 --reload
sim:          ; cd simulator && ../$(PY) main.py
frontend:     ; cd frontend && npm run dev -- --host 0.0.0.0 --port 5173
dev:          ; ./scripts/dev.sh
seed:         ; cd backend && SENTINEL_RESET_DB=1 ../$(PY) -m app.seed
build:        ; cd frontend && npm run build
smoke:        ; ./scripts/smoke.sh
clean:        ; rm -f backend/sentinel.db backend/sentinel.db-wal backend/sentinel.db-shm
```

(`seed.py` has an `if __name__ == "__main__":` block that runs `init_db()` then `seed_all()`, where `seed_all()` opens its own session and calls `seed_if_empty`.)

**`scripts/dev.sh`**: starts backend, waits for `/api/health`, starts simulator, starts frontend; `trap` kills all three on Ctrl-C; logs prefixed `[be] [sim] [fe]`. **`scripts/smoke.sh`**: the curl list from §3.3, exits non-zero on first failure.

**`backend/.env.example`**, **`simulator/.env.example`**: CONTRACT §9.

Commit: `Add backend skeleton, shared topology, simulator stubs, Makefile`. Append `[10:55] [scaffold] SCAFFOLD A READY` to `docs/INTEGRATION_NOTES.md` (create the file with a 3-line header explaining the format).

### 1.3 Phase B commands (frontend)

```bash
cd frontend
npm uninstall @fontsource-variable/bricolage-grotesque @fontsource-variable/geist @fontsource-variable/instrument-sans @fontsource-variable/jetbrains-mono
npm install --save-exact @fontsource-variable/archivo@5.3.0 @fontsource-variable/ibm-plex-sans@5.3.0 @fontsource/ibm-plex-mono@5.3.0 lucide-react@1.45.0
# pin the rest exactly (package.json currently has carets)
npm install --save-exact react@19.2.8 react-dom@19.2.8 react-router@7.18.3 motion@13.2.0 @react-three/fiber@9.7.0 @react-three/drei@10.7.8 three@0.186.0 zustand@5.0.15 tailwindcss@4.3.3 @tailwindcss/vite@4.3.3 clsx@2.1.1
npm install --save-exact --save-dev @types/three@0.186.0
rm -f src/App.css src/App.tsx src/index.css src/assets/react.svg public/vite.svg
mkdir -p src/{app,styles,lib,store,components/{ui,shell,map},pages/{admin,responder,m},features/{landing,admin,drill,responder,phone,novel},three/{node/partMeshes,mesh,shared},data} public/maps
npm ls @react-three/fiber   # must show no peer warnings
```

**`vite.config.ts`** (exact):

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
      '@hardware': fileURLToPath(new URL('../hardware', import.meta.url)),
    },
  },
  server: {
    host: true, port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api':  { target: 'http://localhost:8000', changeOrigin: true },
      '/live': { target: 'ws://localhost:8000', ws: true, changeOrigin: true },
    },
  },
  build: { chunkSizeWarningLimit: 1600 },
})
```

Add `"paths": { "@/*": ["./src/*"], "@shared/*": ["../shared/*"], "@hardware/*": ["../hardware/*"] }` and `"baseUrl": "."` to `tsconfig.app.json`, and `"resolveJsonModule": true`.

**`index.html`**: `<title>Sentinel</title>`, `<meta name="theme-color" content="#0A0908">`, `<style>html{background:#0A0908}</style>` (no white flash), inline SVG favicon as a data URI (a 6px cyan dot on soot; no emoji), `<div id="root">`.

**`src/styles/app.css`**: DESIGN §9 verbatim (the whole `@import` / `@theme` / `@layer base` / `@utility` block). Nothing added. Imported once in `main.tsx`.

**`src/main.tsx`**:

```tsx
import '@/styles/app.css'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  </StrictMode>,
)
```

**`src/app/router.tsx`**: `createBrowserRouter` with every route as a separate page file (lazy via `React.lazy` for `/hardware` only, so three.js stays out of the main chunk):

| Path | Page file | Shell | Owner of page file |
|---|---|---|---|
| `/` | `pages/Landing.tsx` | none (landing has its own bar) | fe-landing |
| `/login` | `pages/Login.tsx` | none | fe-responder |
| `/admin` | `pages/admin/Overview.tsx` | DesktopShell, `RequireRole admin` | fe-admin |
| `/admin/drill` | `pages/admin/Drill.tsx` | DesktopShell | fe-drill |
| `/admin/air` | `pages/admin/Air.tsx` | DesktopShell | fe-admin |
| `/admin/alerts` | `pages/admin/Alerts.tsx` | DesktopShell | fe-admin |
| `/admin/nodes` | `pages/admin/Nodes.tsx` | DesktopShell | fe-admin |
| `/drills/:id/report` | `pages/admin/DrillReport.tsx` | none (printable) | fe-drill |
| `/responder` | `pages/responder/Queue.tsx` | DesktopShell, `RequireRole responder admin` | fe-responder |
| `/responder/incident/:code` | `pages/responder/IncidentDetail.tsx` | DesktopShell | fe-responder |
| `/responder/audit` | `pages/responder/Audit.tsx` | DesktopShell | fe-responder |
| `/hardware` | `pages/Hardware.tsx` (lazy) | none (own bar) | fe-hardware-3d |
| `/m` | `pages/m/RolePicker.tsx` | PhoneShell | fe-phone |
| `/m/report` | `pages/m/Report.tsx` | PhoneShell | fe-phone |
| `/m/status` | `pages/m/Status.tsx` (`?code=`) | PhoneShell | fe-phone |
| `/m/staff` | `pages/m/Staff.tsx` | PhoneShell | fe-drill |
| `/m/responder` | `pages/m/Responder.tsx` | PhoneShell | fe-phone |
| `*` | `pages/NotFound.tsx` | none | scaffold |

Each stub page renders `<PageHeader title="<route>" />` and the text "stub" so the router is verifiable at 11:15.

**`src/lib/types.ts`**: CONTRACT §8.1 verbatim, plus at the bottom:

```ts
// ---- Time Machine (NOVELTY §3.1) ------------------------------------------
export interface TimelineReading { node_id: NodeId; sim_ts: ISO; pm25: number; temp_c: number; band: BandKey }
export interface TimelineResponse {
  site_id: number; step_s: number; from: ISO; to: ISO; sim_now: ISO | null;
  readings: TimelineReading[];
  alerts: Pick<Alert, 'id' | 'kind' | 'priority' | 'node_id' | 'node_label' | 'started_at' | 'cleared_at' | 'reason'>[];
  decisions: DecisionLogEntry[];
  incidents: { code: IncidentCode; type: IncidentType; sim_at: ISO | null; trust_score: number; status: IncidentStatus; node_id: NodeId | null }[];
}
// ---- Sky vs Building (NOVELTY §3.2) ---------------------------------------
export interface ExplainCheck { name: string; expr: string; lhs: number; op: string; rhs: number; pass: boolean }
export interface ExplainResponse {
  node: Pick<Node, 'id' | 'label' | 'site_id' | 'indoor'>;
  at: ISO; branch: 'LOCAL_FIRE' | 'HAZARDOUS_SMOKE' | 'LOCAL_SMOKE_SUSPECT' | 'CLEAR';
  verdict: string;
  eval: { pm25: number; pm_rise: number; temp_rise: number; gas_delta: number; regional: number; ratio: number };
  neighbours: { id: NodeId; label: string; pm25: number }[];
  checks: ExplainCheck[];
  thresholds: Pick<PolicyPack, 'pm_rise' | 'temp_rise' | 'gas_delta' | 'regional_factor' | 'hazardous_pm25' | 'hazardous_regional'>;
  outlier: boolean;
}
```

**`src/lib/api.ts`**: every function in CONTRACT §8.2, implemented (they are thin). Plus `getTimeline(siteId, stepS = 300): Promise<TimelineResponse>` → `GET /api/timeline?site_id=&step=`, and `getExplain(nodeId, at?): Promise<ExplainResponse>` → `GET /api/nodes/{id}/explain?at=`. `ApiClientError` class. Base URL `''`. Headers from `lib/fp.ts` and `store/session.ts`.

**`src/lib/live.ts`**: `connectLive(opts)` per CONTRACT §8.2: reconnect 0.5 s → 8 s with jitter, `ping` every 20 s, messages queued and flushed on `requestAnimationFrame` to `store/dispatch.ts`, `onStatus`. Also exports `useLive()` hook used once in each shell (DesktopShell, PhoneShell, Landing does not connect).

**`src/lib/fp.ts`**: `getDeviceFp()` per CONTRACT §4.1, `setBlockedFpForDemo(on: boolean)` (the hidden dev toggle).

**`src/lib/time.ts`**: `fmtSim(iso, 'HH:mm' | 'HH:mm:ss' | 'HH:mm:ss.SSS')` with `timeZone: 'UTC'`; `fmtWall(iso, ...)` local zone; `relative(iso) -> "4 min ago"`; `elapsed(seconds) -> "04:18"`; `clockNow() -> "15:12 PDT"`.

**`src/lib/bands.ts`**: `BAND_META: Record<BandKey, { label, shortLabel, color: string (DESIGN 3.3 hex), dimClass, solidPill: boolean, headline, guidance }>`; `bandOf(pm25)`; `bandIndex(key)`. Headlines are DESIGN §6.7's six strings. `ALERT_META: Record<AlertKind, { label, color, priority }>`. `TRUST_META`, `STATUS_META` (incident), `NODE_STATUS_META`.

**`src/store/`** (zustand 5, `create<T>()(...)`, one slice per file, no combined store):

| File | State | Actions |
|---|---|---|
| `session.ts` | `token, user, role, classInfo, pickedNodeId` (persisted to `localStorage` keys `sentinel.token`, `sentinel.node`) | `setAuth(me)`, `logout()`, `pickNode(id)` |
| `site.ts` | `site, tenant, zones, nodes: Record<NodeId, Node>, links, readings: Record<NodeId, Reading[]> (cap 240), decisionCard, openAlerts: Alert[], stats, loaded, error` | `hydrate(overview)`, `applyReading(ev)`, `applyNodeStatus(ev)`, `applyAlert(a)`, `applyAlertCleared(a)`, `applyDecisionCard(c)` |
| `incidents.ts` | `byCode: Record<code, Incident>, order: code[], lastCreated: Incident\|null, pingSeq: number` | `hydrate(list)`, `upsert(inc)`, `applyEvent(msg)` |
| `mesh.ts` | `hops: MeshLogEntry[]` (ring 200), `lastHop, hopSeq, dropCount` | `push(entry)`, `hydrate(entries)` |
| `sms.ts` | `messages: SmsMessage[]`, `count` | `hydrate(outbox)`, `push(m)` |
| `drills.ts` | `active: Drill\|null`, `history: Drill[]` | `hydrate`, `setActive`, `applyRollcall(msg)`, `ended(d)` |
| `sim.ts` | `simState: SimState\|null, connected: boolean, wsStatus: 'connecting'\|'open'\|'closed', hello` | `setSim(s)`, `setWs(status)`, `setHello(h)` |
| `ui.ts` | `selectedNodeId, mapMode: 'air'\|'mesh', explainNodeId: NodeId\|null, weaAlertId: number\|null, toasts: Toast[], audioUnlocked` | `selectNode`, `setMapMode`, `openExplain(id)`, `closeExplain()`, `openWea(alertId)`, `closeWea()`, `toast(text)`, `dismiss(id)`, `unlockAudio()` |
| `timeline.ts` | `active: boolean, t: ISO\|null, data: TimelineResponse\|null, playing, speed: 1\|10, frame: { nodes: Record<NodeId, { pm25; temp_c; band }>; card: DecisionCard\|null; alerts: Alert[] } \| null` | `load(data)`, `scrubTo(iso)`, `goLive()`, `setPlaying`, `setSpeed`: scaffold implements `load/goLive` and leaves `scrubTo` computing `frame` as `// OWNER: fe-novel` |
| `dispatch.ts` | routes `LiveMessage` → slices per CONTRACT §6.1 table; on `incident_created` increments `pingSeq` and toasts | |
| `select.ts` | **the Time Machine seam**: `useDisplayNodes(): Node[]` (live nodes with `latest.pm25/band` overridden from `timeline.frame` when `timeline.active`), `useDisplayCard(): DecisionCard\|null`, `useDisplayAlerts(): Alert[]`, `useDisplayClock(): ISO\|null` | |

fe-admin, fe-responder and fe-landing read nodes/card/alerts **only** through `select.ts` hooks. That is what makes scrubbing work without fe-novel touching their files.

**`src/components/ui/`** (scaffold implements fully, DESIGN §6; props are the public API and do not change):

| Component | Props |
|---|---|
| `Button` | `variant: 'primary'\|'secondary'\|'ghost'\|'danger'\|'resolve'`, `size: 'desktop'\|'phone'`, `icon?: LucideIcon`, `loading?` |
| `Pill` | `kind: 'trust'\|'band'\|'incident'\|'node'\|'alert'\|'code'`, `value: string`, `dot?: boolean` (6.2 rules baked in) |
| `BandBadge` | `band: BandKey`, `size: 'sm'\|'lg'`, `ground: 'dark'\|'light'` (solid for unhealthy and up) |
| `Panel` | `title: string`, `meta?: ReactNode`, `right?: ReactNode` (SIM tag slot), `live?: boolean`, `padded?: boolean`, `className?` |
| `DataTable<T>` | `columns: { key, header, align?, mono?, width?, render? }[]`, `rows: T[]`, `rowKey`, `selectedKey?`, `onSelect?`, `empty: string`, `loading?`, `sticky?` |
| `StatStrip` | `items: { value: string; label: string }[]` (Archivo 56px `stat-number`) |
| `PageHeader` | `eyebrow?`, `title`, `right?: ReactNode` |
| `SimTag` | `kind: 'nodes'\|'sms'\|'phone'\|'mesh'` → exact DESIGN §6.13 strings |
| `LiveDot` | reads `useSimStore.wsStatus`; `LIVE` / `RECONNECTING` |
| `Input`, `Textarea`, `Segmented`, `Stepper`, `EmptyState`, `Skeleton`, `Toasts` | `Segmented` (`options`, `value`, `onChange`); `Stepper` (phone 64px); `EmptyState` (`text`, `action?`); `Skeleton` (three bars); `Toasts` (reads ui store, plays the 2-note WebAudio tone when `pingSeq` changes and route starts with `/responder` and `audioUnlocked`) |
| `CodeCells` | `code: string`, `size: 'phone'\|'desktop'` (DESIGN §6.9) |
| `TrustMeter` | `score`, `label`, `breakdown: TrustLine[]`, `compact?` (DESIGN §6.8) |
| `Timeline` | `events: IncidentEvent[] \| IncidentPublic['timeline']`, `newestFirst?` (DESIGN §6.10) |
| `Banner` | reads `useDisplayAlerts()` + `useDisplayCard()`; highest priority wins; LOCAL_FIRE solid alarm (DESIGN §6.12) |

**`src/components/shell/`**:

- `DesktopShell.tsx`: DESIGN §8: 56px top bar (wordmark, site name from session, route tabs by role: admin → Overview/Drill/Air/Alerts/Nodes, responder → Queue/Audit; active tab 2px signal underline), right: `LiveDot`, mono clock ticking each second, user chip with logout. Below: `<Banner/>` slot, then `<Outlet/>` in a 24px-gutter 1600px container. Mounts `<Grain/>`, `<Toasts/>`, `<ExplainDrawer/>` (from `features/novel`). Calls `useLive()` once and `hydrate` from `getOverview(user.site_id)` on mount and on WS reconnect (responder hydrates site 1 for the map and `listIncidents()` for the queue). **No sidebar** (DESIGN §8 overrides the task brief's "sidebar"; every role has at most five routes).
- `PhoneShell.tsx`: `data-ground="field"`, 390px-centred column on desktop, band banner (from `getNode(pickedNodeId).banner`, refreshed on `alert`/`node_status` WS events), `<Outlet/>`, `SimTag kind="phone"` at the bottom of `/m` only. Owner after scaffold: **fe-phone**.
- `RequireRole.tsx`: `roles: Role[]`; redirects to `/login?next=`.
- `Grain.tsx`: `<div aria-hidden className="grain" />`.

**`src/components/map/CampusMap.tsx`**: the shared map. Scaffold writes the **props interface and a minimal renderer** (links as dashed hairlines, 12px dots coloured by band, squares for gateways, labels). fe-admin owns it from 11:15 and upgrades in place (rings, pulses, hop dashes, ground footprints, selection, air/mesh modes). Interface (frozen):

```ts
export interface CampusMapProps {
  nodes: Node[]; links: [NodeId, NodeId][]; zones?: Zone[];
  mode: 'air' | 'mesh'; selectedId?: NodeId | null; onSelect?: (id: NodeId) => void;
  hops?: MeshLogEntry[];            // recent hops to animate (the map decides which are new by id)
  highlightCode?: IncidentCode;     // pulse the node of this incident
  ground: 'campus' | 'floorplan';   // which footprint layer
  compact?: boolean;                // landing hero card / incident detail crop
  className?: string;
}
```

**`src/features/novel/`**: three stubs that render `null`, owned by fe-novel: `TimeMachine.tsx` (mounted by `pages/admin/Overview.tsx` as the bottom 96px strip), `ExplainDrawer.tsx` (mounted by DesktopShell; opens when `ui.explainNodeId` is set), `WeaDraftModal.tsx` (mounted by `pages/responder/IncidentDetail.tsx`; opens when `ui.weaAlertId` is set). The mount points are written by the scaffold into the stub pages so owners inherit them.

**`src/components/SafetyFooter.tsx`**: stub, owner fe-landing; imported by Landing and Hardware.

**`public/maps/roosevelt-campus.svg`**, **`public/maps/harbor-island-floor1.svg`**: empty `viewBox="0 0 1000 700"` SVGs with a comment; owner fe-admin.

**`src/three/`**: directory only plus `three/shared/FrameloopController.tsx` stub; owner fe-hardware-3d.

Verify: `npm run build` passes with zero TypeScript errors; `npm run dev` shows every route rendering its stub header at 1440 and 390 wide; no console errors. Commit: `Add frontend shell, router stubs, stores, UI primitives`. Append `[11:15] [scaffold] SCAFFOLD B READY`.

### 1.4 Seeded demo identities (everyone uses these)

| Who | Login |
|---|---|
| Admin (school) | `admin@sentinel.demo` / `sentinel` → site 1 Roosevelt High School |
| Admin (warehouse) | `ops@sentinel.demo` / `sentinel` → site 2 Harbor Island DC-4 |
| Responder | `responder@sentinel.demo` / `sentinel` |
| Teacher 3B | staff code `T-3B-7Q2` (class 3B, 30 students, muster `field`) |
| Blocked device | `X-Device-Fp: demo-blocked-device` |

### 1.5 Frozen after 11:15 (scaffold-owned, changes only via INTEGRATION_NOTES)

`shared/topology.json` · `backend/app/{config,timefmt,models,db,envelope,security,deps,state,ws,seed,main}.py` · `backend/requirements.txt` · `simulator/requirements.txt` · `Makefile` · `scripts/*` · `frontend/{package.json,vite.config.ts,tsconfig*.json,index.html}` · `frontend/src/{main.tsx,app/router.tsx,styles/app.css}` · `frontend/src/lib/{types,api,live,fp,time,bands}.ts` · `frontend/src/store/{session,site,incidents,mesh,sms,drills,sim,ui,dispatch,select}.ts` · `frontend/src/components/ui/*` · `frontend/src/components/shell/{DesktopShell,RequireRole,Grain}.tsx`.

Adding a new export to a frozen file is allowed for the integrator only, and only when a note asks for it.

---

## 2. IMPLEMENT step (13 parallel agents, 10:55/11:15 to 14:30)

Common acceptance for every agent: your files compile (`npm run build` / `python -c "import app.main"`), no `OWNER:` lines remain in files you finished, no "Cascadia" in anything you wrote, DESIGN §11 grep checks pass on your files, and every list/fetch you render has empty, loading and error states.

Every curl below assumes `make backend` and `make sim` are running and `T=$(curl -s -XPOST localhost:8000/api/auth/login -H 'content-type: application/json' -d '{"email":"admin@sentinel.demo","password":"sentinel"}' | jq -r .data.token)` (and `R=` for responder).

### 2.1 backend-core

**Owns:** `backend/app/core/{auth,nodes,sites,incidents,trust,mesh,sim}.py`, `backend/tests/test_core.py`, `backend/tests/test_smoke.py`.

**Inputs:** CONTRACT §0 (envelope, headers), §2 (auth), §3.1 shapes, §3.2, §3.3, §3.4 (`/sites`, `/sites/{id}/overview`; `air` and `decision-card` are backend-alerts), §3.6, §3.7, §3.9 (`mesh-message`, `sim-state` only), §4 (trust), §6 (WS types `incident_created`, `incident_event`, `hop`, `node_status`, `sim_state`).

**Build:**
- `auth.py`: `/auth/login`, `/auth/staff`, `/auth/me`.
- `nodes.py`: `/nodes`, `/nodes/{id}` (with `ssid`, `banner`), `/nodes/{id}/readings` (reads `state.rings` first, falls back to SQL for `minutes > 120`), `node_to_dict`, `compute_node_status` (CONTRACT §3.3 rule), `node_status_payload`.
- `sites.py`: `/sites`, `/sites/{id}/overview` (calls `alerts.decision.get_decision_card`, `drills.service.get_active_drill`, `alerts.serialize.alert_to_dict`; `links` de-duplicated from `neighbours`; `stats`; `sim` from `state.sim_state`).
- `incidents.py`: full CONTRACT §3.6 sequence including `DEVICE_BLOCKED`, `RATE_LIMITED`, flood guard → `queued`, `sim_at = state.sim_state["sim_ts"] if state.sim_state else None`, WS `incident_created`, relay via `mesh.relay_to_sim`; `GET /incidents/{code}` public vs full; list with sort; `/responder/incidents`; `POST /incidents/{code}/events` with the transition table and `device_history` increments; `/responder/audit`.
- `trust.py`: `score_incident(...)` exactly CONTRACT §4.2 (pure, never raises), `new_code()`, `haversine()`. Unit test the six rows of CONTRACT §4.3.
- `mesh.py`: `POST /ingest/mesh-message` (insert `mesh_log`, broadcast `hop`, `relayed` event on `delivered`/`failed` for incidents, set `incident.mesh`), `GET /mesh/log`, `relay_to_sim()` (httpx, 2 s timeout, swallow errors).
- `sim.py`: `GET /api/health`, `POST /api/sim/control` (proxy, 2 s timeout, `SIM_UNAVAILABLE`), `GET /api/sim/state`, `POST /api/ingest/sim-state` (cache in `state`, broadcast `sim_state`).

**Acceptance:**
```bash
curl -s localhost:8000/api/health | jq -e '.ok and .data.db'
curl -s -XPOST localhost:8000/api/auth/staff -H 'content-type: application/json' -d '{"staff_code":"t-3b-7q2"}' | jq -e '.data.class.roster_size==30'
curl -s -XPOST localhost:8000/api/incidents -H 'content-type: application/json' -H 'X-Device-Fp: fp-test1' -H 'X-Node-Id: gym' -d '{"type":"trapped","count":2}' | jq -e '.data.code|test("^SN-[A-HJ-NP-Z2-9]{4}$")'
curl -s -XPOST localhost:8000/api/incidents -H 'content-type: application/json' -H 'X-Device-Fp: demo-blocked-device' -H 'X-Node-Id: gym' -d '{"type":"fire","count":1}' | jq -e '.error.code=="DEVICE_BLOCKED"'
C=<code>; curl -s -XPOST localhost:8000/api/incidents/$C/events -H "Authorization: Bearer $R" -H 'content-type: application/json' -d '{"action":"resolve","note":"walked out"}' | jq -e '.data.status=="resolved"'
curl -s -XPOST localhost:8000/api/incidents/$C/events -H "Authorization: Bearer $R" -H 'content-type: application/json' -d '{"action":"acknowledge","note":""}' | jq -e '.error.code=="INVALID_TRANSITION"'
curl -s localhost:8000/api/sites/1/overview -H "Authorization: Bearer $T" | jq -e '.data.nodes|length==8'
websocat ws://localhost:8000/live | head -1 | jq -e '.type=="hello"'
cd backend && .venv/bin/pytest -q
```

**Constraints:** do not edit `models.py`, `state.py`, `ws.py`, `deps.py`. Do not implement anything under `/api/alerts`, `/api/sms`, `/api/drills`, `/api/timeline`, `/api/wea`, `/api/sites/{id}/air`, `/api/sites/{id}/decision-card`, `/api/nodes/{id}/explain` (backend-alerts owns explain under its own router with the `/nodes/{id}/explain` path; two routers may share a path prefix).

### 2.2 backend-alerts

**Owns:** `backend/app/alerts/{bands,engine,decision,sms,ingest,routes,serialize,wea,explain}.py`, `backend/tests/test_engine.py`.

**Inputs:** CONTRACT §3.4 (`air`, `decision-card`), §3.5, §3.6 (`/wea/draft` shape), §3.9 (`telemetry`), §5 entire, §6 WS types `reading`, `alert`, `alert_cleared`, `decision_card`, `sms_sent`, `node_status`. NOVELTY §3.2 (explain), §3.3 (WEA template rules: FRW / event codes, 90/360 truncation at word boundaries, polygon vertex cap 100 with Douglas-Peucker, CAP 1.2 XML string as an extra `cap_xml` field). SIM_WORLD §10 (two gotchas). spec §6.

**Build:**
- `engine.py`: `evaluate()` pure per CONTRACT §5.2, plus the two SIM_WORLD §10 rules: (1) **escalation**: if LOCAL_FIRE matches while HAZARDOUS_SMOKE or LOCAL_SMOKE_SUSPECT is open at the node, emit `clear` for the lower one and `open` LOCAL_FIRE in the same tick, reason prefixed `"Escalated from HAZARDOUS_SMOKE: "`; (2) LOCAL_SMOKE_SUSPECT requires two consecutive matching readings (track in `state.last_eval[node_id]["suspect_streak"]`). Returns `(decisions, eval_record)` where `eval_record` is the NodeEval-shaped dict with `checks` computed server-side.
- `ingest.py`: `POST /ingest/telemetry` (single or array), idempotent insert, update node, push ring, evaluate, apply decisions (insert/clear alerts, SMS fan-out for priority ≤ 2, node_status broadcast via `core.nodes.node_status_payload`), decision card per §5.3, write `node_evals` (keep 60 per node: delete older rows every 20 inserts), set `state.last_eval`. Returns `{accepted, duplicates, rejected, alerts_opened, alerts_cleared}`.
- `decision.py`: rolling 10-min mean per outdoor node, `decision_log` insert, `ACTIVITY_ADVISORY` open/clear, `get_decision_card()`, `GET /sites/{id}/decision-card`, `GET /sites/{id}/air` (downsample by SQL `GROUP BY node_id, substr(ts,1,16)`-style buckets, or in Python; under 200 KB).
- `sms.py`: fan-out, dedup, all-clear tracker, `GET /sms/outbox`, bodies from §5.4; broadcast `sms_sent`.
- `routes.py`: `GET /alerts`, `GET /recipients`, `POST /zones/{id}/recipients`, `GET/PUT /tenants/{id}/thresholds` with validation, `GET /wea/draft`.
- `wea.py`: deterministic template; `LOCAL_FIRE → FRW Extreme/Immediate/Observed`; `HAZARDOUS_SMOKE → AQA Severe/Immediate/Observed` (CONTRACT's code; NOVELTY's `SPW` is not used); 409 `INVALID_TRANSITION` if priority > 2; `eligible: bool` and `eligibility_note` fields added (NOVELTY wants ≥ 2 nodes affected; compute `nodes_affected` = open priority ≤ 2 alerts in the zone; single-node LOCAL_FIRE is still eligible so the demo works, the note says why).
- `explain.py`: `GET /nodes/{id}/explain?at=` from `state.last_eval` (default) or nearest `node_evals` row; `verdict` strings: LOCAL_FIRE `"This node is {ratio:.1f}x its neighbours and heat is rising. This is a fire here, not smoke from outside."`; HAZARDOUS_SMOKE `"Every node is high together. This is the sky, not the building."`; LOCAL_SMOKE_SUSPECT `"This node is climbing alone with no heat. Ask staff to look."`; CLEAR `"Nothing out of the ordinary at this node."`; `outlier` = `|pm25 − median| > 3 × MAD` of neighbours with `temp_rise < 1` and `gas_delta < 50`.

**Acceptance:**
```bash
curl -s -XPOST localhost:8000/api/sim/control -H "Authorization: Bearer $T" -H 'content-type: application/json' -d '{"action":"jump","t":"smoke"}'; sleep 4
curl -s localhost:8000/api/sites/1/decision-card -H "Authorization: Bearer $T" | jq -e '.data.band=="unhealthy" and .data.node_id=="field"'
curl -s -XPOST localhost:8000/api/sim/control -H "Authorization: Bearer $T" -H 'content-type: application/json' -d '{"action":"trigger_fire","node_id":"gym"}'; sleep 3
curl -s 'localhost:8000/api/alerts?open=true&site_id=1' -H "Authorization: Bearer $T" | jq -e '[.data[]|select(.kind=="LOCAL_FIRE")]|length==1 and (.[0].node_id=="gym")'
curl -s 'localhost:8000/api/sms/outbox?site_id=1' -H "Authorization: Bearer $T" | jq -e '.data.count>=12'
curl -s localhost:8000/api/nodes/gym/explain -H "Authorization: Bearer $T" | jq -e '.data.branch=="LOCAL_FIRE" and (.data.checks|length)>=3'
A=$(curl -s 'localhost:8000/api/alerts?open=true' -H "Authorization: Bearer $T" | jq '[.data[]|select(.kind=="LOCAL_FIRE")][0].id'); curl -s "localhost:8000/api/wea/draft?alert_id=$A" -H "Authorization: Bearer $R" | jq -e '.data.event_code=="FRW" and (.data.text_90|length)<=90 and (.data.text_360|length)<=360'
curl -s -XPOST localhost:8000/api/sim/control -H "Authorization: Bearer $T" -H 'content-type: application/json' -d '{"action":"clear"}'; sleep 6; curl -s 'localhost:8000/api/alerts?open=true&site_id=1' -H "Authorization: Bearer $T" | jq -e '[.data[]|select(.kind=="LOCAL_FIRE")]|length==0'
cd backend && .venv/bin/pytest -q tests/test_engine.py   # includes: CONTRACT §7.2 gym-fire numbers → LOCAL_FIRE; all-nodes-rising → no LOCAL_FIRE; escalation case
```

**Constraints:** do not edit `models.py` (NodeEval already exists), `state.py`, `core/*`. Node status recompute goes through `core.nodes.node_status_payload`. If the engine needs a new `state` field, INTEGRATION_NOTES.

### 2.3 backend-drills

**Owns:** `backend/app/drills/{routes,service,report,timeline}.py`, `backend/tests/test_drills.py`.

**Inputs:** CONTRACT §3.8, §3.1 `Drill` shape, §6 WS `drill_started`, `rollcall`, `drill_ended`. NOVELTY §3.1 for the `/timeline` endpoint, using the `TimelineResponse` type in `frontend/src/lib/types.ts` as the exact shape.

**Build:**
- `routes.py`: `POST /drills` (409 on second open drill), `GET /drills`, `GET /drills/active`, `GET /drills/{id}`, `POST /drills/{id}/rollcall` (validation messages exactly as CONTRACT), `POST /drills/{id}/end`, `GET /drills/{id}/report`, `GET /export/drill/{id}.csv` (raw `text/csv`, not enveloped).
- `service.py`: `get_active_drill`, `drill_to_dict` (summary, classes with `state`, `missing`), elapsed math.
- `timeline.py`: `GET /timeline?site_id=1&step=300&from=&to=` → readings decimated to one point per node per `step` sim-seconds (mean pm25, mean temp, band of mean), all alerts in range, `decision_log` entries, incidents with `sim_at`, `sim_now` from `state.sim_state`. Default range: 07:00 to the latest reading. Must return in under 300 ms for a full day at 30 s ticks (14 nodes × 1560 readings): do the decimation in SQL (`GROUP BY node_id, CAST(strftime('%s', ts) / :step AS INTEGER)`).

**Acceptance:**
```bash
D=$(curl -s -XPOST localhost:8000/api/drills -H "Authorization: Bearer $T" -H 'content-type: application/json' -d '{"site_id":1,"kind":"fire"}' | jq .data.id)
TT=$(curl -s -XPOST localhost:8000/api/auth/staff -H 'content-type: application/json' -d '{"staff_code":"T-3B-7Q2"}' | jq -r .data.token)
curl -s -XPOST localhost:8000/api/drills/$D/rollcall -H "Authorization: Bearer $TT" -H 'content-type: application/json' -d '{"class_id":2,"node_id":"field","present":28,"missing_refs":["S-3B-07","S-3B-19"]}' | jq -e '.data.summary.with_missing==1 and (.data.missing|length==2)'
curl -s -XPOST localhost:8000/api/drills/$D/rollcall -H "Authorization: Bearer $TT" -H 'content-type: application/json' -d '{"class_id":2,"node_id":"field","present":27,"missing_refs":["S-3B-07"]}' | jq -e '.error.code=="VALIDATION_ERROR"'
curl -s -XPOST localhost:8000/api/drills -H "Authorization: Bearer $T" -H 'content-type: application/json' -d '{"site_id":1,"kind":"fire"}' | jq -e '.error.code=="CONFLICT"'
curl -s -o /tmp/d.csv -w '%{content_type}\n' localhost:8000/api/export/drill/$D.csv -H "Authorization: Bearer $T" | grep -q text/csv && head -1 /tmp/d.csv | grep -q '^class,teacher'
curl -s -XPOST localhost:8000/api/drills/$D/end -H "Authorization: Bearer $T" | jq -e '.data.ended_at!=null'
curl -s 'localhost:8000/api/timeline?site_id=1&step=300' -H "Authorization: Bearer $T" | jq -e '(.data.readings|length)>0 and (.data.decisions|length)>=1'
```

**Constraints:** do not touch `core/*` or `alerts/*`. The teacher's `class_id` check comes from `Principal.class_id`.

### 2.4 simulator

**Owns:** `simulator/{main,world,mesh,control,clock,backend_client}.py`, `simulator/README.md`.

**Inputs:** CONTRACT §7 entire (process model, scripted day §7.2 with its exact phases, speeds `1/10/60/300`, start paused at 07:30, 30-sim-second ticks, control API §7.5, relay reporting §7.3, SimState §7.4), §3.9 payloads, §1.2 topology. SIM_WORLD §6 and §8 for **technique only**: hashed deterministic noise `(seed, node, channel, bucket)`, per-node bias, fire curve shape (smoulder then growth, RH collapse `rh *= exp(-0.058·ΔT)`), outdoor battery drain, RSSI jitter. Node ids, sites, speeds and endpoints are CONTRACT's.

**Build:**
- `world.py`: `R(t)` piecewise per CONTRACT §7.2; `reading(node, sim_t, overrides) -> dict`; overrides `trigger_fire/trigger_smoke/clear` with CONTRACT's ramps; deterministic noise from SIM_WORLD §8 `_rng/white/drift`; warehouse nodes factor 0.5.
- `clock.py`: `sim_t` seconds since 07:00, `sim_ts()`, play/pause/speed/jump (`calm|smoke|fire|int|HH:MM`), auto-pause at 20:00.
- `mesh.py`: 14 `VirtualNode`s with UDP sockets `9000+i`, real flood with `msg_id` dedup and `ttl`, random back-off 10 to 200 ms, **15 % drop per link** (`SIM_DROP`), BFS planned path to the site gateway, reporting one `POST /api/ingest/mesh-message` per hop attempt exactly per CONTRACT §7.3 pacing (400 ms per hop, 3 s retry, 4 attempts then `failed`). `trigger_fire` also originates a `kind:"alarm"` message.
- `control.py`: aiohttp server `127.0.0.1:8001` with `GET /state`, `POST /control`, `POST /relay` (202 with planned path), envelope responses, 422 on bad action.
- `backend_client.py`: aiohttp session, `X-Sim-Key`, batched telemetry POST per tick, `sim-state` push every 1 s wall and after each control action, retry with backoff when the backend is down (never crash).
- `main.py`: wires it all; env per CONTRACT §9; `--speed`, `--seed` flags.

**Acceptance:**
```bash
curl -s 127.0.0.1:8001/state | jq -e '.data.playing==false and .data.sim_clock=="07:30" and .data.phase=="calm"'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"play"}' | jq -e '.data.playing'
sleep 3; curl -s localhost:8000/api/health | jq -e '.data.sim_connected'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"jump","t":"fire"}' | jq -e '.data.phase=="fire" and (.data.overrides.fire_nodes|index("gym"))!=null'
curl -s -XPOST 127.0.0.1:8001/relay -H 'content-type: application/json' -d '{"msg_id":"m-deadbeef","origin_node":"parking","kind":"incident","payload":{"code":"SN-TEST","type":"trapped","count":1}}' | jq -e '.data.planned_path==["parking","arts","library","hub"]'
sleep 8; curl -s 'localhost:8000/api/mesh/log?msg_id=m-deadbeef' -H "Authorization: Bearer $T" | jq -e '[.data.entries[]|select(.status=="delivered")]|length==1'
# determinism: two runs with SIM_SEED=42 produce identical first-tick readings
# resilience: start simulator before backend; it must connect within 10 s of backend start without restart
```

**Constraints:** reads `../shared/topology.json` only; never imports from `backend/`. Does not compute bands or alerts (the backend does). Drops in the mesh are the only randomness not derived from the seed bucket hash if that is simpler; log the RNG seed at startup either way.

### 2.5 fe-landing

**Owns:** `frontend/src/pages/Landing.tsx`, `frontend/src/features/landing/*` (`HeroCard.tsx`, `HeroLoop.ts` scripted 24 s data loop, `Steps.tsx`, `PullQuote.tsx` with the 8-line inline SVG chart, `Pricing.tsx`, `LandingBar.tsx`), `frontend/src/components/SafetyFooter.tsx`.

**Inputs:** DESIGN §8.1 (layout, copy, sizes, the 24 s loop), §1 (signature hop), §4 (hero type recipes), §10 (copy rules and verbatim lines), spec §0, §1, §4.4, §11.4, NOVELTY §4 and §5 for copy.

**Build:** the Mosaic-derived skeleton in dark: bar, eyebrow, 3-line `display-hero` headline, lead, two buttons (`/admin` via `/login`, `/hardware`), hero card with `<CampusMap compact ground="campus" mode="mesh">` fed by `HeroLoop` (imports `@shared/topology.json`; no backend; calm → smoke → gym fire → incident hop → resolved; 4-line feed; mini decision card), one radial glow, `StatStrip` (`$31`, `8`, `0`, `3 days`), numbered steps, pull statement with the one-spikes chart, asymmetric pricing columns, `SafetyFooter` (911 line, designed-not-fabricated line, event/repo/Devpost line). Load choreography per DESIGN §7 (hero lines rise; nothing else animates on scroll). Under 900px: card below copy, 2×2 strip.

**Acceptance:** `/` renders at 1440 and 390 with zero console errors and **no network requests to `/api`**; hero card cycles and shows a hop dash within 3 s of load; `prefers-reduced-motion` shows the static "fire" frame; DESIGN §11 greps pass; Lighthouse accessibility ≥ 90.

**Constraints:** uses `CampusMap` as given (fe-admin upgrades it); does not edit `components/map/*`. Does not call `useLive()`.

### 2.6 fe-admin

**Owns:** `frontend/src/pages/admin/{Overview,Air,Alerts,Nodes}.tsx`, `frontend/src/features/admin/*` (`DecisionCard.tsx`, `NodeList.tsx`, `OpenIncidents.tsx`, `MeshLog.tsx`, `AirChart.tsx`, `BandHistory.tsx`, `DecisionLog.tsx`, `SmsOutbox.tsx`, `Thresholds.tsx`, `Recipients.tsx`, `NodeTable.tsx`, `SimControls.tsx`), `frontend/src/components/map/*` (`CampusMap.tsx`, `CampusGround.tsx`, `FloorplanGround.tsx`, `HopLayer.tsx`, `NodeDot.tsx`), `frontend/public/maps/*.svg`.

**Inputs:** DESIGN §6.5, §6.6, §6.7, §6.12, §6.14, §6.16, §8.2, §8.4; CONTRACT §3.3, §3.4, §3.5, §3.7, §6.1; SIM_WORLD §3.5 (map drawing conventions only: draw order, node glyph, link opacity, hop dot, dropped `×`) adapted to CONTRACT's node coordinates.

**Build:**
- `CampusMap`: `viewBox 0 0 1000 700`; `CampusGround` draws `--color-line-faint` 1px footprints placed around CONTRACT §1.2 coordinates (hub 500,120; library 300,200; science 700,210; cafeteria 480,330; arts 220,400; gym 760,400; field 520,560 as an ellipse; parking 160,600 as a lot), no fills, no labels except node labels; `FloorplanGround` for site 2 (two racks y≈180 and y≈430, dock office bottom-left). Node dots per DESIGN §6.5 (square for gateway, rings for alerting, double rings for LOCAL_FIRE, selected ring). `HopLayer`: `hops` prop → per-new-entry dash along the link (`motion.circle` or `animateMotion`, 220 ms, `--ease-hop`), dropped dissolves at 60 % with the `×`, delivered flashes the gateway; telemetry hops at 35 % opacity; `.hop-dash` class for the reduced-motion CSS. Copy the same footprints into `public/maps/*.svg` (they are the Devpost map images and satisfy `map_asset`).
- `Overview`: DESIGN §8.2 layout (68/32), `DecisionCard` (count-up, pill cross-fade, headline slide, Hazardous SMS line linking to `/admin/alerts`), `air | mesh` segmented, right column single panel (nodes with mono readings and 24×3 battery bar, open incidents read-only, mesh log 8 lines), `SimControls` (play/pause, speed, jump calm/smoke/fire, trigger fire at selected node, clear; admin only), `<TimeMachine/>` mount at the bottom (already in the stub, keep it). Clicking a node dot calls `ui.selectNode` and `ui.openExplain(id)`.
- `Air`: hand-rolled SVG chart (8 polylines, band threshold rules, crosshair readout, legend hover selects), `BandHistory` bars, `DecisionLog` table; range and node selectors.
- `Alerts`: thresholds form (PUT with validation messages), zones with recipient counts, add-recipient form (E.164 check client-side too), `SmsOutbox` table with `SimTag kind="sms"`, `queued (demo)` status column.
- `Nodes`: table (id, label, zone, floor, fw, last_seen relative, battery, rssi bar, status pill), placement map (`CampusMap mode="air"`), "provisioning" is display only.
- Warehouse variant: when `site.kind === 'floorplan'`, Overview uses `FloorplanGround`, decision card reads "Indoor air" (no outdoor nodes; backend uses all nodes), and a "Notify fire department" secondary button opens a panel pre-filled with `site.address` and `access_notes` (stretch; cut first).

**Acceptance:** login as admin → `/admin` hydrates in one `overview` call; `jump smoke` from SimControls flips the card to "Cancel outdoor practice" with ≈71 within 3 s; `trigger_fire gym` turns only the gym dot alarm-red with double rings and the banner solid red; a phone report from node `gym` shows a dash gym→science→hub and a mesh log line; `/admin/air` draws 8 lines with the gym line spiking alone after the fire; `/admin/alerts` outbox shows ≥ 12 rows with the SIM tag; reduced motion: no dash, log still appends; kill the simulator → LIVE still pulses (WS is backend), SimControls show "simulator offline"; exactly one SIM tag per page.

**Constraints:** read nodes/card/alerts only via `store/select.ts` hooks (never `useSiteStore` directly for those three) so the Time Machine can override them. Do not edit `features/novel/*`, `components/ui/*`, `store/*`. The `CampusMapProps` interface is frozen; add optional props only via INTEGRATION_NOTES.

### 2.7 fe-drill

**Owns:** `frontend/src/pages/admin/{Drill,DrillReport}.tsx`, `frontend/src/pages/m/Staff.tsx`, `frontend/src/features/drill/*` (`RollcallGrid.tsx`, `ClassTile.tsx`, `MissingList.tsx`, `ByMuster.tsx`, `StartDrill.tsx`, `StaffLogin.tsx`, `RollcallForm.tsx`, `RosterChips.tsx`).

**Inputs:** DESIGN §6.11, §8.3, §8.7 (`/m/staff` column), §3.4 and §4.5 (light phone rules); CONTRACT §2.2 (`/auth/staff`), §3.8, §6.1 (`drill_*`, `rollcall`); spec §6.4.

**Build:**
- `/admin/drill`: empty state with kind dropdown and `[Start fire drill]` (primary); live header (kind, started, mono 40px elapsed timer, `[End drill]` danger); `RollcallGrid` of 120×88 tiles with the three states, 240 ms arrival stagger; `MissingList` (warn dot, class, muster node); `ByMuster`; `[Export report]` secondary → opens `/drills/:id/report` in a new tab; CSV link via `drillCsvUrl(id)` as `<a href download>`.
- `/drills/:id/report`: printable light page (this one is light on purpose, `data-ground="field"`), compliance header (RCW 28A.320.125, "verify current text"), class table, missing table, `window.print()` button; `@media print` hides the button.
- `/m/staff`: staff-code entry (64px input, error copy per DESIGN §6.15) → stores token and `classInfo` in session → waiting state "No drill running. This page switches to roll call when the office starts one." → on `drill_started` WS or `getActiveDrill` poll every 5 s → `RollcallForm`: class name 28px, present `Stepper`, roster chips (tap to mark missing; `present` auto = roster − missing, editable), muster node defaults to `class.muster_node_id` with the picker label from CONTRACT §0.7, `[Submit roll call]` (the one `f-signal` button), success state with submitted time and "Resubmit" ghost. Drill ended → "Drill ended at HH:MM. Thank you."

**Acceptance:** start drill on desktop → teacher phone (second browser, `/m/staff`, code `T-3B-7Q2`) switches to roll call within 2 s; submit 28 present + `S-3B-07`, `S-3B-19` → grid tile 3B amber `28 / 30`, `2 missing`, missing list shows both refs with `Athletic Field`; resubmit updates not duplicates; `present + missing ≠ roster` shows the backend's exact message; End drill → tiles freeze, timer stops; `/drills/:id/report` prints; CSV downloads. Phone page: nothing under 14px, targets ≥ 48px, one accent fill.

**Constraints:** do not edit `PhoneShell` (fe-phone owns it); if the staff page needs the banner hidden or changed, INTEGRATION_NOTES. Do not edit `store/drills.ts`.

### 2.8 fe-responder

**Owns:** `frontend/src/pages/Login.tsx`, `frontend/src/pages/responder/{Queue,IncidentDetail,Audit}.tsx`, `frontend/src/features/responder/*` (`QueueList.tsx`, `QueueRow.tsx`, `SplitPane.tsx`, `SensorStrip.tsx`, `ActionsRail.tsx`, `WhereCrop.tsx`, `MessageBox.tsx`, `AuditTable.tsx`, `SoundToggle.tsx`).

**Inputs:** DESIGN §6.2, §6.8, §6.9 (desktop cells), §6.10, §6.12 (ping tone), §8.5, §8.6, §6.1 (`resolve` is the only green button); CONTRACT §2, §3.6, §3.7 (`mesh/log` by `msg_id`), §6.1 (`incident_*`); spec §7.3.

**Build:**
- `/login`: two tabs "Admin" / "Responder" are the same form (email + password), plus a link "Staff? Use the phone page" → `/m/staff`; on success `setAuth` and redirect to `next` or role home. Error copy per DESIGN §10.
- `/responder`: split pane 40/60 with draggable hairline (min 360px); queue rows 72px three lines sorted by priority then trust; selected row signal-dim with left bar; Enter or chevron opens detail; map (`CampusMap mode="mesh" highlightCode=selected`), `SensorStrip` under the map for the selected incident's node; `SoundToggle` in the bar area (Lucide `Volume2`/`VolumeX`) that calls `ui.unlockAudio()`; new incident → row slides in, toast, tone (via `Toasts`).
- `/responder/incident/:code`: DESIGN §8.6: `CodeCells desktop` with `SN` dimmed and the code as `<h1>` text; type/count/trust pill/score; `ActionsRail` (Acknowledge, En route, Resolve disabled until note ≥ 3 chars, Flag false with required note, Merge as ghost with tooltip "not in demo", **Draft WEA** secondary that calls `ui.openWea(alertId)` where `alertId` = an open priority ≤ 2 alert at the incident's node, else disabled with tooltip "Offered when a fire or hazardous-smoke alert is open at this node"); `TrustMeter` full; `Timeline` newest at bottom; `MessageBox`; `WhereCrop` (`CampusMap compact` centred on the node, GPS dot and 100 m ring if lat/lng); "NODE NOW" mono strip; after resolve the rail collapses to the ink-2 sentence. `<WeaDraftModal/>` mount stays where the stub put it.
- `/responder/audit`: `DataTable` of `getAudit()`, newest first, filter by action, IP column mono.

**Acceptance:** login as responder → queue shows the incident created by the phone within 1 s (WS), Verified 70 during a gym fire; Enter opens detail; Acknowledge → En route → Resolve with note → status pill ok, rail collapses, audit shows four rows with actor name and IP; Flag false requires a note; second tab with the same incident updates live; tone plays on new incident only after the speaker toggle was clicked; keyboard navigation through the queue works; `Draft WEA` enabled during the gym fire and disabled during calm.

**Constraints:** read nodes/alerts via `store/select.ts`. Do not edit `features/novel/WeaDraftModal.tsx` (fe-novel). Do not edit `components/map/*`.

### 2.9 fe-phone

**Owns:** `frontend/src/components/shell/PhoneShell.tsx`, `frontend/src/pages/m/{RolePicker,Report,Status,Responder}.tsx`, `frontend/src/features/phone/*` (`BandBanner.tsx`, `NodePicker.tsx`, `TypeTiles.tsx`, `CodeScreen.tsx`, `StatusTimeline.tsx`, `FieldIncidentCard.tsx`, `DevToggle.tsx`).

**Inputs:** DESIGN §3.4, §4.5, §6.9 (phone cells), §8.7 entire; CONTRACT §0.7 (`X-Node-Id` picker label verbatim), §3.3 (`/nodes/{id}` banner), §3.6, §4.1 (fingerprint, dev toggle), §6.1 (`incident_event`, `alert`, `node_status`); spec §7.1, §8.2.

**Build:**
- `PhoneShell`: light ground, 44px band banner (`BandBanner` from `getNode(pickedNodeId).banner`; LOCAL_FIRE turns it into the alarm banner; refresh on `alert`/`alert_cleared`/`node_status` for that node), `NodePicker` sheet on first visit ("pick the node you are standing next to" with the CONTRACT label; `listNodes()` with status pills), `useLive()` with `device_fp`, `SimTag kind="phone"` only on `/m`.
- `/m`: "Sentinel", site · node line, three 72px buttons (`I need help` ink fill, `I'm staff` outline → `/m/staff`, `I'm a responder` outline → `/m/responder`), "Have a code?" input with `SN-` prefix and the alphabet hint, hidden `DevToggle` (long-press the wordmark 1.5 s) for the blocked fingerprint.
- `/m/report`: 2×3 `TypeTiles` (words only), `Stepper` count, optional text (≤ 280), "Share my location" checkbox (browser geolocation, opt-in), `[Send report]` (the one accent fill) → `CodeScreen` with `CodeCells phone`, "No zero, no letter O.", Copy / Check status, live status line via WS `incident_event` for that code. Errors: `DEVICE_BLOCKED` → "This device has been blocked after repeated false reports. Find a staff member."; `RATE_LIMITED` → "You already have 3 open reports. Check their status instead."
- `/m/status?code=`: code mono 40px, 4-step vertical timeline (current step pulses), message blocks, `[Refresh]`; polls every 10 s and updates on WS.
- `/m/responder`: credentials (email/password, 64px) → list of open incidents as 88px cards with `[Acknowledge]` and `[Resolve]` (inline note field appears on tap; Resolve is the accent fill on this page), pull to refresh ghost button.

**Acceptance:** on a phone on the hotspot at `http://<laptop-ip>:5173/m`: pick `gym` during the fire, tap Trapped, 2 people, Send → code appears within 1 s; `/admin` shows the hop; responder resolves → phone status page flips to Resolved without reload; blocked fingerprint toggle → 403 copy shown; internet-only (no node picked) report → "Likely" at most; every tap target ≥ 48px; page works with WS down (polling). No `motion` imports under `pages/m` or `features/phone`.

**Constraints:** `/m/staff` is fe-drill's. Do not edit `lib/fp.ts` or `store/session.ts`.

### 2.10 fe-hardware-3d

**Owns:** `frontend/src/pages/Hardware.tsx`, `frontend/src/three/**` (`node/{NodeScene,NodeModel,parts,materials,Hotspot,useExplodeDriver}.tsx|ts`, `node/partMeshes/*` (15 files + `index.ts`), `mesh/{MeshScene,Pillars,Links,Pulses,CampusOutline,campusGeometry}.tsx|ts`, `shared/{FrameloopController,motionPrefs}.ts(x)`), `frontend/src/features/hardware/*` (`PartCard.tsx`, `PartList.tsx`, `SpecRail.tsx`, `BomTable.tsx`, `PinMap.tsx`, `HopLog3d.tsx`, `HardwareBar.tsx`), `frontend/src/store/hardware.ts` (new slice; allowed because only this agent reads it).

**Inputs:** HARDWARE_3D.md entire for geometry, registry, materials, scene technique, explode driver, tiers, performance budget, acceptance; **substitute** DESIGN tokens for every colour and font it names: page bg `--color-canvas`, ink `--color-ink`, muted `--color-ink-2`, accent `#46D2E4` (the `accent` material and rim light use signal cyan; the button dome stays a neutral `#B8B6B0` so the one accent is the LED/rim), hotspot chips Plex Mono 11px on `--color-surface` with hairline, display text Archivo `display-h1`. DESIGN §8.8 for the page shell (56px bar, 320px spec rail, stat strip, BOM, block diagram panel, SafetyFooter). Campus geometry from `@shared/topology.json` (8 site-1 nodes, `map_x/map_y` → world `x=(map_x−500)/50`, `z=(map_y−350)/50`), not HARDWARE_3D's `campus.json`. Hop events are `MeshLogEntry` from `useMeshStore` (`hop_from`, `hop_to`, `status==='dropped'`), not HARDWARE_3D's `HopEvent`.

**Build:** per HARDWARE_3D §10 order compressed to one agent: registry + scene + driver + hotspots with box placeholders first (by 12:15), then the 15 real part meshes (by 13:30), then `Hardware.tsx` layout, card, list, stat strip, BOM (rows link `?part=`), schematic section (`import schematicUrl from '@hardware/schematic.svg'`; if the file is not there yet, render the `SchematicFallback` text block), block diagram panel (spec §3.1 as mono `<pre>`), pin map collapsible (spec §3.2), mesh scene with pulses from live hops, hop log, SafetyFooter. Tiers and reduced motion per HARDWARE_3D §6. Lazy route already set in the router.

**Acceptance:** HARDWARE_3D §11 checklist, with DESIGN colours; `npm run build && npm run preview`, DevTools Offline, hard reload `/hardware` → zero failed requests; `npm ls @react-three/fiber` clean; `?part=pms5003` deep link works; chip count 13; the mesh scene shows a pulse within 2 s of a phone report; the word "Cascadia" absent; bundle for `/hardware` is a separate chunk.

**Constraints:** do not import from `components/map/*` (the 3D scene has its own outline); do not edit `store/mesh.ts` (subscribe to it). Schematic file belongs to hardware-docs; coordinate the filename `hardware/schematic.svg` and nothing else.

### 2.11 fe-novel

**Owns:** `frontend/src/features/novel/{TimeMachine,ExplainDrawer,WeaDraftModal}.tsx`, `frontend/src/features/novel/*` helpers (`timelineMath.ts`, `Track.tsx`, `Pins.tsx`, `Transport.tsx`, `NeighbourBars.tsx`, `CheckRows.tsx`, `RuleSource.tsx`, `PolygonPreview.tsx`, `CharCounter.tsx`), `frontend/src/store/timeline.ts` (`scrubTo` body and playback; the scaffold left the slice shape).

**Inputs:** NOVELTY §3.1, §3.2, §3.3 (UI and behaviour), adapted to: `getTimeline()` / `TimelineResponse`, `getExplain()` / `ExplainResponse`, `getWeaDraft()` / `WeaDraft` (+ `cap_xml`, `eligible`, `eligibility_note`) in `lib/types.ts`; jump via `simControl({action:'jump', t})`. DESIGN §6.8 for the check rows style, §6.12 for the modal (overlay surface with `--shadow-overlay`), §6.2 for verdict pills, §7 motion tokens. spec §6.2 pseudocode for the "Show rule" block.

**Build:**
- `TimeMachine`: bottom strip on `/admin` (96px; collapsible to 36px): 07:00 to 20:00 axis, site-median PM2.5 sparkline behind, decision pins (colour by priority: alarm / hazardous / warn / ink-3), incident diamonds at `sim_at`, draggable handle; while dragging `timeline.active = true` and `scrubTo(iso)` computes `frame` by nearest-reading per node (bands via `lib/bands`), the card from the latest decision at or before `t`, and alerts open at `t`; **LIVE** button (pulsing dot) → `goLive()`; play/pause at 1x/10x in sim time; keyboard ← → one sim minute; pin hover card with the `reason` verbatim and "Show math" → `ui.openExplain(node_id)` with `at = pin.sim_ts`. A `SimTag`-style ink-3 note "Replaying stored readings" while active. Loads `getTimeline(site_id, 300)` on mount and every 60 s; the live WS keeps flowing underneath.
- `ExplainDrawer`: 360px right drawer on desktop pages; header node label + verdict pill + plain-English verdict; `NeighbourBars` SVG (this node in signal, neighbours ink-2, dashed lines at median and 2× median); `CheckRows` mono with pass/fail marks, 40 ms stagger; "Show rule" collapsed block with the spec §6.2 pseudocode and the fired branch highlighted; "Outlier?" badge when `outlier`; "Rules, not ML" label in the header; polls `getExplain(nodeId, at)` every 2 s while open and `at` is null (no WS subscribe; CONTRACT has none). Close on Esc and on route change.
- `WeaDraftModal`: two columns; left editable 90 and 360 textareas with counters (signal at 80 %, alarm past the limit), read-only chips for event code / severity / urgency / certainty; right `PolygonPreview` (zone `map_poly` on the campus viewBox with affected nodes highlighted, "vertices: n / 100"); footer Copy CAP XML / Copy 90 / Copy 360 (toast "Copied"); permanent header label "Sentinel drafts. Your agency issues through IPAWS. Nothing is sent from here."; `eligibility_note` shown when not eligible.

**Acceptance:** on `/admin` during the fire, drag the handle back to 13:30 → card reads the 13:30 decision, gym dot is not red; release stays; LIVE returns to live within one frame; pins appear for every `ACTIVITY_ADVISORY`, HAZARDOUS_SMOKE and LOCAL_FIRE; click gym → drawer shows `LOCAL_FIRE`, three passing checks with real numbers, neighbour bars with gym far right; during calm the drawer reads CLEAR; on `/responder/incident/:code` during the fire, Draft WEA opens the modal with `FRW`, counters ≤ 90 / ≤ 360, polygon with 4 vertices, copy works; reduced motion disables stagger and handle layout animation.

**Constraints:** do not edit `pages/*`, `components/*`, or any store other than `timeline.ts`. If a page must pass a prop to your component, ask via INTEGRATION_NOTES; the mount points already exist.

### 2.12 hardware-docs

**Owns:** `hardware/schematic.svg`, `hardware/BOM.md`, `hardware/POWER_BUDGET.md`, `hardware/README.md`, `hardware/firmware/sentinel_node.ino`, `hardware/firmware/README.md`, `docs/schematic.png` (2× raster of the SVG, made with a headless browser or `rsvg-convert`).

**Inputs:** HARDWARE_3D §9 (blocks, nets, annotations, the pin-numbering footnote) with DESIGN colours: bg `#0A0908`, block fill `#121110`, stroke `rgba(255,255,255,0.14)` (use `#2A2825` as the opaque equivalent), text `#F2EEE8`, net labels `#A9A39A`, power nets `#46D2E4`, RF `#B98BF0`, data buses `#5AD46E`, control `#FFB224`; SVG `font-family: 'IBM Plex Mono', ui-monospace, Menlo, monospace` (no `@import`, no `<image>`). spec §3 (block diagram, pin map, firmware behaviour, gateway, edge server, power budget, range), §4.1 (BOM three columns), §12 caveats.

**Build:**
- `schematic.svg`: 1600×1000, the 18 blocks in three rows, every net labelled once per segment, annotations, legend, title block with the pin-numbering footnote. Text selectable. Opens in Chrome and Safari from `file://`.
- `BOM.md`: spec §4.1 table verbatim plus the indoor-variant note, gateway and edge rows (§4.2), and a "what is counted where" paragraph matching the 3D registry's split (`PART_REGISTRY` sums to $30.80 + $2.50 assembly).
- `POWER_BUDGET.md`: spec §3.6 table, the 18650 runtime math shown, the solar assumption, the indoor mains note.
- `firmware/sentinel_node.ino`: Arduino-ESP32 sketch, compiles in the mind of a reviewer, not run today: WiFi AP `SENTINEL-<id>` at 192.168.4.1, `DNSServer` wildcard, `WebServer` serving a 2 KB inline portal page with the report form posting to `/report`, BME280 over I²C, PMS5003 over UART2 with `SET` duty cycle, MQ-2 ADC with baseline, SX1262 via RadioLib with the flooding mesh struct `{msg_id, origin, hop_count, ttl, priority}` and a 256-entry store-and-forward ring, local rule engine (rate-of-rise and absolute thresholds from spec §6), WS2812 and buzzer, light sleep. Comments name spec sections. Header comment: "Designed, not fabricated. Pin numbers per spec §3.2 (DevKit numbering); S3 remap pending."
- `hardware/README.md`: one page linking the above, the "supplement, not replacement" sentence, and the honesty paragraph from spec §12.

**Acceptance:** `xmllint --noout hardware/schematic.svg` passes; the SVG has no external references (`grep -c 'http' hardware/schematic.svg` returns 0 except the `xmlns`); `docs/schematic.png` exists at ≥ 3200px wide; BOM totals match spec ($60 / $42 / $31); the sketch has no `Cascadia`; every pin in spec §3.2 appears in both the schematic and the sketch.

**Constraints:** touch nothing under `frontend/` or `backend/`.

### 2.13 submission-docs

**Owns:** `README.md` (root), `docs/DEVPOST.md`, `docs/AI_TOOLS_DISCLOSURE.md`, `docs/DEMO_SCRIPT.md`, `docs/JUDGE_QA.md`, `docs/screenshots/README.md`.

**Inputs:** spec §0, §1, §2, §10, §11, §12; NOVELTY §1.13, §2, §4, §5; CONTRACT §9 (run commands), §10 (checklist); DESIGN §10 (copy rules); this file §3.

**Build:**
- `README.md`: what it is (two-line version), architecture diagram (spec §2 ASCII, renamed), quickstart (`make install && make dev`, or three terminals), demo identities (§1.4), what is simulated and how it is labelled (spec §10.1 table), repo map, honesty paragraph, license line. No marketing.
- `docs/DEVPOST.md`: the Devpost fields filled: name, tagline, inspiration, what it does, how we built it (stack, agents, no runtime APIs), challenges, accomplishments, what we learned, what's next, built with, the "designed not fabricated / simulated and labelled" statement, award targets list (spec §11.2) phrased as fit, links placeholders. Under 900 words.
- `docs/AI_TOOLS_DISCLOSURE.md`: every AI tool used today, vendor, model name, paid tier, what it was used for (planning docs, code generation, design system, this plan), what was human-decided. Required by the rules.
- `docs/DEMO_SCRIPT.md`: the 90-second table script and the 3-minute stage script from spec §10.3 with exact clicks per route, exact lines (NOVELTY §5), the "turn off the WiFi" beat with the recovery plan (Time Machine scrub to the good part), which judge gets which line (spec §11.3), and a 10-line failure playbook (sim down → `make sim`; WS stuck → reload; phone cannot reach → check hotspot IP).
- `docs/JUDGE_QA.md`: 15 likely questions with two-sentence answers (Dryad, Meshtastic, WEA authority, sensor drift, FERPA/TCPA, scale limits, why no ML, why $31, why schools first).

**Acceptance:** every command in the README runs as written on a clean clone (`git clone && make install && make dev`); no "Cascadia" outside the event name; no banned words (DESIGN §10); word counts respected; all cross-links resolve.

**Constraints:** touch nothing outside the listed files. Screenshots are captured by the integrator in §3.4 and dropped into `docs/screenshots/`; this agent writes the captions file.

### 2.14 Cross-agent interface summary (read before starting)

| Producer → consumer | Interface | Owner of the definition |
|---|---|---|
| backend-alerts → backend-core | `alerts.decision.get_decision_card`, `alerts.serialize.alert_to_dict`, `alerts.bands.band_key/DEFAULT_POLICY` | scaffold stub signatures |
| backend-drills → backend-core | `drills.service.get_active_drill` | scaffold |
| backend-core → backend-alerts | `core.nodes.node_status_payload`, `core.nodes.node_to_dict` | scaffold |
| all backend → everyone | `ws.hub.broadcast`, `state.*`, `envelope.ok/ApiError` | scaffold (frozen) |
| simulator ↔ backend | CONTRACT §3.9, §7.3, §7.4, §7.5 | CONTRACT |
| fe-novel → fe-admin, fe-responder, fe-landing | `store/select.ts` hooks override when `timeline.active` | scaffold |
| fe-admin → fe-landing, fe-responder | `CampusMapProps` | scaffold (frozen) |
| fe-admin, fe-responder → fe-novel | `ui.openExplain(id)`, `ui.openWea(alertId)` | scaffold |
| hardware-docs → fe-hardware-3d | `hardware/schematic.svg` path | this file |
| fe-landing → fe-hardware-3d | `components/SafetyFooter.tsx` | scaffold stub |

---

## 3. INTEGRATE step (14:30 to 15:30, integrator + one helper)

### 3.1 Build

```bash
cd /Users/pushkalkumar/Desktop/sentinel
git status --short                 # every agent has committed; no stray files outside owned paths
grep -rn "OWNER:" frontend/src backend/app simulator | grep -v node_modules   # must be empty
grep -rni "cascadia" --include=*.{ts,tsx,py,md,svg,ino,html} . | grep -v node_modules | grep -vi "frontier cascadia"   # must be empty
cd frontend && npm run build 2>&1 | tail -5          # zero TS errors
grep -rn "indigo\|violet\|purple\|slate\|gray-\|zinc" src/ ; grep -rn "transition-all\|rounded-2xl\|rounded-xl\|shadow-lg\|shadow-xl" src/ ; grep -rniE "elevate|unlock|supercharge|seamless|empower|streamline|leverage|all-in-one|beacon|journey" src/   # all empty
cd ../backend && .venv/bin/pytest -q                 # green
```

### 3.2 Boot

```bash
make clean && make seed            # fresh sentinel.db, seeded
make dev                           # three processes; wait for "[fe] Local:" line
open http://localhost:5173/ http://localhost:5173/admin http://localhost:5173/responder http://localhost:5173/m http://localhost:5173/hardware
```

Demo-day boot order is the same, with `SENTINEL_RESET_DB=1` once before the first judge.

### 3.3 Smoke list (`scripts/smoke.sh` runs the curl half; the UI half is manual, two browsers plus one phone)

| # | Check | Pass condition |
|---|---|---|
| 1 | `GET /api/health` | `ok`, `db true`, `sim_connected true` within 5 s of `make sim` |
| 2 | Admin login, `GET /api/auth/me` | token echoes role `admin`, site 1 |
| 3 | Staff login `T-3B-7Q2` | class 3B, 30 roster |
| 4 | `jump smoke` | `/admin` card "Cancel outdoor practice", ≈ 71, Athletic Field, within 3 s |
| 5 | `trigger_fire gym` | one LOCAL_FIRE at gym within 2 s; 12 `sms_sent`; no alert elsewhere; banner solid red; gym dot double ring |
| 6 | Phone report (node `gym`, Trapped ×2) | `SN-XXXX` on the phone; dash gym→science→hub on `/admin` and `/responder`; queue row Verified 70; responder tone after toggle |
| 7 | Responder acknowledge → resolve with note | phone `/m/status` flips live; audit has 4 rows with IP |
| 8 | Blocked device toggle | 403 copy on the phone |
| 9 | Start drill → teacher phone → 28 + 2 missing | tile 3B amber 28/30; missing list 2; CSV downloads; report prints |
| 10 | `clear` | LOCAL_FIRE clears ≈ 3 s later; `alert_cleared` arrives; gym dot returns to band colour |
| 11 | Kill simulator | `GET /api/sim/state` → `{connected:false}`; dashboard "simulator offline"; nothing crashes; restart sim → reconnects without backend restart |
| 12 | Restart backend | tokens still valid; frontend WS reconnects (LIVE → RECONNECTING → LIVE) and re-hydrates |
| 13 | `GET /api/wea/draft?alert_id=<fire>` | `FRW`, disclaimer, 90/360 lengths; modal opens from incident detail |
| 14 | Time Machine | drag to 13:30 during the fire → gym not red, card shows the 13:30 decision; LIVE returns |
| 15 | Sky vs Building | click gym → LOCAL_FIRE, 3 passing checks with live numbers; click library → CLEAR |
| 16 | `/hardware` offline | `npm run preview`, DevTools Offline, hard reload → zero failed requests; explode and chips work; pulse on a hop |
| 17 | Landing | no `/api` calls; hop dash within 3 s; reduced motion static frame |
| 18 | Phone on the laptop hotspot | `http://<laptop-ip>:5173/m` loads; steps 6 and 7 repeat from the phone with the laptop's uplink WiFi off |
| 19 | Width 390 on every desktop route | no horizontal scroll on the body; console pages degrade but render |
| 20 | Two SIM tags never on one view; one primary button per view; green only on Resolve | visual sweep of all 17 routes |

A failure is fixed by the owning agent (still available until 15:30) or cut per §0.4.

### 3.4 Screenshot list (integrator captures at 1440×900 and 390×844, PNG, into `docs/screenshots/`)

| File | Route and state |
|---|---|
| `01-landing.png` | `/` at the moment the hop dash crosses the hero card |
| `02-admin-calm.png` | `/admin` at 07:30, all green, card "Outdoor practice: OK" |
| `03-admin-smoke.png` | `/admin` after `jump smoke`, card "Cancel outdoor practice", air mode |
| `04-admin-fire.png` | `/admin` after `trigger_fire gym`, mesh mode, banner red, hop dash visible |
| `05-explain-gym.png` | Sky vs Building drawer open on gym during the fire |
| `06-time-machine.png` | `/admin` with the handle dragged to 13:30, pins visible |
| `07-air.png` | `/admin/air` with the gym line spiking alone |
| `08-alerts-outbox.png` | `/admin/alerts` SMS outbox with the SIM tag |
| `09-responder-queue.png` | `/responder` with three incidents, one selected |
| `10-incident-detail.png` | `/responder/incident/:code` with trust meter 70 and timeline |
| `11-wea-draft.png` | WEA modal open |
| `12-audit.png` | `/responder/audit` |
| `13-drill-grid.png` | `/admin/drill` mid-drill, one amber tile |
| `14-phone-picker.png` (390) | `/m` |
| `15-phone-report.png` (390) | `/m/report` with Trapped selected |
| `16-phone-code.png` (390) | the code screen |
| `17-phone-status.png` (390) | `/m/status` at Resolved |
| `18-phone-rollcall.png` (390) | `/m/staff` roll call form |
| `19-hardware-assembled.png` | `/hardware` explode 0 |
| `20-hardware-exploded.png` | `/hardware` explode 1 with chips |
| `21-hardware-mesh.png` | the 3D mesh scene with a pulse |
| `22-schematic.png` | `docs/schematic.png` (from hardware-docs) |

Devpost uses 01, 04, 05, 10, 16, 20, 22 as the gallery; the rest go in the README.

### 3.5 Video and lock (15:30 to 17:00)

- 60-second backup video: screen record the §3.3 steps 4, 5, 6, 7, 14, 15 on the laptop with the phone mirrored; no voice-over needed, captions from `DEMO_SCRIPT.md`.
- Final commit, push, Devpost fields from `docs/DEVPOST.md`, upload `AI_TOOLS_DISCLOSURE.md`, gallery images, video link. Lock by 17:00.

---

## 4. Decisions recorded here so nobody re-decides them

1. **CONTRACT.md over SIM_WORLD.md** for node ids, sites, clocks and control API. SIM_WORLD contributes curve technique and map drawing conventions only.
2. **DESIGN.md over HARDWARE_3D.md** for colour and type on `/hardware`; HARDWARE_3D governs geometry and scene code.
3. **No sidebar.** `DesktopShell` is a 56px top bar with role tabs (DESIGN §8). The brief's "DesktopShell with sidebar" is overridden by the design source of truth.
4. **`lib/live.ts`, not `lib/ws.ts`**, is the WebSocket client name (CONTRACT §8.2 `connectLive`). Stores are one slice per file under `src/store/`, not a single `store.ts`, so fe-novel can own `timeline.ts` and nobody else touches store files.
5. **`docs/INTEGRATION_NOTES.md`** is the only cross-agent channel; CONTRACT's `GAPS.md` means this file.
6. **Phone routes are `/m/*`** (DESIGN), not the spec's bare `/report`.
7. **Two scaffold additions to models**: `Incident.sim_at` and `NodeEval`, so the Time Machine and Sky vs Building need no later schema change.
8. **Escalation rule** (SIM_WORLD §10) is part of the engine: LOCAL_FIRE replaces an open lower-priority alert at the same node in the same tick.
9. **Time Machine seam** is `store/select.ts`; pages never read nodes/card/alerts from `useSiteStore` directly.
10. **One shared map component** owned by fe-admin with a frozen props interface; landing and responder consume it; the scaffold stub renders enough that nobody is blocked.
11. **One venv** (`backend/.venv`) for backend and simulator; `aiohttp` installed there.
12. **`/api/health` is implemented by the scaffold** so `make smoke` works before any implement agent finishes.
13. **Warehouse floor-plan view is the first cut** if time runs short; the campus demo is the one on stage.
