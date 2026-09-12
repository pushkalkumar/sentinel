# Explainability and honesty audit

Lens: the rubric rewards "AI for Good" and "Substance", the product is rules-based, so every claim has to be visible and checkable on screen. Reviewed against spec.md §0, §1, §6.2, §7.2, §11 and docs/DESIGN_V2.md.

Method: own headless Chromium (playwright-core) at 1440x900 and 390x844, every route screenshotted, plus a controlled run of the flagship scenario over the sim API (rewind to 14:25, then `jump: fire`) with the engine's alert rows, `/api/nodes/gym/explain` and `/api/incidents/<code>` captured alongside the screenshots. Other agents were moving the sim and restarting the backend during the audit; every item below was either reproduced twice or is a copy/code fact that does not depend on sim state. Screenshots: `scratchpad/explain/shots2`, `shots3`, `shots4`.

Severity: P0 blocks the pitch, P1 hurts judging, P2 polish.

---

## P0

### 1. The flagship rule misfires: "Gym fire" produces "Local smoke suspected … no heat" while the gym reads +6 °C
**Route:** `/admin` banner, Explain drawer, `/responder` banner, `/admin/alerts` open alerts, WEA button, SMS outbox.
**What is wrong:** Reproduced twice with the sim controls a presenter will use (jump to 14:25, then `jump: fire`). The engine opened `LOCAL_SMOKE_SUSPECT` with metrics `pm25 258.8, pm_rise 183.6, temp_rise 0, gas_delta -3, regional 79.2` and the banner read "Local smoke suspected at Gymnasium: PM2.5 rose 184 at this node while neighbours sit at 79; no heat — ask staff to check". At that moment `/api/sim/state` had the gym at `temp_c 26.9` (neighbours 20.8) and `mq2_raw 553` (neighbours ~195). `LOCAL_FIRE` never opened, so the SMS outbox stayed at "0 messages", `Draft WEA` stayed disabled, and the Explain drawer headline said "This node is climbing alone with no heat. Ask staff to look." (shots4/admin-fire-explain.png). The one run where `LOCAL_FIRE` did open, it opened via gas 4.5 sim-minutes after the trigger with `temp_rise -0.3`.
**Root cause (verified in code):** `simulator/world.py` keeps the fire override across jumps and `trigger_fire` resets `t0`, so a second fire press re-ramps from zero: the 14:30:00 reading dips to baseline for one tick and every later reading sees a plateau (`temp_rise` over 2 min = 0, `gas_delta` against a baseline pool already full of fire values ≈ 0). `FIRE_RAMP_S = 60` with `TICK_S = 30` also lands the half-ramp tick at exactly `temp_rise = 3.0`, which fails the strict `> 3` check. The engine's `_suspect_reason` then prints "no heat" from a rate, not from the temperature.
**Why a judge cares:** This is the demo's step 3 and line 2 ("one node spiking while its neighbours are flat is a fire"). The Amazon judges are told "rules first, here is why". The screen will say the opposite of what the presenter says.
**Fix:**
- `simulator/main.py`: on any `jump`, call `overrides.reset()` before applying the phase; make `trigger_fire` a no-op if the node is already burning (do not reset `t0`).
- `simulator/world.py`: `FIRE_RAMP_S = 90` (or `FIRE_TEMP = 7`) so the first evaluated tick exceeds 3 °C, and step the ramp so no reading returns to baseline.
- `backend/app/alerts/engine.py`: add a spatial heat check to the fire branch, `temp_delta_vs_neighbours = r.temp - median(neighbours.temp) > 3`, OR'd with `temp_rise`; add the same for gas against the neighbour median instead of a self-baseline that a long fire pollutes. Change `_suspect_reason` to print the absolute numbers ("temp 26.9 vs neighbours 20.8") instead of "no heat".

### 2. Two nodes labelled "real hardware" contradict "designed, not fabricated" on every page
**Route:** `/admin/nodes` ("9 of 10 nodes online", rows `xenon-a  Xenon A · real hardware  … xenon-ble-0.1 … sim 07:44:03`, `xenon-b  Xenon B · real gateway … never`), phone node picker at `/m` (lists "Xenon A · real hardware"), Explain drawer neighbour bars (`xenon-a  0`).
**What is wrong:** The footer on the same page says "Simulated: 8 virtual nodes, schematic in submission" and the landing says "Hardware designed, not fabricated, per organizer guidance." A row that says "real hardware" with firmware `xenon-ble-0.1` is either a fabricated claim or the honesty line is now false. It also breaks the maths: `xenon-a` posts `pm25 0.0`, so it enters the gym's neighbour median in the Explain drawer ("Sky vs building … xenon-a | 0"), pulling the median down and inflating the ratio the fire rule depends on.
**Why a judge cares:** Devpost rules require the "not fabricated" statement; a judge who spots "real hardware" will ask which one is real and the team will have to walk back one of the two claims in front of them.
**Fix:** Remove `xenon-a`/`xenon-b` from `backend/app/seed.py` (or whatever seeded them), or relabel to "Bench node (BLE bridge test), not fabricated" and set `is_test: true`. In `engine.derive`, exclude neighbours with no reading in the window or with `pm25 == 0 and mq2_raw == 0`. Update the honesty line to whatever is true on the day and keep it identical across `/`, `/hardware`, `/admin/*`.

### 3. The Explain drawer flags the burning gym as "Outlier? Sensor drift suspected"
**Route:** `/admin` Explain drawer (shots4/admin-fire-explain.png, shots2/fire-explain-gym-live-2.png).
**What is wrong:** During the fire the verdict block shows the pills "Smoke suspected" and "Outlier?" plus the line "Sensor drift suspected; cross-check before trusting." On a calm morning the same pill appears on the gym reading 2 µg/m³ against a median of 6. `is_outlier` in `backend/app/alerts/explain.py` uses `> 3 × MAD` with no absolute floor and only looks at `temp_rise`/`gas_delta` rates, which are ~0 on a plateau.
**Why a judge cares:** The one panel built to prove the rule tells the judge the fire might be a dirty sensor. It is the most damaging sentence in the product.
**Fix:** Require `abs(pm25 - med) > max(3 × MAD, 20 µg/m³)`, and treat `temp_c - median(neighbour temps) > 2` or `mq2_raw - median(neighbour mq2) > 100` as "not drift". Never show the pill while a `LOCAL_FIRE` or `LOCAL_SMOKE_SUSPECT` alert is open at the node; show it only for `CLEAR`.

---

## P1

### 4. Verdict text says "heat is rising" when the fire fired on gas
**Route:** Explain drawer, `/admin` banner.
**What is wrong:** `verdict_for("LOCAL_FIRE")` always returns "This node is 3.1x its neighbours and heat is rising." In the controlled run the alert reason was "PM2.5 rose 183 in 5 min with gas +350" and the check row read `temp_rise  -0.3 > 3` with a dash (fail) directly under a headline claiming heat.
**Why a judge cares:** The checks and the sentence contradict each other in the same 384 px.
**Fix:** Build the verdict from the passing checks: "… and gas is up 350 over baseline" / "… and it is 6.1 °C hotter than its neighbours". Never mention a driver whose row failed.

### 5. Sim controls leak state between phases, so rehearsal breaks the real run
**Route:** `/admin` Transport ("Calm morning", "Gym fire", "Clear"), `/api/sim/control`.
**What is wrong:** After one fire press, jumping to "Calm morning" kept `fire_nodes: ['gym']`, so a `LOCAL_FIRE` opened at 07:35:30 in the calm morning ("PM2.5 rose 183 in 5 min with +6.1 °C; neighbours median 6") and red pins sat on the Time Machine track at 07:35. "Clear" takes 120 sim-seconds to decay and is cancelled by any jump. A forward jump over already-played time makes every reading a duplicate (`ingest_telemetry` `on_conflict_do_nothing`), so the engine silently stops evaluating while the map keeps moving. One rewind returned `{"code":"INTERNAL","message":"OperationalError"}` and the fire then ran against stale history.
**Why a judge cares:** The team will rehearse at the table, then run it for the judges. The second run is the one that goes wrong.
**Fix:** `jump` resets overrides and always rewinds history to the target (delete readings, evals, alerts, SMS with `ts >= target` regardless of direction); make `clear` immediate; add a "Reset demo" control that does jump-to-calm plus clears incidents and drills. Surface `OperationalError` as a toast instead of swallowing it.

### 6. A real fire does not switch the teacher's phone to roll call
**Route:** `/m/staff` after staff code `T-3B-7Q2` (shots2/m-staff-rollcall.png).
**What is wrong:** With the red banner "Fire reported at Gymnasium. Leave the building." at the top, the page says "No drill running. This page switches to roll call when the office starts one." Spec §6.4: "Admin starts a drill (or the engine starts a real evacuation event). Every teacher's phone page switches to roll-call mode." Line 1 of §11.4 ("earns its wall every month") depends on the bad-day page being the drill page.
**Fix:** When a `LOCAL_FIRE` alert opens at a site with no active drill, open a drill of kind `evacuation` automatically (`backend/app/drills`), labelled "Evacuation, started by the alert engine 14:34". Teacher page shows the roll-call form with the muster point.

### 7. The responder sees the report before the mesh relays it; the hop animation is after the fact
**Route:** `/responder` queue, `/responder/incident/:code` timeline, `/m/report` code screen, `/responder/audit`.
**What is wrong:** `backend/app/core/incidents.py` broadcasts `incident_created` and only then `asyncio.create_task(relay_to_sim(...))`. The timeline shows "13:45:28 Received … 13:45:29 Relayed · Delivered to hub via 2 hops", the phone says "Responders have it" instantly, and the audit log contains "Resolved 12:58:21" before "Relayed 12:58:23" for SN-NNZ8. Spec step 4 says "Message hops across the map to the hub … Responder view pings".
**Why a judge cares:** Anyone watching both screens sees the queue update before the dots move. Under an honesty lens the hop is decoration unless the queue waits for it.
**Fix:** Either hold `incident_created` until the relay reports `delivered` (or `failed`, then show "stored at edge server, relay failed"), or label the timeline row "Relayed (simulated mesh, replayed after receipt)" and the code screen "Received at the edge server". Pick one; the first is the better demo.

### 8. Four clocks on one screen, formatted identically
**Route:** `/admin`, `/responder`, `/responder/incident/:code`.
**What is wrong:** Header shows wall time `13:45 PDT`; the alert banner shows sim time `14:35:00`; the Time Machine shows `07:33`; the incident timeline shows wall time `13:45:28`; the decision log shows sim `17:44`. All are `HH:mm(:ss)` mono with no marker. On the responder detail the banner (14:35:00) and the timeline (13:45:28) sit 40 px apart.
**Why a judge cares:** Dr. Zhou's angle is the data; a timeline that runs backwards between two panels reads as a bug.
**Fix:** During the demo, drive the header clock from `sim_state.sim_clock` and label it "sim"; stamp incidents and audit rows with `sim_at` (already stored) instead of `created_at`; show wall time only in a tooltip.

### 9. Threshold copy contradicts the spec and the engine
**Route:** `/admin/alerts` Thresholds panel.
**What is wrong:** Field label "PM2.5 RISE IN 2 MIN". Spec §6.2 and `engine.PM_LOOKBACK_S = 300` use 5 minutes; the alert reason itself says "rose 183 in 5 min". "LOCAL VS REGIONAL RATIO … Local smoke suspect when a node exceeds the regional median by this factor" omits that the same factor gates `LOCAL_FIRE`.
**Fix:** "PM2.5 rise in 5 min"; ratio help text "Used by both the fire and the smoke-suspect branches."

### 10. The "no heat" verdict never shows the temperature or gas numbers
**Route:** Explain drawer, `LOCAL_SMOKE_SUSPECT` branch.
**What is wrong:** `build_checks` for the suspect branch renders three rows: `pm_rise`, `ratio`, `temp_rise <= 3`. `gas_delta` is missing and there is no absolute temperature. The drawer asserts "no heat" while the node sits at 26.9 °C against neighbours at 20.8 and the judge has no way to see either number.
**Fix:** Always render the four fire rows plus two spatial rows ("temp vs neighbours 26.9 vs 20.8", "gas vs neighbours 553 vs 195"), passing or failing. The verdict must be reconstructible from the rows alone.

### 11. WEA draft invents an eligibility policy and pre-fills a real agency as sender
**Route:** `/responder/incident/:code` → Draft WEA (`backend/app/alerts/wea.py`).
**What is wrong:** Eligibility note for a single-node fire: "Eligible: priority 1 fire at a sensor node. Agencies normally wait for two nodes; a confirmed structure fire is the exception." No source; spec §6.3 says the console offers WEA "when the engine reaches priority 1 or 2 across multiple nodes". Sender defaults to `Seattle Fire Dept / King County OEM` and is written into copyable CAP XML `<senderName>`. The disclaimer "Sentinel drafts. Only an authorised agency can issue a WEA through FEMA IPAWS. Nothing is sent from this screen." is good and should stay.
**Fix:** Eligibility text: "Priority 1 at 1 node. Spec requires priority 1 or 2 across two or more nodes; a single node is a draft only." Sender: "<your agency>" placeholder, filled from the agency tenant name only.

### 12. `/hardware` headline "Thirteen parts. Thirty-one dollars." does not add up on screen
**Route:** `/hardware` rail and 3D labels.
**What is wrong:** The 13 rail rows sum to $27.20. The $31 total (spec §4.1) needs "PCB, passives, connectors, MOSFETs $1.10" and "Assembly / test $2.50", neither of which is a rail row (the PCB appears only as a 3D label). Jonathan Briggs is the buyer and will add the column.
**Fix:** Add two rail rows ("Main PCB and passives $1.10", "Assembly and test $2.50") or change the headline to "Thirteen parts, $28. Assembled, $31."

### 13. Landing hero "A $31 box" is the 1,000-unit price with no qualifier
**Route:** `/` hero paragraph.
**What is wrong:** "A $31 box that measures smoke, heat and gas …". The unit built today would cost ~$60 (spec §4.1, and the `/hardware` spec block says "At 1: $60"). Only the stat strip further down says "per node at 1,000 units". Spec's own pitch says "$30 box".
**Fix:** "A $31 box at volume ($60 for one) that …" or move "at 1,000 units" into the hero sentence.

### 14. The landing never says the detection is rules, not a model, and never says what is real today above the footer
**Route:** `/`.
**What is wrong:** The "Sky vs building" section explains the comparison but nowhere on the page is "no machine learning, four threshold comparisons, every alert shows its numbers". The only statement of what is real is the 12 px `ink-4` footer. "Best AI for Good" judges will assume a model; "Substance" judges will assume the mesh is real until they read the footer.
**Fix:** One sentence under the Sky vs building chart: "Four comparisons, no model. Every alert shows the numbers it fired on." One sentence under the hero card in `ink-3`: "Sensors and radio are simulated today; the rules, the trust score and the store-and-forward are the real code."

### 15. Phone node picker leaks the warehouse tenant and blocks pages that do not need a node
**Route:** `/m`, `/m/report`, `/m/status`, `/m/responder`.
**What is wrong:** A phone at Roosevelt High is offered "Aisle A / Rack 01 … Dock Office (gateway)" (tenant 2) and "Xenon A · real hardware". The same modal covers `/m/status` (a code lookup needs no node) and `/m/responder` after login (a lieutenant is asked "Which node are you next to?" before seeing the queue). Every row shows the word "Watch" with no meaning.
**Fix:** Filter the picker to the tenant of the site in the URL/hotspot (`?site=1` or the served node's tenant); do not mount it on `/m/status` or `/m/responder`; drop the "Watch" word.

### 16. Priority-4 advisories occupy the alarm banner, including on the responder console
**Route:** `/responder`, `/responder/audit`, `/admin`.
**What is wrong:** Banner: "Activity advisory at Athletic Field: Band now Moderate 08:01, PM2.5 9 at Athletic Field" rendered in the same banner slot as fires. During the fire the responder's banner read "… no heat — ask staff to check", which is advice to school staff, shown to SFD.
**Fix:** Responder shell shows priority ≤ 2 only; admin shell shows priority 4 as a quiet `ink-3` line under the decision card, not a banner.

### 17. Time Machine is clipped at 1440x900 and the page cannot scroll to it
**Route:** `/admin`.
**What is wrong:** `document.documentElement.scrollHeight === 900` with the Time Machine track's axis labels (07:00 … 19:00) below the fold; wheel scrolling does nothing. The drawer also covers the headline reading ("12" and "Athletic Fi…" cut).
**Fix:** Remove the fixed-height/overflow-hidden shell on `/admin` or set the map `max-h` to `calc(100vh - 480px)`; give the decision card `padding-right` equal to the drawer width when the drawer is open.

### 18. Disabled actions give no reason
**Route:** `/responder/incident/:code` actions rail.
**What is wrong:** "Draft WEA" renders identically to "Merge" (both grey). Merge's reason ("not in the demo") is only a hover `title`; WEA's has none. During the P0 above the presenter will click it and nothing will happen.
**Fix:** Inline `ink-3` text under the row: "Draft WEA needs a priority 1 or 2 alert at this node" / "Merge is not in the demo".

### 19. Old incidents survive a rewind, so the calm opening screen shows five "Trapped, Verified" reports at the gym
**Route:** `/admin` right rail, `/responder` queue at 07:33 sim.
**What is wrong:** `rewind_history` deletes alerts, readings and evals but not incidents; after a jump to "Calm morning" the overview listed `SN-5FF7`, `SN-5BEC`, `SN-5ET6` "Trapped, 2 people · Verified · Gymnasium" beside "Outdoor practice: Normal".
**Fix:** Part of the "Reset demo" control in item 5: close or delete incidents and drills created after the target sim time (they carry `sim_at`).

---

## P2

### 20. Rule source is clipped in the drawer and shows spec constants, not live thresholds
**Route:** Explain drawer → "Show the rule".
**What is wrong:** Lines cut at the 384 px edge: "if pm_rise > 40 and (temp_rise > 3 or gas_del", "# this n", "# region", "# one no". The block says `gas_delta > threshold` while the check row says 150; editing thresholds on `/admin/alerts` will not change the text.
**Fix:** Wrap at 40 columns, drop the trailing comments, interpolate `thresholds` from the explain payload.

### 21. Trust breakdown notes are truncated on the row that matters
**Route:** `/responder/incident/:code` Trust panel.
**What is wrong:** "gym: PM2.5 265 (>55), LOCAL_SMOKE_SUSPECT open" fits, but "gym: PM2.5 4, no temperature or gas rise, no …" and "No other devices reported trapped at gym in 1…" are cut with an ellipsis. The layers and points match spec §7.2 (40/30/20 cap 40/50/±10 −30/−40), which is good; the words are the evidence.
**Fix:** Allow two lines per note; drop the mono font for the note column.

### 22. SMS outbox status says "queued (demo)"
**Route:** `/admin/alerts` SMS outbox.
**What is wrong:** Backend status is `simulated`, the panel header says "provider disabled in demo", and `SmsOutbox.tsx` renders "queued (demo)" for every row. Nothing is queued; nothing will ever send. A `SIM-xxxx` provider id is also generated.
**Fix:** Render "not sent, provider disabled"; drop the fake provider id or show it as "would-be id".

### 23. Incident code hints disagree with the alphabet and with the spec
**Route:** `/m` ("Four letters or numbers. No zero, no letter O."), code screen ("No zero, no letter O."), `/m/status` error ("no zero, no letter O, no 1, no I").
**What is wrong:** `trust.ALPHABET` drops 0, O, 1, I and L (31 symbols). Spec §7.1 says 5 characters, ~33 million combinations; the product uses 4 (923,521).
**Fix:** One hint everywhere: "Four characters. No 0, O, 1, I or L." Either go to 5 characters or amend spec §7.1.

### 24. Rounded PM2.5 contradicts the band it is printed next to
**Route:** `/admin` banner, `/admin/air` decision log, `/admin/alerts`.
**What is wrong:** "Band now Moderate 08:01, PM2.5 9 at Athletic Field" and "Monitoring started 07:30, PM2.5 9 … Moderate". The table on the same site says Good is 0–9.0. The value was 9.3.
**Fix:** One decimal whenever the value is within 1 µg/m³ of a breakpoint.

### 25. Landing hero count-up shows a number that disagrees with the band pill
**Route:** `/` hero card, first second of every 24 s loop.
**What is wrong:** `useCountUp` animates "7" while the pill already says "Moderate" (shots2/landing-1440.png). Same in the "Cancel outdoor practice" state.
**Fix:** Start the count at the band's lower breakpoint, or fade the pill in after the count settles.

### 26. Landing stat "8 hops, 1 to 2 km each" is not something the demo shows
**Route:** `/` stat strip.
**What is wrong:** 8 is the mesh TTL; the demo relays over 2 hops. "1 to 2 km" is the line-of-sight figure; spec §3.7 says 300–600 m through buildings.
**Fix:** "2 hops in this demo, up to 8" and "300 m to 2 km per hop".

### 27. `/hardware` carries the honesty line three times
**Route:** `/hardware`.
**What is wrong:** Hero: "Designed for this submission, not yet fabricated; every part is off the shelf." Mesh panel: "Simulated mesh over local UDP, 15% drop. Dedup and retry are real". Footer: "Hardware designed, not fabricated, per organizer guidance …". DESIGN_V2 §2.4: exactly one, footer level.
**Fix:** Keep the footer; delete the hero sentence's first clause (keep "every part is off the shelf") and fold the mesh line into the footer.

### 28. Phone honesty line appears twice on `/m` and never on `/m/report` or the code screen
**Route:** `/m/*`.
**What is wrong:** The picker modal says "In production the node stamps this automatically" and the `/m` footer says "In production this page is served by the node itself"; `PhoneShell` renders the footer only when `pathname === '/m'`. A judge who scans a QR to `/m/report` never sees it.
**Fix:** Render the footer on every `/m` route; drop the sentence from the picker.

### 29. Decision log repeats the time inside the reason text
**Route:** `/admin/air` decision log.
**What is wrong:** `17:44 | Band improved to Unhealthy 17:44, PM2.5 123 at Athletic Field`.
**Fix:** Strip the `HH:MM` from `reason` when rendering in a table that has a Time column.

### 30. Audit log shows a resolve before the relay
**Route:** `/responder/audit`.
**What is wrong:** SN-NNZ8: "Resolved 12:58:21", "Relayed 12:58:23". Follows from item 7; visible on its own.
**Fix:** Item 7.

### 31. "Watch" status is undefined
**Route:** `/admin/nodes` Status column, phone picker rows, admin rail.
**What is wrong:** Every school node reads "Watch" during smoke; nothing on screen says what it means or how it differs from "Alert".
**Fix:** Legend under the table ("Watch: band at or above Sensitive groups; Alert: open engine alert") or drop the word and keep the band dot.

### 32. `/admin/nodes` mesh log starts empty
**Route:** `/admin/nodes` "MESH LOG — No hops yet."
**What is wrong:** The audit page shows relays a minute earlier; the panel only listens to live WS after mount.
**Fix:** Seed from the mesh log endpoint on mount.

### 33. Drill export is CSV, spec promises PDF
**Route:** `/admin/drill` ("Export report · CSV").
**What is wrong:** Spec §6.4: "Drill report exported as PDF for the compliance file." Briggs's compliance file is the buyer story.
**Fix:** Either add a print stylesheet for `/drills/:id/report` and label the button "Print / PDF", or change the spec line.

### 34. Invented part detail: "8 MB flash"
**Route:** `/hardware` rail detail for ESP32-S3-WROOM-1.
**What is wrong:** Spec never specifies flash size; WROOM-1 ships in 4/8/16 MB. Small, but it is an unsourced number on a page whose whole point is a sourced BOM.
**Fix:** Drop it, or add it to spec §3.1 with the part number (`ESP32-S3-WROOM-1-N8`).

### 35. Map pin hit target did not open the drawer with a mouse click
**Route:** `/admin` campus map (pre map-swap build).
**What is wrong:** Clicking the centre of `g[role=button][data-node-id=gym]` left the drawer closed; Playwright reported the `<svg role="img">` intercepting the click. The rail button works. The map was replaced mid-audit (now OSM footprints with labels), so re-check.
**Fix:** Give the pin group a transparent `<circle r=14>` hit area with `pointer-events: all` and verify at 1440x900, 1512x982 and 1920x1080.

### 36. Trust label word choice: "Likely" for a bare proximity report
**Route:** `/responder/incident/:code`, overview rail.
**What is wrong:** Score 40 renders "Likely" per spec §7.2 (30–59). It is correct, but with only "Submitted through node gym's WiFi" and nothing else, "Likely" over-promises to a responder. Not a bug, a copy risk when a judge asks "likely what?".
**Fix:** Keep the thresholds; add the score next to the pill everywhere the pill appears (the detail page already does).

### 37. Landing map and console map share attribution but not a legend
**Route:** `/` hero card and `/admin` map ("Map data © OpenStreetMap contributors" in 8 px).
**What is wrong:** Attribution is present, good. Neither map explains dot colour or the square gateway marker.
**Fix:** A one-line legend under the map: "dot = node, band colour; square = gateway; dashed = radio link".

---

## What is right and should stay

- The trust breakdown on `/responder/incident/:code` matches spec §7.2 layer for layer, shows points and reasons, and the bar is labelled "30 likely / 60 verified".
- The Explain drawer's check rows print `lhs op rhs` with the threshold in use; the "Sky vs building" bars with the median and the 2× "fire line" are the right picture.
- The WEA modal's disclaimer ("Nothing is sent from this screen") and the outbox header ("provider disabled in demo") are exactly the honesty the spec asks for.
- "Merge duplicates is not in the demo" and "Adding nodes from this page is not part of the demo" are honest scope lines.
- Recipients carry a "consented" status (TCPA), the phone page says "Without a node, a report can show as Likely at most", and the 911 line is on the landing and hardware pages.
