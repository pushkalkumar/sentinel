# Sentinel

A roll-call and smoke-decision tool that schools and warehouses use every week, which turns into a verified emergency reporting network when the internet dies.

Built in one day at Frontier Cascadia (Seattle, September 12, 2026). The production node is designed, not fabricated; two Particle Xenon dev boards on the table stand in for two LoRa nodes over BLE. Every simulated sensor, radio hop and text message is labelled as such on screen. The alert engine, trust score, audit log, roll call and the small offline model are real code.

**Live site:** https://sentinel-seattle.vercel.app · **Repo:** https://github.com/pushkalkumar/sentinel

The frontend is on Vercel. The backend and simulator run together on a Render free-tier instance at https://sentinel-api-02td.onrender.com. Render puts the instance to sleep after 15 minutes idle; the first request after that takes about 50 seconds while the container boots and reseeds. Open the site a few minutes before you need it.

## See it in four minutes

1. Open https://sentinel-seattle.vercel.app/demo and log in as `admin@sentinel.demo` / `sentinel`.
2. Press Play (or space). Seven scripted chapters run server-side: calm morning, smoke afternoon, one node spikes, a judge reports from the gym, the responder closes the loop, a fire drill roll call, all clear. The map, decision card, incident queue and roll-call grid all react over the live WebSocket, the same way they would if a person clicked through admin, a phone and the responder console. Arrow keys step chapters, R restarts, F goes fullscreen, 2x halves the wait.
3. Open `/hardware` for the exploded 3D node and, when the boards are plugged in, the live panel showing Xenon A's last reading and the last MODE press relayed through Xenon B.

## What it is

The Sentinel Node is a $31 box (at 1,000 units) built around an ESP32-S3. It measures particulates, temperature, humidity and combustible gas, relays readings and messages to neighbouring nodes over 915 MHz LoRa, and runs its own WiFi access point so any phone can reach it with no network at all.

On ordinary days a school uses the nodes to decide whether practice goes outside during smoke season, and to run the drill that Washington requires every month (RCW 28A.320.125). A warehouse uses them to find which aisle is burning rather than which zone. On the bad day, anyone standing next to a node can report "I'm trapped" from a phone, get a code like `SN-7K3F`, and be seen on a responder's map with a trust score that says how much the node's own sensors agree with them. Only a responder can close the incident.

The one algorithm that matters fits in a sentence: one node spiking while its neighbours are flat is a fire in that room; every node climbing together is the sky. The engine compares each node against the median of its neighbours before it decides whether to call a fire department or cancel recess.

## The AI layer, and who decides

Rules decide. Humans resolve. The AI annotates, and says so on every payload (`authority: "rules decide, model advises"`, `human_decides`). Details in [docs/AI_FOR_GOOD.md](docs/AI_FOR_GOOD.md).

| Piece | What it is | Where |
|---|---|---|
| Fire-vs-sky second opinion | Multinomial logistic regression over seven features from a node's last 30 minutes and its neighbours (`pm25`, `pm_rise_5m`, `temp_rise_2m`, `gas_delta`, `ratio_to_neighbour_median`, `neighbour_spread`, `rh_drop`). Numpy only, offline, under a millisecond per node. Trained on 6,426 synthetic windows generated from the simulator's own sensor curves; 98.4% held-out accuracy on that synthetic world, never validated on a real fire. Labels come from the scenario that produced the window, not from the rule engine, so it is not a copy of the rules. | `backend/app/ml/`, `GET /api/ml/model-card`, `/api/ml/assess`, `/api/ml/assess-all` |
| Drift detector | EWMA of node-minus-neighbour-median PM2.5 over 30 minutes, scored as a MAD-scaled z-score. A node sitting 30 µg/m³ above its neighbours for half an hour is a dirty inlet, not a fire. It flags; it does not correct. | same module |
| Report triage | Gemini (`gemini-flash-lite-latest`, REST, JSON mode with a response schema) reads a free-text civilian report in any language and returns type, count, urgency and an English summary with the reporter's words quoted. 8 s timeout, no retries, cached by input hash, 20 calls a minute. | `POST /api/ai/triage`, `/api/ai/translate` |
| Situation brief | The same model rewrites a template paragraph built from live database rows into one plain paragraph a responder reads in ten seconds. It may not add numbers, places or causes that are not in the facts list. | `GET /api/ai/brief?site_id=` |

Without `GEMINI_API_KEY`, or on any error or timeout, the triage and brief endpoints return the deterministic keyword result with `basis: "fallback: keyword rules"` and a `fallback_reason`. The product does the same thing with or without the key; the model only changes the wording.

## Real hardware on the table

Two Particle Xenons (nRF52840, BLE only) run the 24-byte `SentinelMsg` struct from the spec over BLE advertising instead of LoRa. Xenon A advertises a reading every 5 seconds and sends a priority-2 button message on MODE. Xenon B scans, de-duplicates by `msg_id`, rebroadcasts with `hop_count+1`, and prints one JSON line per message over USB. `make bridge` reads that serial stream and posts it to the backend, so a MODE press shows up on the live map as `xenon-a -> xenon-b -> hub` with the same hop animation the simulator uses, and a toast on `/hardware`.

What is swapped: BLE (~10 m) for LoRa (km), a fixed 23.0 °C in place of a temperature sensor, zeros for PM and gas because the board has no such sensors, and a USB cable for the last hop. Flashing, ports, clocks and troubleshooting are in [hardware/xenon/README.md](hardware/xenon/README.md).

## Real campus

The map is Roosevelt High School (1410 NE 66th St, Seattle) and 400 m around it, exported once from OpenStreetMap via Overpass on 2026-09-12 and bundled as `shared/campus.geojson`. No runtime map API. Building footprints are extruded in the 3D scene and drawn flat in the SVG map; the eight campus nodes sit on real rooftops and the field. Map data © OpenStreetMap contributors, ODbL. See [docs/MAP_DATA.md](docs/MAP_DATA.md).

## Architecture

Production shape, from the spec. The demo swaps the items in the simulation table below.

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

Processes in the demo:

| Process | Port | What it does |
|---|---|---|
| `backend/` FastAPI + SQLite | `:8000` | REST under `/api`, WebSocket at `/live`, alert engine, trust score, drills, audit, demo director, ML and AI endpoints |
| `simulator/` Python asyncio | `:8001` control, UDP `:9000-9013` | 14 virtual nodes (8 campus, 6 warehouse) playing a scripted smoke day, flooding mesh over local UDP with 15% drop; skips the two hardware nodes |
| `frontend/` Vite + React + TypeScript | `:5173` | Desktop console, `/demo` war room, phone pages under `/m/*`, 3D hardware page |
| `app.hardware_bridge` (optional) | USB serial | Reads Xenon B's JSON and posts readings and mesh hops to the backend |

On Render the backend and simulator share one container (`deploy/start.sh`). The frontend never hardcodes a backend host: Vite proxies `/api` and `/live` locally, and the Vercel build points at the Render URL.

## Quickstart

Requirements: Python 3.13 with [uv](https://docs.astral.sh/uv/), Node 20 or newer, `make`, `curl` and `jq` for the smoke test.

```bash
git clone https://github.com/pushkalkumar/sentinel.git && cd sentinel
uv venv backend/.venv --python 3.13
make install          # python deps into backend/.venv, npm ci in frontend/
make seed             # fresh sentinel.db with the demo tenants, nodes, users, roster
make dev              # backend, simulator and frontend in one terminal; Ctrl-C stops all three
```

Then open http://localhost:5173/ (landing), `/demo`, `/admin`, `/responder`, `/m` (phone) and `/hardware`.

Optional: `export GEMINI_API_KEY=...` before `make backend` turns on live triage and briefs. Without it the same endpoints answer from keyword rules and say so.

Three terminals instead of `make dev`, plus the hardware bridge:

```bash
make backend          # uvicorn on 0.0.0.0:8000 with reload
make sim              # simulator, connects to the backend and starts the scripted day
make frontend         # vite on 0.0.0.0:5173
make bridge           # Xenon serial bridge, auto-detects the gateway port (or PORT=/dev/tty.usbmodemXXXX)
```

Other targets:

```bash
make smoke            # curl checks against a running stack; exits non-zero on the first failure
make build            # production frontend build
make clean            # delete the SQLite database
```

Before the first judge, run `make clean && make seed` once so the day starts calm. Retrain the model with `cd backend && .venv/bin/python -m app.ml.train`.

## Demo identities

Every password is `sentinel`.

| Who | Login | Lands on |
|---|---|---|
| Admin (school) | `admin@sentinel.demo` | site 1, Roosevelt High School; can drive `/demo` |
| Admin (warehouse) | `ops@sentinel.demo` | site 2, Harbor Island DC-4 |
| Responder | `responder@sentinel.demo` | all sites in jurisdiction; can drive `/demo` |
| Teacher 3B | staff code `T-3B-7Q2` on `/m/staff` | class 3B, 30 students, muster at Athletic Field |
| Blocked device | header `X-Device-Fp: demo-blocked-device` | 403 `DEVICE_BLOCKED` on report |

Driving the simulator from the admin console (or `POST /api/sim/control` with an admin token):

| Action | What happens |
|---|---|
| `jump smoke` | sim clock to 13:55; decision card flips to "Cancel outdoor practice", PM2.5 about 71 at Athletic Field |
| `trigger_fire gym` | gym alone spikes with heat; one `LOCAL_FIRE` alert; 12 simulated SMS to Campus South |
| `clear` | overrides decay; the engine clears the alert itself about three sim minutes later |
| `jump calm` | back to 07:30, everything green |
| `reset` | back to calm and removes the rows the demo director created |

The `/demo` director calls `POST /api/demo/chapter` with a chapter id and `POST /api/demo/reset`; chapters are idempotent, so re-running one reuses the open drill or incident instead of stacking duplicates.

## What is simulated, and how it is labelled

| Production | Demo | Label on screen |
|---|---|---|
| ESP32 nodes with sensors | `simulator/` spawns 14 virtual nodes (8 on the campus map, 6 on the warehouse floor plan) emitting readings from a scripted day | `SIM  virtual nodes · schematic in submission` |
| LoRa mesh | Virtual nodes exchange messages over local UDP with 15% random drop; de-dup and retry are real. Two Xenons carry the same message struct over BLE advertising. | hop animation, hop log panel, `SIM  mesh over local UDP, 15% drop`; Xenon rows labelled `real hardware` |
| Twilio SMS | SMS outbox listing every message the engine would have sent | `SIM  SMS provider disabled in demo` |
| Node captive portal | Laptop hotspot plus the phone pages at `http://<laptop-ip>:5173/m` | `SIM  in production this page is served by the node itself` |
| Cloud Postgres | SQLite | none needed |
| Map tiles | Bundled OpenStreetMap footprints, no tile server | `Map data © OpenStreetMap contributors` |

Everything else runs as it would in production: the alert engine and its thresholds, the neighbour-median fire test, the trust score, incident codes, responder-only resolution, the audit log with IP addresses, drill roll call, the WEA draft template, the Time Machine replay, the offline model, and the Gemini triage path with its fallback.

## Repo map

```
spec.md                 product spec: problem, hardware, engine rules, pricing, demo plan
docs/
  CONTRACT.md           API, data model, WebSocket and simulator contract (source of truth)
  DESIGN.md, DESIGN_V2  visual system, page layouts, copy rules
  SIM_WORLD.md          scripted day, fire curve, battery and noise models
  HARDWARE_3D.md        3D node model, part registry, schematic blocks
  MAP_DATA.md           OpenStreetMap export, coordinate mapping, node placement
  AI_FOR_GOOD.md        what the model is, what it is not, why rules keep authority
  NOVELTY.md            prior art, novelty claims, the three add-on features
  BUILD_PLAN.md         who built what, in which hour
  DEVPOST.md            submission text
  AI_TOOLS_DISCLOSURE.md
  DEMO_SCRIPT.md        four-minute stage flow, failure playbook
  JUDGE_QA.md           likely questions, short answers
  review/               adversarial review punch lists and before/after screenshots
backend/app/            FastAPI: core (auth, nodes, sites, incidents, mesh, sim), alerts (engine, decision card,
                        SMS, WEA), drills (roll call, timeline), demo.py (chapter runner), ml/ (second opinion,
                        drift, trainer, weights.json), ai/ (Gemini client, keyword fallback, brief), hardware_bridge.py
simulator/              virtual nodes, scripted world, UDP mesh, control server
frontend/src/           pages/ (Demo, Hardware, admin, responder, m), features/ (demo, ai, hardware, ...),
                        components/map/, three/ (campus scene, exploded node), store/ (zustand slices)
shared/topology.json    the 16 nodes (14 virtual, 2 hardware), zones and sites; read by backend and simulator
shared/campus.geojson   Roosevelt High School footprints from OpenStreetMap
hardware/               schematic.svg, BOM.md, POWER_BUDGET.md, firmware/sentinel_node.ino, xenon/ (BLE firmware,
                        prebuilt bins, bridge notes)
deploy/                 Dockerfile and start.sh for Render; render.yaml and vercel.json at the root
scripts/                dev.sh (three processes), smoke.sh (curl checks)
Makefile
```

## Honesty

The production node was not fabricated, per organiser guidance. The schematic, BOM, pin map, power budget and ESP32 firmware sketch in `hardware/` are designed and reviewed, not built. The two Xenons on the table are off-the-shelf dev boards running our firmware over BLE; they carry the real message format and real de-dup, with placeholder sensor values and a USB cable for the final hop. No live LoRa and no live SMS were used; each is simulated in-process and carries a SIM tag where it appears.

The offline model is trained only on synthetic windows from our own simulator. Its 98.4% is accuracy on that synthetic world and says nothing about real fires. It never opens or closes an alert. Gemini reads free-text reports and writes briefs; it never dispatches, never decides, and every output carries its basis. Sending an alert to every phone in an area is a government function (WEA through IPAWS); Sentinel drafts that message for the agency and does not send it. The MQ-2 and PMS5003 are cheap hobby parts; a production indoor node would use an electrochemical CO sensor and a photoelectric smoke chamber, and would sit alongside code-required detection, not replace it. The flooding mesh stops scaling around 80 nodes per channel. Student roster and SMS registry data need FERPA and TCPA handling we have not built.

## License

MIT. See [LICENSE](LICENSE). Map data © OpenStreetMap contributors, available under the Open Database License.
