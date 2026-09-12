# Demo script

Two versions: 90 seconds at the table, 3 minutes on stage. Both use the same stack, the same identities and the same order of beats, so the stage version is the table version with two beats added and more said out loud.

## Before any judge arrives

1. `make clean && make seed`, then `make dev`. Wait for the `[fe] Local:` line.
2. Laptop hotspot on. Note the laptop's IP on that hotspot (`ipconfig getifaddr en0` or the WiFi menu). Write it on a card: `http://<laptop-ip>:5173/m`.
3. Browser window A, left half: `/login` as `admin@sentinel.demo` / `sentinel`, land on `/admin`. Sim controls visible, Time Machine strip at the bottom, sim at 07:30, all dots green, card "Outdoor practice: OK".
4. Browser window B, right half: `/login` as `responder@sentinel.demo` / `sentinel`, land on `/responder`. Turn the sound toggle on.
5. Second phone (ours) joined to the hotspot with `/m/staff` open and `T-3B-7Q2` entered, waiting for a drill.
6. Confirm `make smoke` passes. Confirm the phone loads `/m` over the hotspot.
7. Between judges: sim control `jump calm`, resolve any open incidents in B, end any drill.

## 90 seconds at the table

Say the first line while the judge is still sitting down.

| t | Route and click | Say |
|---|---|---|
| 0:00 | A: `/admin`, calm. Point at the card. | "Every emergency app assumes the internet exists. Sentinel doesn't. This is a school on a normal morning: eight nodes, all green, practice is on." |
| 0:10 | A: sim controls, `jump smoke`. Dots go orange then red together; card flips to "Cancel outdoor practice", PM2.5 about 71 at Athletic Field. | "Smoke afternoon. Every node climbs together. That's the sky, not the building, so the card cancels practice and nothing else happens." |
| 0:25 | A: click the gym dot to select it, then `trigger fire` at selected node. Gym alone turns alarm red with a double ring; banner solid red; hop dash gym to science to hub. | "One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky. That's the whole algorithm, and it fits on a slide." |
| 0:35 | A: click the gym dot again. Sky vs Building drawer opens: `LOCAL_FIRE`, three passing checks with live numbers, gym bar far right of the median line. | "Rules, not a model. Here is the exact test and the numbers it saw." Close the drawer. |
| 0:45 | Hand the judge the card with the URL. Judge's phone: `/m`, tap `I need help`, pick `Gymnasium`, tap `Trapped`, count 2, `Send report`. Code appears, e.g. `SN-7K3F`. | "You can't fake standing next to the box. Only a phone on the node's own WiFi can open a verified report, and only a responder can close it." |
| 1:00 | B: `/responder` pings; queue row shows the code, Trapped, `Verified 70`. Click it. `/responder/incident/SN-XXXX`: trust meter 70, timeline. Click `Acknowledge`, then type a note and `Resolve`. | "Proximity plus the sensor agreeing with them. Acknowledged, resolved with a note, and every action is in the audit log with an IP." |
| 1:15 | Judge's phone: `/m/status` flips to Resolved on its own. | "Their receipt updates live. Now turn off the WiFi. Do it again." Do the offline beat only if there is a second judge with a phone; otherwise say it and point to `/hardware` for the follow-up. |
| 1:25 | A: hover the Time Machine track, drag the handle back to 13:30, then press LIVE. | "Every decision is stored with the numbers that caused it, so a principal can replay the afternoon." |

Optional closer if the judge is a buyer: A: `/admin/drill`, `Start fire drill`; our phone switches to roll call; submit 28 present with two missing; tile 3B goes amber `28 / 30`. "A sentinel that only wakes up for the disaster is asleep when it matters. Ours takes attendance every month, so it's awake."

## 3 minutes on stage

Same beats, with the offline beat and the drill beat always included and the pitch said in full at the top.

| t | Route and click | Say |
|---|---|---|
| 0:00 | A: `/`, landing, hop dash crossing the hero card. | The 30-second pitch from `docs/NOVELTY.md` §4, cut to the audience: drop the warehouse sentence for a school crowd, drop the drill sentence for investors. |
| 0:30 | A: `/admin`, calm. `jump smoke`. | "Every node climbing together is the sky. The card cancels practice. Registered parents in the zone get a text; here is the outbox." Click through to `/admin/alerts`, point at the SMS outbox and its SIM tag, come back to `/admin`. |
| 0:55 | A: select the gym dot, `trigger fire`. | "One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky. That's the whole algorithm, and it fits on a slide." |
| 1:05 | A: click gym, Sky vs Building drawer. | "Dryad puts the intelligence in each sensor. We put it between the sensors, because in a schoolyard the sky itself is the false alarm. Three checks, live numbers, no model." |
| 1:20 | Judge one's phone on the hotspot: `/m`, `I need help`, `Gymnasium`, `Trapped`, 2, `Send report`. Code on screen. B pings, queue shows `Verified 70`. | "You can't fake standing next to the box. Only a phone on the node's own WiFi can open a verified report, and only a responder can close it." |
| 1:40 | Turn off the laptop's uplink WiFi (keep the hotspot). Judge two's phone: same report from `Gymnasium`. Code appears; B shows a second row, `Verified 90` (crowd corroboration). | "Turn off the WiFi. Do it again." Say nothing else until the second code is on the screen. Then: "Nothing here needed the internet." |
| 2:05 | B: open the first incident, `Acknowledge`, note, `Resolve`. Judge one's phone flips to Resolved. Click `Draft WEA` on the incident. Modal: `FRW`, 90 and 360 counters, polygon with 4 vertices. | "Sentinel drafts the alert. Your agency sends it. We're not pretending to be FEMA; we're making sure the fire department's message is already written when they log in." Close the modal. |
| 2:30 | A: `/admin/drill`, `Start fire drill`. Our phone switches to roll call; submit 28 present, `S-3B-07` and `S-3B-19` missing. Tile 3B amber `28 / 30`, missing list shows both with Athletic Field. | "A sentinel that only wakes up for the disaster is asleep when it matters. Ours takes attendance every month, so it's awake." |
| 2:50 | A: `/hardware`, drag explode to 1. | "Thirty-one dollars a node at a thousand units. Designed, not fabricated; schematic, BOM and firmware are in the repo. Thank you." |

## The offline beat, and what to do if it fails

The hotspot and the uplink are different radios on the laptop. Turn off only the uplink (the WiFi network the laptop joined), never the hotspot. The phone's request goes hotspot to Vite to backend on the same machine; nothing leaves the laptop.

If the second phone cannot reach the page after the uplink is off:

1. Do not debug on stage. Say "the demo network is the laptop; let me show you the same thing from the first phone" and repeat the report from judge one's phone.
2. If the backend or simulator has also gone quiet, drag the Time Machine handle back to the moment the fire fired. The map, dots and card read stored state, so the picture holds while you talk.
3. Turn the uplink back on after the demo, not during it.

## Which judge gets which line

| Judge | Lead with | Line |
|---|---|---|
| Aayush Shah (Amazon AGI), Rishi Cheruku (Amazon) | The neighbour-median fire test and the flooding mesh. Open Sky vs Building early. | "That's the whole algorithm, and it fits on a slide." Then: "rules first, no LLM in the loop, here is why." |
| Surbhi Jha (NVIDIA) | Edge server runs the same container as cloud; ingest is idempotent on `(node_id, ts)`; OTA over LoRa in chunks. | "Node alone, node plus a Pi, or cloud. Three tiers, same code." |
| Jonathan Briggs (Eastside Prep CTIO) | He is the buyer. BOM and price per building, the drill grid replacing clipboards. Run the drill beat. | "A sentinel that only wakes up for the disaster is asleep when it matters. Ours takes attendance every month, so it's awake." |
| Dr. Mo Zhou (Eastside Prep, data science) | The decision card, `/admin/air` with the smoke-day curves, and the Time Machine. The simulated day is the shape of a real dataset. | "Every decision is stored with the numbers that caused it." |
| Floor judges from Seattle tech and VC | Warehouse loss prevention is the revenue story; schools are distribution. Trust score and responder-only close for the abuse question. | "You can't fake standing next to the box." |
| Anyone who raises Dryad or Meshtastic | Name them first. | "They put the intelligence in each sensor. We put it between the sensors, because in a schoolyard the sky itself is the false alarm." |
| Anyone with public-sector experience | The WEA draft modal. | "Sentinel drafts the alert. Your agency sends it." |

## Failure playbook

1. Simulator down (dashboard says "simulator offline", `GET /api/sim/state` returns `connected: false`): in a spare terminal, `make sim`. It reconnects without a backend restart.
2. WebSocket stuck (LIVE pill stays on RECONNECTING, dots frozen): reload the tab. The page re-hydrates from one `overview` call.
3. Backend down: `make backend` in a spare terminal. Tokens are signed, so nobody logs in again; tabs reconnect on their own.
4. Phone cannot load the page: check the phone is on the hotspot, not the venue WiFi, and that the URL uses the hotspot IP, not `localhost`. Re-read the IP from the WiFi menu; it changes when the hotspot restarts.
5. Phone loads but the report returns an error: if the copy says blocked, the dev toggle is on; long-press the wordmark on `/m` to turn it off. If it says three open reports, resolve them in B.
6. Fire does not fire after `trigger fire`: make sure a node was selected first; if not, select the gym dot and trigger again. If the sim clock is before 13:00 the gym still fires; the check is relative to neighbours.
7. Card did not flip after `jump smoke`: wait three seconds; the 10-minute rolling average lags. If still calm, `jump smoke` again.
8. Responder queue empty after a phone report: the report may have been queued by the flood guard (more than 20 per node in 10 minutes). Use `clear`, `jump calm`, and report again from a different node.
9. Anything visual wrong during the fire: drag the Time Machine handle back a few minutes to a stored state and keep talking; press LIVE when the live view looks right again.
10. Total loss: play the 60-second backup video from the desktop and narrate it with this script.
