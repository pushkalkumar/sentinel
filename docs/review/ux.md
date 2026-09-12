# UX usability review: principal and fire lieutenant

Method: isolated Playwright (chromium 1234 via playwright-core 1.62) at 1440x900 and 390x844, every route screenshotted and inspected. Six tasks run end to end as a principal (admin@sentinel.demo), a teacher (staff code T-3B-7Q2), a civilian on the phone pages, and a fire lieutenant (responder@sentinel.demo). Sim driven through `POST /api/sim/control` (jump to `fire`) and cross-checked against `/api/alerts`, `/api/nodes/gym/explain` and `:8001/state`. Other agents were editing pages and restarting the backend during the run; every finding below was either reproduced twice or confirmed against the API or source, and the ones that could be restart noise are labelled.

Screenshots: `/private/tmp/claude-501/-Users-pushkalkumar-Desktop-sentinel/f63a6333-2c64-4d86-a532-a2924163a542/scratchpad/ux/*.png` (referenced by name below).

## Task outcomes

| Task | Result |
|---|---|
| Cancel outdoor practice decision | Not performable. The card flips on its own; there is no button for the principal to confirm, log, or tell the coaches. Dead end (item 5). |
| Find which building is on fire and why the system says fire, not smoke | Failed on the first run: the "Gym fire" scenario produced "Local smoke suspected... no heat" (item 1). On the second run it said fire. The admin map has no labels so the building had to be found from the right rail. "Why this reading" said "Nothing out of the ordinary" while the gym read 275 (item 3). |
| Acknowledge and resolve a report | Completed. Two hesitations: clicking a queue card does not open it (item 11), and the trust panel said the sensors showed nothing during a detected fire (item 16). |
| Run a drill and find who is missing | Completed. The answer is "S-3B-04 and S-3B-14", which is not a who (item 12). Submit was off screen on the phone (item 13). |
| Check a report status by code on the phone | Completed once a node was picked. First contact is a modal listing 16 nodes across three sites (item 10). Status auto-updated without Refresh, which is good. |
| Draft a WEA message | Completed. The polygon on the map does not contain the burning building (item 15). |

## Findings, ranked

### P0: blocks the pitch

**1. P0 · /admin, /admin/alerts, /responder · The "Gym fire" scenario is a coin flip between LOCAL_FIRE and LOCAL_SMOKE_SUSPECT, and the first classification sticks.**
Run A (jump `fire`): `/api/alerts` returned `LOCAL_SMOKE_SUSPECT` at 14:35:00 with `temp_rise 0.0, gas_delta -2.0`, banner text "Local smoke suspected at Gymnasium: PM2.5 rose 184 at this node while neighbours sit at 80; no heat — ask staff to check". Thirty sim minutes later the gym read 285 PM2.5, 26.8 C, MQ-2 559 and the alert was still LOCAL_SMOKE_SUSPECT. Run B (same jump): `LOCAL_FIRE` at 14:34:30 with `gas_delta +350`. The PM spike lands one tick before heat and gas, and an open alert is never re-evaluated. Why a judge cares: demo script step 3 is "Engine fires LOCAL_FIRE at the gym, not a smoke advisory", and the AI for Good pitch is the fire-vs-smoke discriminator. Half the time the screen contradicts the sentence being said. Fix: in the alert engine, re-run the classifier every tick for nodes with an open alert and escalate upward (SMOKE_SUSPECT to FIRE) when `temp_rise > 3 or gas_delta > threshold` is met; in the simulator start the temperature and MQ-2 ramp on the same tick as the PM spike (or lead with heat by one tick); add a level rule `pm25 > 225.5 and pm25 > 2 x regional and (temp - temp_at_fire_start) > 3 -> LOCAL_FIRE` so a plateaued fire keeps its classification (see item 3 for the plateau case).

**2. P0 · /m (phone banner) · The phone tells a person standing in the burning gym to "Shelter indoors".**
With the gym at 259 PM2.5 and the alert at LOCAL_SMOKE_SUSPECT (run A above), the phone banner read "Hazardous air at Gymnasium. Shelter indoors." (m01c_role_after_pick.png, m02_report.png). `BandBanner.tsx` only says "Leave the building" when `alert.kind === 'LOCAL_FIRE'`; any other hazardous band, including a single node spiking to 2 to 3x its neighbours, gets the wildfire shelter message. Why a judge cares: a fire lieutenant reads this as the product telling occupants to stay in the fire. It is the one sentence on the phone that must never be wrong. Fix: in `BandBanner.tsx`, when the node has any open local alert (LOCAL_FIRE or LOCAL_SMOKE_SUSPECT) or `pm25 > 2 x regional`, show "Smoke reported at {label}. Leave the building and go to your muster point." Use "Shelter indoors" only for HAZARDOUS_SMOKE / regional band with no local spike.

**3. P0 · /admin "Why this reading" drawer · The explanation contradicts the screen it sits on.**
State: gym 274.8 PM2.5, 26.0 C, MQ-2 552, ratio 2.92x neighbours, sim fire override on. `/api/nodes/gym/explain` returned `branch: CLEAR, verdict: "Nothing out of the ordinary at this node."` because every check is a 2 to 5 minute delta and the fire had plateaued. Earlier, during smoke decay, the same endpoint returned `branch: LOCAL_FIRE, verdict: "heat is rising. This is a fire here"` with `temp_rise -3.8` and all four checks `pass: false`. Once it returned a 500 that rendered as red "Unexpected response (500)" in the drawer (22_admin_after_rail_click.png; the 500 coincided with a backend restart, the contradictions did not). Related: after a backend restart mid-fire `/api/alerts` was empty while the gym still read 275, so the banner fell back to "Very unhealthy" and the responder queue showed no fire. Why a judge cares: this drawer is the "rules first, no LLM" artifact for the Amazon judges; a verdict that disagrees with its own checks reads as fake. Fix: the explain response must lead with the open alert for the node (kind, started_at, metrics captured at trigger) and only then the live checks; generate the verdict string from the checks that passed, never from a cached branch; add the level rule from item 1 so a plateaued fire evaluates as fire, not CLEAR.

### P1: hurts judging

**4. P1 · /admin · The principal cannot act on the decision card.** The card reads "Very unhealthy. All outdoor activity cancelled; consider dismissal per district policy." with no button. `/admin/air` decision log entries are engine-generated ("Practice cancelled 13:55, PM2.5 80 at Athletic Field"), and the SMS registry only fires at hazardous or fire, so the coaches are never told. The task "cancel outdoor practice" ends with the principal walking to the field. Fix: add one action on the card, "Notify staff", that writes a decision-log row with actor and time ("Cancelled by D. Whitfield 14:32") and queues an SMS to a Coaches/PE recipient group; show "Sent to 4 staff 14:32" on the card afterwards.

**5. P1 · every console page · Three clocks on one screen.** Header "13:05 PDT" (wall clock), banner "14:00:00" (sim), time machine "15:45" (sim), incidents "received 2 min ago" and "13:21:41" (wall). On the responder queue the fire is stamped 14:34:30 and the reports it produced are stamped 13:21:41, an hour before the fire (30_responder_queue.png). Fix: one clock. Stamp incidents, audit rows and messages with sim time while the simulator is connected, show the sim clock in the header with a small "sim" label, and drop the PDT wall clock.

**6. P1 · /admin campus map · No node labels; the fire node looks like every other red dot.** Labels are `opacity-0 group-hover:opacity-100` (found in the SVG). The pulse ring sits on the decision node (Athletic Field), not the alarm node (21_admin_fire_hover_gym.png). The responder map and /demo map do show labels, so the principal's own map is the only unlabelled one. Fix: always render label and reading under each dot (as /demo does); put the ring on the node with the highest-priority open alert in that alert's colour.

**7. P1 · banner "Alerts" link · Sends the responder to a sign-in page that says they have the wrong account.** `Banner.tsx` renders `<Link to="/admin/alerts">` for every non-fire alert regardless of role. As the responder, clicking it lands on `/login?next=/admin/alerts&denied=1` with "That page needs a different account" (x01_responder_admin_alerts.png). Fix: render the link only when the session role is admin; for responders link to `/responder` or render no link.

**8. P1 · /m/report at 390x844 · "Send report" is below the fold.** After tapping Trapped and setting the count, the viewport ends at "Share my location"; `getBoundingClientRect` for the button had `top > 844` (p02_report_filled_fold.png). A stressed reporter has to know to scroll. Fix: make the submit a sticky bottom bar (56 px, full width, `f-ink` solid), and collapse "Anything else?" to a single-line field that expands on focus.

**9. P1 · /m · First contact is a modal asking which of 16 nodes you are next to.** The list mixes Roosevelt buildings with "Aisle A / Rack 01", "Dock Office (gateway)" and "Xenon A · real hardware Offline" (m01_role.png, n05_m_responder.png). The copy admits it: "In production the node stamps this automatically; pick the node you are standing next to." A judge on their phone has no way to know which is right. Fix: scope the picker to one site via `?site=` or `?node=` in the URL printed on the table card and hotspot page (`http://<ip>:5173/m?node=gym`), auto-select it, hide other tenants' nodes, and show "Not next to a node" first, not after the list.

**10. P1 · /responder queue · Clicking a card does not open it.** Click selects the card and updates the map; the actions live on a separate detail page reachable only through a 12 px "Open" word that appears on the selected card, or Enter (30_responder_queue.png). The lieutenant's first task, acknowledge, needs two clicks and a discovery. Fix: card click navigates to `/responder/incident/:code`; use hover (or a small map icon) to preview on the map.

**11. P1 · /admin/drill and /m/staff · The roster is IDs, not names.** Chips read S-3B-01 to S-3B-30; the missing panel shows "S-3B-04 · 3B · Athletic Field" and the printable report lists "S-3B-04" under "Missing students" (dr27_admin_missing.png, dr29_report.png). "Who is missing" has no answer a principal can shout across a field. Fix: seed the roster with names (first name and last initial is enough), show the name on the chip and in the missing list, and keep the ID as a secondary mono field.

**12. P1 · /m/staff roll call · Submit is off screen behind 30 chips and a muster-point picker, and there are two ways to enter the same number.** A "Present" stepper (30, minus/plus) sits above "Missing (tap names)"; tapping names decrements Present, but the minus button also works, so a teacher can double count. Below the chips is a muster-point select with the "pick the node you are standing next to" copy again, then "Submit roll call" (dr25_submit_area.png). Fix: remove the stepper and show Present as a derived read-only number; default the muster point to the class's usual point with a "Change" link; sticky submit bar reading "Submit: 28 present, 2 missing".

**13. P1 · /admin/drill · "Close drill" is the primary button beside the timer with no confirmation; after closing, the grid still says "waiting".** One click at 1 of 6 classes ended the drill (dr13_closed.png); the five un-submitted tiles kept the label "waiting" on an ended drill. Fix: confirm dialog "5 classes have not reported. End the drill anyway?"; make Close a secondary outline button; after end, relabel tiles "not submitted".

**14. P1 · Draft WEA dialog · The alert polygon does not contain the fire.** The dashed "Campus South" rectangle sits below the gym dot; the gym is outside it while the footer says "1 node affected" (w01_wea.png). The mini-map also uses a different layout from the campus map the lieutenant just looked at (parking top-left, gym top-right). Fix: build the polygon as a buffer around the affected nodes (150 m) and the zone, render it with the same campus map component so geometry matches.

**15. P1 · /responder/incident · Trust panel says the sensors show nothing while the same page shows a fire.** "Sensor corroboration: gym: PM2.5 4, no temperature or gas rise, no open alert → 0" next to NODE NOW "PM2.5 187, Temp 25.0, Gas 534, Fire at node since 07:52" and a red FIRE DETECTED banner (p07_after_ack.png). Sensor corroboration is computed once at submit and never revisited. Fix: recompute trust for open incidents whenever the node's alert state changes (or on detail load) and stamp the row "as of 13:34:21".

**16. P1 · /admin/alerts SMS outbox · A fire in the gym texts Campus South only.** All 12 outbox rows are Campus South recipients; the principal, nurse and office manager are registered in Campus North and get nothing (a08_alerts_bottom.png). Demo step 6 is "SMS outbox shows the zone alert that went to registered parents"; the buyer will ask why the principal's phone stayed quiet. Fix: priority 1 alerts fan out to every zone of the site plus a staff group; keep zone scoping for band advisories.

**17. P1 · /demo · Chapter text contradicts the screen on load.** "01 A normal morning: 07:30 at Roosevelt High. Eight nodes, all green, practice is on" is shown over a 14:29 clock, all nodes red, "Cancel outdoor practice and recess", gym 255 (x05_demo.png). The first thing on stage is a contradiction. Fix: on load and on chapter select, jump the sim to the chapter time and clear overrides before rendering the chapter card; disable Play until the jump acknowledges.

**18. P1 · /admin/air · Default 3 h view rendered an empty chart.** Observed once at sim 15:45: no lines, legend names stacked at the left, axis 18:45 to 18:46 (10_admin_air-full.png). The 8 h view rendered correctly (a04_air_hover.png). This is the page for Dr. Zhou. Fix: anchor the window to the sim clock rather than wall clock, clamp the span so it never collapses below the window length, and render a "No readings in this window" state instead of an empty axis.

**19. P1 · /admin banner · Stale and low-value alerts occupy the top strip.** A 14:00 "Local smoke suspected" alert was still the banner at 15:45, and an amber bar appeared for "Activity advisory at Athletic Field: Band now Moderate 07:36, PM2.5 9" (11_admin_scrolled.png). Moderate air as an alarm strip trains the principal to ignore the strip. Fix: banner only for priority 1 and 2 and for band Unhealthy and up; advisories go to the Alerts page and the decision card; auto-clear local alerts when the node returns to within 1.2x regional for 10 minutes.

**20. P1 · /m/status · Valid and invalid codes look identical for the first seconds.** Both showed "Looking up your report" with a Refresh button; the bad code error arrived only later and said "No report with code SN-ZZZZ. Check the letters: the alphabet has no zero, no letter O, no 1, no I" (m14_status_bad.png, m17_status_query.png). The input also silently drops a typed 0 ("Z0BN" became "ZBN"). Fix: validate the alphabet client-side and show "0 is not in the code alphabet; did you mean O?" inline; show a spinner state that names the code and times out to the error within 2 s.

### P2: polish

**21. P2 · / and /admin · Reading and band disagree.** Landing hero showed "8 PM2.5, 10 min" with a "Moderate" pill; Good is 0 to 9.0 by the table in spec 6.1 (01-landing.png). Fix: display the same value the band was computed from, or label both ("now 8, 10-min 12").

**22. P2 · banner (card fallback) · Text duplicated.** "All outdoor activity cancelled. All outdoor activity cancelled; consider dismissal per district policy" (n04_responder_390.png; `Banner.tsx` concatenates headline and guidance). Fix: show guidance only.

**23. P2 · /responder/incident trust panel · Raw enum and truncated mono.** "gym: PM2.5 259 (>55), LOCAL_SMOKE_SUSPECT open" and "4 other devices reported trapped at gym in 10…" in mono with ellipsis (32_incident_detail.png). Fix: human label ("smoke suspected at this node"), sans text, wrap instead of truncate.

**24. P2 · responder nav · "Tone off" toggles to "Tone on"; unclear whether it is state or action.** Fix: "Sound on / Sound off" with `aria-pressed` and a filled icon for the on state.

**25. P2 · /responder/incident · Merge is disabled with a tooltip that cannot show.** `title="Merge duplicates is not in the demo"` on a button with `disabled:pointer-events-none`. Fix: drop Merge from the demo build or render "Merge (not in demo)" as plain text.

**26. P2 · responder header · Name truncated.** "Lt. Marcus Reyes (SFD Battalio…" at 1440 (30_responder_queue.png). Fix: "Lt. Reyes · SFD B4" with the full string in a tooltip.

**27. P2 · /responder queue card · Dangling fragment.** "Gymnasium, received" on the left, "13:21:41 Open" on the right reads as an unfinished sentence; "Received civilian" in the timeline has the same problem. Fix: "Received 13:21:41 at Gymnasium" and "Received from an anonymous phone at gym".

**28. P2 · /responder viewed as admin · Six disabled buttons, no explanation.** Acknowledge, En route, Resolve, Flag as false, Merge, Draft WEA all greyed (x03_admin_incident.png). Fix: replace the actions panel with one line: "Read-only. Only a responder can acknowledge or resolve."

**29. P2 · /responder queue · Resolved incidents vanish.** After resolving SN-J37A the queue went to "1 open" with no way to see it again except the audit log. Fix: "Resolved today (n)" collapsed section under the open list.

**30. P2 · /responder/incident WHERE panel · Map crops the campus.** Labels cut off ("ic Field" at the bottom edge, p13_after_resolve.png). Fix: fit the mini-map to the site bounds with 24 px padding.

**31. P2 · /m/status and /m/staff · "No node picked" grey strip at the top.** A civilian checking a code sees a 44 px strip saying "No node picked" (m13_status_result.png). Fix: hide the band strip when no node is set on status and staff pages.

**32. P2 · /m/staff sign-in · Placeholder is the live demo code and the disabled Continue looks pressable.** Input placeholder "T-3B-7Q2", button a solid grey block (dr06_staff_login.png). Fix: placeholder "T-1A-2B3C"; disabled state as outline with 40% ink.

**33. P2 · /admin/drill missing list · Third column reads as the student's location.** "S-3B-04 · 3B · Athletic Field" implies the missing student is at the field. Fix: column header "Reported from" or "Class mustered at".

**34. P2 · /admin/drill tiles · No teacher name, not clickable.** The printable report knows "3A A. Okafor" but the grid says "3A waiting", so the principal cannot tell who to call (dr27_admin_missing.png). Fix: teacher name under the class code; click opens a class detail with submitted-at, muster point and the missing names.

**35. P2 · /admin/alerts · "PHONE (E.164)" label.** A principal does not know E.164; typing "206 555 0100" errors with "Use the international format, like +12065550123" (a10_add_recipient.png). Fix: accept any US format and normalise to +1 on save; label "Mobile number".

**36. P2 · /admin/alerts SMS outbox · 12 identical rows.** Same message repeated per recipient (a08_alerts_bottom.png); DESIGN_V2 says the outbox collapses to a count with a disclosure. Fix: one row per alert ("Fire at node, Campus South, 14:02, 12 recipients") with an expand.

**37. P2 · console at 390 px · Wordmark overlaps the nav and the page scrolls sideways.** "Sentinelverview", "Sentinelueue", `scrollWidth` 703 at width 390, time machine ticks "07:0009:00" overlap (n02_admin_390.png, n04_responder_390.png). Fix: below 768 px collapse the console nav into a menu and stack the rail under the map, or show "Open the console on a laptop; phones use /m".

**38. P2 · /hardware · Solar panel floats above the lid at explode 0.** Slider at 0, panel hovering with a visible gap (x04_hardware.png). Fix: seat the panel on the lid at factor 0 and lift it only as the factor increases.

**39. P2 · /m/responder · Node picker modal shown to the responder.** The field responder list opens behind "Which node are you next to?" (n05_m_responder.png). Fix: skip the picker on `/m/responder` and `/m/staff`; responders do not report from a node.

**40. P2 · /admin time machine · Sim controls leak into the product and there are two speed controls.** The map footer shows "Gym fire, 60x" as a product button, while the time machine tray has its own "1x / 10x" (10_admin.png, 11_admin_scrolled.png). A principal will ask what 60x means. Fix: move scenario selection into the time machine tray under a "Demo scenario" label, and keep one speed control.

## Notes on environment noise

Backend restarts during the run cleared the database twice (the report code SN-Z3BN stopped resolving; `/api/alerts` returned empty during an active fire). The 500 in item 3 coincided with one restart. The plateau-blindness in item 3 and the coin flip in item 1 were reproduced against the API independently of restarts.
