# Sentinel

A roll-call and smoke-decision tool that schools and warehouses use every week, which turns into a verified emergency reporting network when the internet dies.

Built in twelve hours at Frontier Cascadia (Seattle, September 12, 2026). The hardware is designed, not fabricated. Every sensor, radio hop and text message in this repo is simulated and labelled as such on screen. The alert engine, trust score, audit log and roll call are real code.

## What it is

The Sentinel Node is a $31 box (at 1,000 units) built around an ESP32-S3. It measures particulates, temperature, humidity and combustible gas, relays readings and messages to neighbouring nodes over 915 MHz LoRa, and runs its own WiFi access point so any phone can reach it with no network at all.

On ordinary days a school uses the nodes to decide whether practice goes outside during smoke season, and to run the drill that Washington requires every month (RCW 28A.320.125). A warehouse uses them to find which aisle is burning rather than which zone. On the bad day, anyone standing next to a node can report "I'm trapped" from a phone, get a code like `SN-7K3F`, and be seen on a responder's map with a trust score that says how much the node's own sensors agree with them. Only a responder can close the incident.

The one algorithm that matters fits in a sentence: one node spiking while its neighbours are flat is a fire in that room; every node climbing together is the sky. The engine compares each node against the median of its neighbours before it decides whether to call a fire department or cancel recess.

## Architecture

Production shape, from the spec. The demo swaps the items marked in the next section.

```
                       +--------------------------------------------------+
                       |                 CLOUD / EDGE BACKEND             |
   Registered phones   |  FastAPI · Postgres · Redis · WebSockets         |
   <---- SMS alerts ---+  Alert engine · Triage engine · Tenant isolation |
                       +-------+---------------------------+--------------+
                               | HTTPS / WebSocket         | HTTPS / WebSocket
                    +----------v----------+      +---------v-----------+
                    |  DESKTOP WEB APP    |      |  PHONE WEB APP      |
                    |  Admin / School     |      |  Teacher roll call  |
                    |  Emergency Responder|      |  Responder field    |
                    |  Warehouse Ops      |      |  Civilian "in danger"|
                    +---------------------+      +---------+-----------+
                                                           | joins node WiFi
                                                           | (no internet needed)
        LTE / Ethernet         LoRa 915 MHz mesh           |
   +------------+  <-------->  +---------+  <-->  +--------v-+  <-->  +---------+
   | GATEWAY    |              |  NODE   |        |  NODE    |        |  NODE   |
   | ESP32+LTE  |              | ESP32   |        | ESP32    |        | ESP32   |
   +------------+              +---------+        +----------+        +---------+
                                 PM2.5 · temp · humidity · gas · button · LED · battery · solar
```

Three processes run in the demo:

| Process | Port | What it does |
|---|---|---|
| `backend/` FastAPI + SQLite | `:8000` | REST under `/api`, WebSocket at `/live`, alert engine, trust score, drills, audit |
| `simulator/` Python asyncio | `:8001` control, UDP `:9000-9013` | 14 virtual nodes (8 campus, 6 warehouse) playing a scripted smoke day, flooding mesh over local UDP with 15% drop |
| `frontend/` Vite + React + TypeScript | `:5173` | Desktop console, phone pages under `/m/*`, 3D hardware page |

The frontend never hardcodes a backend host. Vite proxies `/api` and `/live`, so a phone on the laptop's hotspot reaches everything through `http://<laptop-ip>:5173`.

## Quickstart

Requirements: Python 3.13 with [uv](https://docs.astral.sh/uv/), Node 20 or newer, `make`, `curl` and `jq` for the smoke test.

```bash
git clone <repo-url> sentinel && cd sentinel
uv venv backend/.venv --python 3.13
make install          # python deps into backend/.venv, npm ci in frontend/
make seed             # fresh sentinel.db with the demo tenants, nodes, users, roster
make dev              # backend, simulator and frontend in one terminal; Ctrl-C stops all three
```

Then open http://localhost:5173/ (landing), `/admin`, `/responder`, `/m` (phone) and `/hardware`.

Three terminals instead of `make dev`:

```bash
make backend          # uvicorn on 0.0.0.0:8000 with reload
make sim              # simulator, connects to the backend and starts the scripted day
make frontend         # vite on 0.0.0.0:5173
```

Other targets:

```bash
make smoke            # curl checks against a running stack; exits non-zero on the first failure
make build            # production frontend build
make clean            # delete the SQLite database
```

Before the first judge, run `make clean && make seed` once so the day starts calm.

## Demo identities

Every password is `sentinel`.

| Who | Login | Lands on |
|---|---|---|
| Admin (school) | `admin@sentinel.demo` | site 1, Roosevelt High School |
| Admin (warehouse) | `ops@sentinel.demo` | site 2, Harbor Island DC-4 |
| Responder | `responder@sentinel.demo` | all sites in jurisdiction |
| Teacher 3B | staff code `T-3B-7Q2` on `/m/staff` | class 3B, 30 students, muster at Athletic Field |
| Blocked device | header `X-Device-Fp: demo-blocked-device` | 403 `DEVICE_BLOCKED` on report |

Driving the simulator from the admin console (or `POST /api/sim/control` with an admin token):

| Action | What happens |
|---|---|
| `jump smoke` | sim clock to 13:55; decision card flips to "Cancel outdoor practice", PM2.5 about 71 at Athletic Field |
| `trigger_fire gym` | gym alone spikes with heat; one `LOCAL_FIRE` alert; 12 simulated SMS to Campus South |
| `clear` | overrides decay; the engine clears the alert itself about three sim minutes later |
| `jump calm` | back to 07:30, everything green |

## What is simulated, and how it is labelled

| Production | Demo | Label on screen |
|---|---|---|
| ESP32 nodes with sensors | `simulator/` spawns 14 virtual nodes (8 on the campus map, 6 on the warehouse floor plan) emitting readings from a scripted day: calm morning, smoke afternoon, one node "fire" on command | `SIM  8 virtual nodes · schematic in submission` on the campus views |
| LoRa mesh | Virtual nodes exchange messages over local UDP with 15% random drop; de-dup and retry are real | hop animation on the map, hop log panel, `SIM  mesh over local UDP, 15% drop · dedup and retry are real` |
| Twilio SMS | SMS outbox listing every message the engine would have sent, with zone and text | `SIM  SMS provider disabled in demo` |
| Node captive portal | Laptop hotspot plus the phone pages at `http://<laptop-ip>:5173/m` | `SIM  in production this page is served by the node itself` |
| Cloud Postgres | SQLite | none needed |

Everything else runs as it would in production: the alert engine and its thresholds, the neighbour-median fire test, the trust score, incident codes, responder-only resolution, the audit log with IP addresses, drill roll call, the WEA draft template, and the Time Machine replay of stored decisions.

## Repo map

```
spec.md                 product spec: problem, hardware, engine rules, pricing, demo plan
docs/
  CONTRACT.md           API, data model, WebSocket and simulator contract (source of truth)
  DESIGN.md             visual system, page layouts, copy rules
  SIM_WORLD.md          scripted day, fire curve, battery and noise models
  HARDWARE_3D.md        3D node model, part registry, schematic blocks
  NOVELTY.md            prior art, novelty claims, the three add-on features
  BUILD_PLAN.md         who built what, in which hour
  DEVPOST.md            submission text
  AI_TOOLS_DISCLOSURE.md
  DEMO_SCRIPT.md        table and stage scripts, failure playbook
  JUDGE_QA.md           likely questions, short answers
  screenshots/          captured console and phone views
backend/app/            FastAPI: core (auth, nodes, sites, incidents, mesh, sim), alerts (engine, decision card, SMS, WEA), drills (roll call, timeline)
simulator/              virtual nodes, scripted world, UDP mesh, control server
frontend/src/           pages/, features/, components/map/, three/ (hardware page), store/ (zustand slices)
shared/topology.json    the 14 nodes, zones and sites; read by backend and simulator
hardware/               schematic.svg, BOM.md, POWER_BUDGET.md, firmware/sentinel_node.ino
scripts/                dev.sh (three processes), smoke.sh (curl checks)
Makefile
```

## Honesty

No hardware was fabricated for this event, per organiser guidance. The schematic, BOM, pin map, power budget and firmware sketch in `hardware/` are designed and reviewed, not built or flashed. No live sensors, no live radio and no live SMS were used; each is simulated in-process and carries a SIM tag where it appears. Sending an alert to every phone in an area is a government function (WEA through IPAWS); Sentinel drafts that message for the agency and does not send it. The MQ-2 gas sensor and PMS5003 particulate sensor are cheap hobby parts; a production indoor node would use an electrochemical CO sensor and a photoelectric smoke chamber, and would sit alongside code-required detection, not replace it. The flooding mesh stops scaling around 80 nodes per channel. Student roster and SMS registry data need FERPA and TCPA handling we have not built.

## License

MIT. See [LICENSE](LICENSE).
