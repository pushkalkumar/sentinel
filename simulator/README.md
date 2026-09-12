# Sentinel simulator

One asyncio process that plays a scripted smoke day across the 14 nodes in `../shared/topology.json`
(8 campus, 6 warehouse), posts telemetry to the backend, runs a virtual LoRa mesh over local UDP,
and exposes a small control API on `127.0.0.1:8001`. The contract is `docs/CONTRACT.md` §7.

## Run

```bash
cd simulator && ../backend/.venv/bin/python main.py          # or: make sim
../backend/.venv/bin/python main.py --speed 300 --seed 7 --verbose
```

Starts **paused at 07:30**, phase `calm`. Press play from the admin UI or with the control API below.
The simulator runs standalone: if the backend is down it logs once, backs off (0.5 s doubling to 5 s)
and reconnects on its own. Start order does not matter.

Environment (`simulator/.env`, all optional, CLI flags override):

| Var | Default | Meaning |
|---|---|---|
| `SENTINEL_BACKEND` | `http://127.0.0.1:8000` | Backend base URL |
| `SENTINEL_SIM_KEY` | `sentinel-sim` | Sent as `X-Sim-Key` on every ingest POST |
| `SIM_SPEED` | `60` | Sim seconds per wall second (`1`, `10`, `60`, `300`) |
| `SIM_DROP` | `0.15` | Per-link drop probability in the mesh |
| `SIM_SEED` | `42` | Noise seed; same seed, same readings |
| `SIM_CONTROL_PORT` | `8001` | Control API port |

## Files

| File | Role |
|---|---|
| `world.py` | `R(t)` sky curve, phase schedule, operator overrides, `reading()` per node. Pure functions; noise is hashed from `(seed, node, channel, 10-s bucket)` so nothing depends on call order. |
| `clock.py` | Sim clock in seconds since 07:00, play/pause/speed, jump parsing (`calm`, `smoke`, `fire`, seconds, `HH:MM`), auto-pause at 20:00. |
| `mesh.py` | 14 virtual nodes on UDP `127.0.0.1:9000..9013`. Real flood with `msg_id` de-dup, ttl and 15 % per-link drops. Hop reports to the backend follow the BFS path to the site gateway with the §7.3 pacing (400 ms per hop, 3 s retry, 4 attempts then `failed`). |
| `control.py` | aiohttp server: `GET /state`, `POST /control`, `POST /relay`. Envelope responses, 422 on bad input. |
| `backend_client.py` | aiohttp client for `/api/ingest/telemetry`, `/api/ingest/mesh-message`, `/api/ingest/sim-state`. Never raises to callers. |
| `main.py` | Wires the above. Tick loop (one telemetry batch of 14 readings every 30 sim seconds), sim-state push every 1 s wall and after each control action. |

## Control API

```bash
curl -s 127.0.0.1:8001/state | jq .data
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"play"}'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"speed","speed":300}'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"jump","t":"fire"}'     # 14:30 + gym fire
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"jump","t":"13:55"}'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"trigger_fire","node_id":"w-a07"}'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"trigger_smoke"}'
curl -s -XPOST 127.0.0.1:8001/control -H 'content-type: application/json' -d '{"action":"clear"}'
curl -s -XPOST 127.0.0.1:8001/relay -H 'content-type: application/json' \
  -d '{"msg_id":"m-deadbeef","origin_node":"parking","kind":"incident","payload":{"code":"SN-TEST","type":"trapped","count":1}}'
# 202 {"ok":true,"data":{"msg_id":"m-deadbeef","planned_path":["parking","arts","library","hub"],"ttl":8}}
```

The backend proxies `POST /api/sim/control` to `/control` verbatim; operators normally never call `:8001` directly.

## Behaviour notes

- One telemetry tick is emitted at startup and after every `jump`, even while paused, so the dashboard
  shows the jumped-to state right away. Readings are idempotent on `(node_id, ts)` in the backend.
- `jump "calm"` resets every override. Other jumps keep fire and smoke overrides; a fire lit later than
  the jump target is re-anchored to the target so the ramp never runs from negative time.
- `trigger_fire` also originates a `kind:"alarm"` mesh message from that node to its gateway.
- `clear` decays fire and smoke to zero over 120 sim seconds, then removes them. Alerts clear in the backend on its own schedule.
- Warehouse nodes use an indoor factor of 0.5 (campus indoor 0.7, outdoor 1.0).
- The mesh RNG is seeded from `SIM_SEED`; drops and back-off are repeatable in order, not per-bucket.

## Expected numbers (seed 42)

| Sim time | Regional | Indoor campus | Outdoor | Note |
|---|---|---|---|---|
| 07:30 | 6 | 1 to 9 | about 8 | calm, dashboard green |
| 13:55 | 70 | about 49 | about 75 | decision card flips to cancel outdoor practice |
| 14:30 + fire | 108 | about 75 | about 111 | gym climbs to about 255 within 60 sim s |
| 15:00 | 140 | about 99 | about 142 | plateau |
