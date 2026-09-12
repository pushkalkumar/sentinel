# Judge walkthrough review

Lens: a judge on a 90-second table visit (Amazon/NVIDIA engineers, a school CTIO, a data-science teacher). At every screen: do I know in 5 seconds what this is, what is real, what is simulated, and why it matters?

Method: isolated Playwright (chromium 1234, playwright-core 1.61) at 1440x900 and 390x844 against http://localhost:5173 with the live backend (:8000) and simulator (:8001). Sim driven through `POST /api/sim/control` (jump calm, jump smoke, trigger_fire gym at 60x and 10x). Every route below was screenshotted and read. Screenshots are in the scratchpad (`shots/d*` desktop, `shots/s*` sim walkthrough, `shots/m*` phone, `shots/r*` responder, `shots/x*` drill and overview). Other agents were editing pages and jumping the simulator during the run; where a finding could be a mid-edit artefact it is marked "verify before demo". Nothing in this review was observed only once unless stated.

Severity: P0 blocks the pitch, P1 hurts judging, P2 polish.

Counts: 6 P0, 17 P1, 12 P2 (35 items).

---

## P0

### 1. The headline demo beat, "trigger a fire at the gym", does not produce a fire
Route: `/admin` (and `/responder`, `/m`), sim at the default 60x.
What is wrong: `trigger_fire gym` at 60x opened `LOCAL_SMOKE_SUSPECT` (priority 3), never `LOCAL_FIRE`. Banner text 33 s after the trigger: "Local smoke suspected at Gymnasium: PM2.5 rose 184 at this node while neighbours sit at 80; no heat — ask staff to check". The alert's metrics were `temp_rise: 0, gas_delta: -2`. The same misclassification was already in the database when the review started (alert id 3, `temp_rise -0.1`, `pm25 236.8`), so it is reproducible, not a one-off. At 10x the fire was caught (`LOCAL_FIRE tr=3.1 gd=164`), which points at the engine's 2-minute temperature lookback missing the 60-second ramp (`FIRE_RAMP_S = 60`) when the sim advances 60 sim-seconds per real second.
Why a judge cares: spec §6.2 and §11.4 make "one node spiking while neighbours are flat is a fire" the whole technical pitch to the Amazon judges. On stage the screen will say "no heat, ask staff to check" while the presenter says "this is a fire". The phone banner during the same state read "Hazardous air at Gymnasium. Shelter indoors." which is the opposite advice for a room that is on fire.
Fix: make the fire branch robust to speed. In `backend/app/alerts/engine.py` `match_branch`, add a level check alongside the rate check: `temp_c > median(neighbour temp) + p["temp_rise"]` or `mq2_raw > baseline + p["gas_delta"]` qualifies as heat/gas. In `simulator/world.py` raise `FIRE_RAMP_S` to 180 so the ramp spans several 30 s ticks at any speed. Then have the "Gym fire" scenario jump assert that a `LOCAL_FIRE` opened within 3 ticks and log a warning if not, so this cannot silently regress again.

### 2. "Calm morning" is not calm: jumping to the opening beat leaves yesterday's alerts, readings and incidents on screen
Route: `/admin` after `jump calm` (07:30, paused).
What is wrong: the screen showed headline "Sensitive groups", banner "Activity advisory at Athletic Field: Sensitive groups indoors 19:37, PM2.5 54" (a timestamp twelve hours in the sim future), Gymnasium 216 in the node rail, and three open "SN-X7CT Trapped Verified" incidents from earlier test runs. A second capture after another agent's calm jump showed "FIRE DETECTED AT GYMNASIUM. EVACUATE." with the time machine at 07:30 and the scenario chip reading "Calm morning, 60x".
Why a judge cares: demo step 1 (spec §10.3) is "calm campus, all nodes green, Outdoor practice: OK". The first thing a judge sees instead is a contradictory screen, and the presenter starts by apologising.
Fix: add a `reset` action to `/api/sim/control` that (a) rewinds to 07:30, (b) clears `alerts`, `decision_log`, `sms_log`, mesh log and the readings ring, (c) resolves or deletes incidents flagged `demo=true`, and (d) recomputes the decision card from the fresh tick. Wire it to a "Reset demo" row at the top of the scenario menu and run it before every judge. Until then, at minimum clear open alerts and the readings ring on any backward jump (`rewind_history` in `backend/app/core/sim.py` currently leaves the 19:37 advisory open).

### 3. A warehouse node drives the school's decision card and banner
Route: `/admin` overview, `/responder` queue (Roosevelt High School tenant).
What is wrong: decision card caption read "PM2.5 µg/m³, 10-min at Aisle B / Rack 10" on the Roosevelt admin overview, and the responder banner read "Activity advisory at Aisle B / Rack 10: Sensitive groups indoors 13:55, PM2.5 36 at Aisle B / Rack 10" while the map header said "ROOSEVELT HIGH SCHOOL". Seen on two different pages a few minutes apart. Verify before demo (could be a live edit), but it was reproducible during the review.
Why a judge cares: the school CTIO is the buyer. "Your principal's dashboard shows someone else's warehouse" ends the conversation about data ownership. It also undercuts "regional" logic: a rack in a warehouse is not the school's neighbour.
Fix: scope the decision card query and banner alert query by `site_id` (the overview endpoint receives `site_id=1`; the card and the "worst open alert" selector must filter on it). Add a test: seed both sites, assert `/api/sites/1/overview.decision_card.node_id` is in site 1's node set.

### 4. Map dots have drifted off their buildings
Route: `/admin` overview map, 1440x900.
What is wrong: at the start of the review the eight dots sat inside their building outlines. By 13:35 PDT they were scattered: the gym dot floated above the gym box, one dot sat at the far right outside any building, the field and lot dots were gone. Nodes still listed correctly in the rail. Verify before demo (likely a mid-edit regression to the node position mapping or the SVG viewBox, `view_box: "0 0 1000 700"`).
Why a judge cares: the map is the primary object of the overview and the only thing a judge can look at without reading. Dots off buildings reads as broken software in the first two seconds.
Fix: whichever field the map reads for position (`map_x/map_y` vs `x/y`) must match what `/api/sites/1/overview` returns; add a screenshot test that renders `/admin` and asserts each node's dot centre lies inside its building polygon. Restore node labels on every dot (see P1 item 12) so drift is obvious.

### 5. Landing hero shows a number, a headline and a band that disagree
Route: `/` hero card, 1440 and 390.
What is wrong: the scripted loop was captured reading "8 / PM2.5, 10 min / Cancel outdoor practice / Unhealthy" and, on another cycle, "31 / Sensitive groups indoors / Unhealthy". 8 µg/m³ is Good, 31 is Moderate, "Unhealthy" starts at 55.5. The number animates on a different clock from the headline and pill.
Why a judge cares: the data-science teacher (spec §11.3) is told the decision card is the thing to look at. The first decision card she sees pairs an 8 with "Unhealthy". Every EPA breakpoint claim on the page is now suspect.
Fix: drive number, headline and pill from a single state object per loop frame (`{pm25, band, headline}`) and remove the independent count-up tween on the number, or tween all three off the same interpolated PM value so the band is `bandOf(displayedValue)`. Never let the pill show a band the visible number does not belong to.

### 6. Stale alerts survive time-machine jumps, so the banner contradicts the readings
Route: `/admin`, `/responder`, `/admin/drill`.
What is wrong: "FIRE DETECTED AT GYMNASIUM. EVACUATE." stayed in the banner with a 14:02:00 stamp while the node rail read "Gymnasium Fire 52" (52 µg/m³, well below every neighbour at 76 to 87) and the time machine read 07:30. A `LOCAL_SMOKE_SUSPECT` from 14:00 was still open when readings had fallen to 50. The clear rule (`_should_clear_local`) does not run when history is rewound and the rewind does not close alerts opened after the new time.
Why a judge cares: the pitch line is "the alert follows the sensor". A red EVACUATE bar over a node reading 52 disproves it on screen.
Fix: in `rewind_history` close every alert whose `started_at` is later than the new sim time; on every forward tick after a jump, run the clear check for all open local alerts even if that node did not report this tick. Show `cleared_at` reason in the banner when it drops ("Cleared 14:07, gym back to 54").

---

## P1

### 7. Three different clocks on every console screen, none labelled
Route: all `/admin/*` and `/responder/*`.
What is wrong: header "13:35 PDT" (wall clock), banner "14:02:00" (alert sim time), time machine "07:30" (current sim time), scenario menu "Gym fire, 15:34 sim time", nodes table "sim 18:21:00". On one screenshot four of these disagree.
Why a judge cares: the first question at the table is "wait, what time is it in this demo". Spec §10.1 requires the simulated parts to be labelled; the clock is the most visible simulated thing and it is not.
Fix: one sim clock in the header, labelled "Sim 14:02" with a small "60x" suffix, replacing the wall clock (nobody needs PDT). Banner stamps become relative to sim ("opened 7 min ago"). Delete the "sim 18:21:00" column from the fleet table.

### 8. Banner text is duplicated
Route: `/admin/*` during the smoke phase.
What is wrong: "Cancel outdoor practice and recess. Cancel outdoor practice and recess; PE indoors". Headline and guidance are concatenated, and the guidance repeats the headline.
Fix: banner shows the headline only ("Cancel outdoor practice and recess"); guidance lives on the decision card, where it already appears.

### 9. Alerts page says "No open alerts" while the API had two open
Route: `/admin/alerts`.
What is wrong: "OPEN ALERTS. No open alerts. The engine opens one when a node crosses a rule." at 13:03 PDT while `GET /api/alerts?site_id=1` returned ids 5 and 3 with `cleared_at: null`. Observed once; verify. Likely a filter on `zone_id` or a stale fetch with no WS refresh.
Why a judge cares: this is the page the presenter opens to prove the engine is rule-based. Empty means "nothing happened".
Fix: subscribe the Alerts page to the same `alert_opened/alert_cleared` WS events the banner uses, and render the same list the banner reads from.

### 10. SMS outbox read "0 messages" in every phase captured
Route: `/admin/alerts` outbox, `/admin/drill` outbox disclosure.
What is wrong: "SMS OUTBOX 0 messages, provider disabled in demo" through calm, smoke and the gym fire. Fan-out only runs for priority ≤ 2 alerts (`sms.fan_out`), the regional smoke peaks around 134 to 144 (hazardous SMS threshold is 225.5), and at 60x the fire opened as priority 3 (item 1). A backward jump also deletes `sms_log`.
Why a judge cares: demo step 6 is "SMS outbox shows the zone alert that went to registered parents". It will be empty.
Fix: fix item 1 so `LOCAL_FIRE` fires; lower the demo hazardous threshold to 150 in the seeded policy (label it "demo threshold" on the Alerts page); make the outbox survive a rewind, or re-fan-out when the alert reopens.

### 11. During the fire beat the primary object is still the sky
Route: `/admin` overview after `trigger_fire gym`.
What is wrong: the 60px headline reads "Very unhealthy", the big number is "133 at Athletic Field", and the gym is one small dot with "274" under it. The fire is a one-line amber banner and an "Alert" tag in the rail.
Why a judge cares: spec §11.4: "the neighbours are flat, so this is a fire in this room". The screen shows the opposite hierarchy. The presenter has to point at a 6px dot.
Fix: when any priority ≤ 3 node alert is open, the decision card yields the top slot to an alert card: headline "Fire at Gymnasium" (or "Smoke at Gymnasium, no heat"), the node's PM2.5 next to the neighbours' median ("274 vs 80 around it"), temp delta, and a "Why: one node spiking, neighbours flat" line. Move the outdoor decision to the chip. Pulse the alerted dot and draw a ring around it on the map.

### 12. Admin map has no node labels
Route: `/admin` overview.
What is wrong: dots are unlabelled except the one currently alerted; the responder map labels all eight. A judge cannot tell the gym from the library.
Fix: label every dot the way the responder map does (sans 11px `ink-3`), reading in `ink` under the label when a node is selected.

### 13. The trust score is invisible everywhere except the incident detail page
Route: `/responder` queue, `/m/responder`, `/m/report` code screen, `/admin` incidents rail.
What is wrong: every card shows the pill "Verified" and nothing else. All 6 queued incidents were "Trapped, 2 people, Gymnasium, Verified". The phone code screen says "Report received. Responders have it." with no mention of verification or why. Only `/responder/incident/:code` shows the breakdown, and there the sensor line reads "gym: PM2.5 259 (>55), LOCAL_SMOKE_SUSPECT open", an internal enum on a responder screen. There is no Likely or Unverified report anywhere in the demo to contrast against.
Why a judge cares: spec §7.2 and the Best AI for Good line depend on "verification is built in". A single green pill on everything looks like a hard-coded label.
Fix: (a) queue card shows "Verified 100 · node + sensor + 4 devices" as a second line; (b) phone code screen shows "Verified: you are next to the Gymnasium box and its sensors agree" or "Likely: no box nearby"; (c) seed one Unverified internet-only report in the demo data so the sort and the pill colours have something to contrast; (d) rewrite the sensor corroboration string as "Gymnasium sensors agree: PM2.5 259, smoke alert open".

### 14. Nothing on screen demonstrates the offline claim
Route: header of every console, phone pages.
What is wrong: demo step 5 is "turn off the laptop's uplink WiFi, do it again". The UI has no uplink state at all: no "Cloud: connected / Cloud: down, 2 queued" indicator, no store-and-forward counter, no "served by node gym" badge on the phone. `LIVE` in the header refers to the WebSocket to the laptop, which stays up.
Why a judge cares: the Frontier award is for "works with the internet dead". Turning off WiFi produces no visible change, so the judge has to take it on faith.
Fix: add an "Uplink" pill in the desktop header driven by a backend heartbeat to a fake cloud endpoint (`/api/uplink` that the sim can toggle with `action: "uplink", up: false`): "Cloud synced 12 s ago" / "Cloud down, 3 events queued". Add the same line to the phone footer ("Served by node gym, no internet needed"). The scenario menu gets a "Cut the uplink" row.

### 15. "Only a responder can resolve" is asserted on the landing page but not shown in the admin console
Route: `/admin` incidents rail, `/responder` as admin.
What is wrong: the admin's incidents panel is read-only with no hint; an admin visiting `/responder` gets the responder queue in the admin shell with the same layout as the responder, which suggests admins can act. The one sentence that explains the rule ("Only a responder can change the status") is buried in the actions rail on the detail page.
Fix: put "Read-only. Only a responder can close an incident." under the INCIDENTS signage on the admin overview, and render the admin's view of `/responder` with a top line "Viewing as principal. Actions are for Seattle Fire." Keep the rule out of the landing prose; show it where it bites.

### 16. Cost story is inconsistent across pages
Route: `/`, `/hardware`.
What is wrong: landing says "$31 per node at 1,000 units"; hardware headline says "Thirteen parts. Thirty-one dollars." but the rail lists 14 rows (the 14th is "IP65 enclosure tray, counted with the lid"), the 13 priced parts sum to $28.30, the SX1262 is $3.90 in the rail and $4.80 in the BOM table below, and the $2.50 assembly line that closes the gap to $31 is not in the rail. The pin-map block says "S3 remap pending".
Why a judge cares: the CTIO will add the rail up. The NVIDIA judge will read "remap pending" as "not designed".
Fix: rail footer line "13 parts $28.30 + assembly $2.50 = $30.80, call it $31 at 1,000". Fold the antenna into the SX1262 row or split it in the BOM table too. Remove "S3 remap pending" or replace with "GPIO numbers for the S3 DevKit".

### 17. Responder queue looks like spam
Route: `/responder`.
What is wrong: six near-identical open incidents ("Trapped, 2 people, Gymnasium, Verified, received") from test runs, "Merge" disabled with no explanation, and crowd corroboration awards "+40: 4 other devices reported trapped at gym" to reports all generated from one laptop.
Why a judge cares: the anti-abuse pitch (spec §1.5) is undermined by a queue that shows the system happily verifying six copies of the same report.
Fix: demo reset (item 2) closes test incidents; enable Merge when two open incidents share node and type; count crowd corroboration by distinct device fingerprint and show "3 devices" not "4 other devices".

### 18. Time-machine and speed controls disagree, and the demo driver is hidden
Route: `/admin` overview bottom.
What is wrong: the speed segmented control shows "1x" active while the chip reads "Gym fire, 60x" and the sim reports speed 60. The TIME MACHINE bar sits at y=766 to 900 at 1440x900 and its timeline is clipped until the inner `main` is scrolled. The chip label ("Gym fire, 60x") does not say it is the simulator control.
Fix: bind the segmented control to `sim.speed` (add 60x and 300x to it or remove it); move the time machine above the honesty line with the map shrinking to fit 900px; label the chip "Scenario: Gym fire".

### 19. Air page range selector lies
Route: `/admin/air`.
What is wrong: "3 h" is selected; the x-axis spans 17:30 to 18:10 (40 minutes). Chips "field out" and "parking out" are unexplained (they mean outdoor nodes). The y-axis ticks (9, 35, 55, 125) are band breakpoints but are not labelled as such.
Fix: axis spans the selected range, padded with empty space if history is short; rename chips "field (outdoor)"; add band names next to the tick values or a legend line "ticks are EPA band edges".

### 20. Nodes page: eight healthy nodes all show amber "Watch"
Route: `/admin/nodes`.
What is wrong: headline "8 of 8 nodes online", every row status "● Watch" in `warn` colour at 100% battery and -43 to -90 RSSI. "Watch" is never defined.
Fix: status is "OK" in `ok` unless battery < 30%, RSSI < -95 or last seen > 2 ticks; "Watch" only for those, with the reason as the tooltip.

### 21. Phone node picker mixes warehouse racks into the school list
Route: `/m` (auto-opens on first visit), `/m/status`.
What is wrong: the sheet lists Arts Building through Science Wing and then "Aisle A / Rack 01 ... Dock Office (gateway)" with no site headers. It also pops open over `/m/status?code=` on a fresh phone, so a judge who scans a status link gets asked which node they are next to before seeing their status.
Fix: group by site with a header ("Roosevelt High School", "Northgate Warehouse"), or hide the other tenant's nodes when the phone was served by a site-scoped URL; do not open the picker on `/m/status`.

### 22. Phone code screen claims delivery before the hop
Route: `/m/report` result.
What is wrong: "Report received. Responders have it. This is your code." appears instantly; the hop animation and "delivered to hub via 2 hops" exist only in the audit log and the responder timeline. Spec §10.3 step 4 wants the judge to watch the message hop.
Fix: code screen shows a three-state line under the code: "Sent to Gymnasium box → relaying (gym → science → hub) → Responders have it", driven by the incident's relayed event over polling; the desktop map plays the hop at the same time.

### 23. Phone banner gives wrong advice during a local fire
Route: `/m/*` banner.
What is wrong: "Hazardous air at Gymnasium. Shelter indoors." while the gym is the node with the fire signature (PM2.5 232, temp 26.8°, gas 550 on the responder strip).
Fix: banner copy by alert kind: LOCAL_FIRE → "Fire suspected at Gymnasium. Leave the building, muster at Athletic Field."; LOCAL_SMOKE_SUSPECT → "Smoke at Gymnasium. Staff are checking."; HAZARDOUS_SMOKE → "Hazardous air. Shelter indoors."

---

## P2

### 24. Teacher roll call uses "S-3B-01" as student names
Route: `/m/staff` during a drill.
What is wrong: "Missing (tap names)" followed by 30 pills reading S-3B-01 to S-3B-30. Under "Muster point" the helper reads "In production the node stamps this automatically; pick the node you are standing next to." (copied from the node picker). The header still says "No node picked".
Fix: seed first-name-plus-initial rosters (or say "IDs only, FERPA") and replace the helper with "Where your class is standing now."

### 25. Responder banner links to `/admin/alerts`, which responders cannot open
Route: `/responder`, banner "Alerts" link (`Banner.tsx` line 30).
Fix: hide the link for the responder role or point it at the incident queue.

### 26. Landing stat "8 hops, 1 to 2 km each"
Route: `/` StatStrip.
What is wrong: the demo has 8 nodes, not 8 hops; "0 internet required" reads as a joke next to real numbers.
Fix: "8 nodes on campus, 1 to 2 km per hop" and "No internet required" as words, not a zero.

### 27. Honesty line is the least legible text on the page
Route: `/` footer, `/admin/*` footer.
What is wrong: `ink-4` (#45413C) on #0B0A09 is roughly 1.9:1 contrast. The sentence the rules require ("sensors are 8 virtual nodes, SMS is disabled") is effectively hidden.
Fix: `ink-3` at 13px. It can be quiet without being invisible.

### 28. Hardware page: explode control has no affordance, empty panel and dead space
Route: `/hardware`.
What is wrong: "Explode" is a hairline track with a 6px thumb; clicking the word does nothing. Below the campus mesh scene there is an empty rounded panel on the right and about 250px of blank canvas before the footer. The 3D canvas also makes headless screenshots hang (continuous render loop), which hints at the frame cost on a hot laptop.
Fix: make "Explode" a toggle button that animates factor 0 → 1 (keep the slider for scrubbing); fill or delete the empty panel; cap the mesh scene's `frameloop` to `demand` when not hovered.

### 29. Scenario menu "Start a fire (select a node first)" with no way to select a node in the menu
Route: `/admin` scenario menu.
Fix: submenu listing the eight nodes, or "Start a fire at Gymnasium" as the default with a node picker beside it.

### 30. Toast covers the responder sensor strip
Route: `/responder`.
What is wrong: "New report SN-BUZT: Trapped at Gymnasium" toast sits over "Signal -81" at the bottom right.
Fix: toasts stack top-right under the header.

### 31. Incident detail "WHERE" map is cropped to a corner
Route: `/responder/incident/:code`.
What is wrong: the mini map shows Cafeteria and Gymnasium only, with building outlines cut by the panel edge.
Fix: fit the whole campus SVG in the panel and ring the incident node; or crop deliberately with a 2x zoom centred on the node and a label.

### 32. `/demo` is a 404
Route: `/demo`.
What is wrong: "404 Page not found NOTHING HERE". Spec §10.3 and the task brief expect a demo route.
Fix: either ship `/demo` as the scripted 90-second driver (buttons for the seven beats) or remove it from every doc and link.

### 33. WebSocket warning on every page load
Route: all console pages; console shows "WebSocket connection to ws://localhost:5173/live failed: WebSocket is closed before the connection is established" once per navigation.
Why a judge cares: the NVIDIA infra judge will have DevTools open.
Fix: the `useLive` effect opens a socket then unmounts under StrictMode; guard the close with `readyState === OPEN` or defer connect to the next tick.

### 34. Audit log ordering: "Relayed" appears after "Resolved"
Route: `/responder/audit`.
What is wrong: SN-NNZ8 shows Received 12:58:20, Acknowledged 12:58:20, Resolved 12:58:21, Relayed 12:58:23. The hub received the message after the incident was closed.
Fix: order by event time and gate Acknowledge on the relayed event in the demo, or stamp Relayed with the sim time it actually hopped rather than the wall time the log was written.

### 35. Drill page and fire banner share the word "fire"
Route: `/admin/drill` during a drill with a fire alert open.
What is wrong: "FIRE DETECTED AT GYMNASIUM. EVACUATE." above "Fire drill running" with no visual separation between drill and real.
Fix: prefix drill copy with "Drill:" and use `signal` colour for drill state so red is only ever real.

---

## What already works and should be protected

- Responder incident detail: trust breakdown with the six layers and point values, immutable resolve with required note ("Resolved by you at 13:25. This cannot be undone."), audit row with actor and IP. This is the strongest screen; make the queue and phone screens borrow from it.
- Role gating: responder hitting `/admin` gets "That page needs a different account." with the login form, not a blank page.
- Drill flow end to end: start, teacher submits "28 / 30, 2 missing", admin grid updates, close, export.
- Phone report form: six big tiles, stepper, optional location with honest fallback copy, code screen with "No zero, no letter O. Write it on your hand."
- Hardware 3D: product-photo lighting, correct part list, block schematic with the power path explained in four sentences.
