# Design review, 12 Sep 2026, 13:00 to 13:40 PDT

Lens: senior product designer, Linear / Vercel / Stripe bar. Adversarial. Every route below was loaded in an isolated headless Chromium (playwright-core 1.62) at 1440x900 and 390x844, screenshotted, and looked at. Screenshots live in the session scratchpad under `rv/`. The backend was restarted and the simulator was jumped by other agents several times during the run, so clocks and readings quoted here are whatever was on screen at the time; the layout and copy findings do not depend on sim state.

Verdict in one line: the palette and type are now right, the 3D node is genuinely good, but the product's signature object (the campus map) is broken on every page, the school console leaks warehouse data, and the console pages fall apart on a phone. Fix the four P0s before anything else.

Severity key: P0 blocks the pitch, P1 hurts judging, P2 polish.

---

## P0

### 1. P0 — every map — node dots no longer sit on their buildings
**Routes:** `/`, `/admin`, `/admin/nodes`, `/responder`, `/responder/incident/:code`, `/hardware` (campus mesh).
**What is wrong:** `shared/topology.json` was edited (uncommitted, 13:25) to move the eight school nodes to geography-derived coordinates (hub 750,155; library 550,150; science 825,300; cafeteria 650,200; arts 787,362; gym 845,137; field 432,327; parking 350,155). `CampusGround.tsx` (12:28) still draws the footprints at the old CONTRACT §1.2 coordinates. Result on screen: "Gymnasium" floats outside the dashed site boundary at top right, "Athletic Field" sits inside the Science Wing rectangle, "South Lot" is in the middle of campus, and the running track has no node in it. The mesh links now cross the map diagonally. Confirmed at 13:35 (responder), 13:36 (admin), 13:38 (nodes, landing hero).
**Why a judge cares:** "One node spiking while its neighbours are flat is a fire in that aisle" is the whole pitch. A map where the gym is off campus makes the spatial story unbelievable in the first five seconds, on stage and on the landing page.
**Fix:** Revert the eight `map_x`/`map_y` pairs to hub 500/120, library 300/200, science 700/210, cafeteria 480/330, arts 220/400, gym 760/400, field 520/560, parking 160/600 (the values in HEAD), restart the backend so the seed re-reads them, or, if the new positions are intended, redraw `CampusGround.tsx` to match. Add a unit test that asserts every node's `map_x`/`map_y` falls inside its footprint rect.

### 2. P0 — `/admin` — decision card shows a warehouse aisle on the school dashboard
**What is wrong:** The big reading's caption reads "PM2.5 µg/m³, 10-min at Aisle A / Rack 14" (1440 screenshot) and "10-min at Aisle A / Rack 01" (390 screenshot). Sampling the DOM every 2.5 s: seven samples said "Athletic Field", the eighth said "Aisle B / Rack 10". `dispatch.ts` applies every `decision_card` WebSocket event to `useSiteStore` without checking `site_id`, so the Harbor Island warehouse's card overwrites Roosevelt's.
**Why a judge cares:** Dr. Mo Zhou and the floor judges will read the number's caption. "Rack 14" on a high-school screen reads as a fake demo.
**Fix:** In `store/site.ts` `applyDecisionCard` (and `applyAlert`, `applyReading`, `applyNodeStatus`), early-return when `payload.site_id !== state.siteId`. Better: have the backend scope the `/live` socket to the tenant's sites.

### 3. P0 — `/admin` and console pages at 390px — header collides, page scrolls sideways
**What is wrong:** At 390px the wordmark overprints the first tab ("Sentine|verview"), the header's right group extends to x=695 (`DIV.ml-auto flex items-center gap-5 right=695`), and `scrollWidth` is 703 on every `/admin/*` and `/responder/*` route. Tables clip their last column ("Stat", "con"), the SMS outbox row is 400px tall with the message column off-screen, the air chart collapses to 90px with 4px axis labels, and the decision-log table wraps one word per line with the band pill cut to "Very u".
**Why a judge cares:** Crowd Favorite is an audience vote from phones. Anyone who taps "Open console" from the landing page on a phone gets this.
**Fix:** In `DesktopShell` header: hide school name and clock below `md`, collapse tabs into a horizontal scroll strip (`overflow-x-auto` with `-mx-6 px-6`), truncate the user name, and put `overflow-x-hidden` on the shell root. Wrap every `DataTable` in `overflow-x-auto`. Below `md`, stack the overview into a single column with the map first. Or, simpler for today: put a full-screen "Open on a laptop" interstitial on `/admin/*` and `/responder/*` below 768px and keep the phone app at `/m`.

### 4. P0 — `/m` node picker — school and warehouse nodes in one list, with the wrong labels
**What is wrong:** The "Which node are you next to?" sheet lists 14 rows: eight Roosevelt buildings followed by "Aisle A / Rack 01", "Aisle A / Rack 07", "Aisle A / Rack 14", "Aisle B / Rack 03", "Aisle B / Rack 10", "Dock Office (gateway)". No site heading, no divider. Every school row carries an amber dot and the word "Watch" (the band label for Sensitive), which reads as a verb ("watch this node") on a picker. The sheet cuts "Aisle A / Rack 01" in half at the fold.
**Why a judge cares:** This is step 4 of the stage demo and the Crowd Favorite flow. A judge standing at the table sees a warehouse rack in a school's list and stops trusting the "proximity proof".
**Fix:** Filter the picker to the site the phone is served by (in the demo, site 1 unless `?site=2`). If both must stay, group under two sentence-case headings ("Roosevelt High School", "Harbor Island DC-4"). Drop the band chip from the rows; show it only after picking, in the banner.

---

## P1

### 5. P1 — `/admin` alert banner — duplicated sentence and a clock the design removed
**What is wrong:** Banner text at 1440: "Cancel outdoor practice and recess. Cancel outdoor practice and recess; PE indoors" followed by "17:51" on the right. The headline and the guidance are concatenated even though the guidance already contains the headline. DESIGN_V2 §4 says: one line, no clock.
**Fix:** Render `guidance` only (it is a superset). Remove the clock span; the time machine already shows the sim clock.

### 6. P1 — every console page — three clocks that disagree
**What is wrong:** Header "13:02 PDT" (wall), banner "17:51" / "07:36:30" / "14:35:00" (sim, alert time), time machine "17:58" / "13:55" (sim, scrub position), queue cards "13:19:12" (wall, incident created), nodes "Last seen sim 07:50:00". On one 1440 screenshot of `/admin` the banner said 14:35:00, the time machine 13:55 with a "Live" dot, and the header 13:16 PDT.
**Why a judge cares:** Surbhi Jha (infra) will ask which clock is real. Mixed wall and sim clocks look like a bug even when they are not.
**Fix:** One clock: the sim clock, everywhere in the console, labelled once in the header as "Sim 14:35". Drop the wall clock from the header. Incident and audit timestamps should be stored and rendered in sim time, or the whole demo should run on wall time with the simulator following it.

### 7. P1 — every map — dotted and dashed strokes everywhere
**What is wrong:** The campus ground draws the site boundary with `strokeDasharray="4 8"`, walkways and the South Lot bays with `"1 3"`, and the mesh links are dashed (17 dashed SVG elements on `/` and `/responder`). At 1440 the boundary reads as a row of loose dots; at 390 it is a grey smear. The landing "How a report gets out" diagram also joins its five icons with dotted leaders.
**Why a judge cares:** The founder's own note: "random dots with gaps". It reads as a wireframe, not a product.
**Fix:** Boundary: solid `line-faint` 0.75px or no boundary at all (the panel edge is enough). Walkways: delete. Mesh links: solid `line` 0.75px, with the hop animation as the only moving element. Keep exactly one dashed stroke in the whole product: the hop dash, which is the signature.

### 8. P1 — `/admin` map — no building labels, while `/responder` has them
**What is wrong:** The admin overview map is eight coloured dots on faint rectangles with no names; the responder map, the landing map and the nodes map label every node. To know which dot is the gym on `/admin` you must cross-reference the right rail.
**Fix:** Same `NodeDot` label prop on all four maps, 11px sans `ink-3`, offset right of the dot, hidden below 480px.

### 9. P1 — `/admin/air` — y-axis and chart legend break the colour rules
**What is wrong:** The y-axis tick labels are coloured band thresholds ("225" purple, "125" red, "55" orange, "35" yellow, "9" green) plus dashed threshold lines across the plot. DESIGN_V2 §1: coloured text on canvas only in the pill and the map dot. All eight series lines are the same grey, so the gym spike is unnamed until the right-edge label; the node filter is a row of mono words ("all hub library science cafeteria arts gym field out parking out"), and the footer says "regional median dashed · hover for readings", the exact meta-string pattern DESIGN_V2 §2.9 deletes.
**Fix:** Ticks in `ink-3` mono, threshold lines solid `line-faint` with the band name once at the right edge in `ink-4`. Highlight the node in alert (gym) in `alarm`, others in `ink-4`. Filter chips in sans. Delete the footer line; put "µg/m³, 5-min steps" in the one signage label.

### 10. P1 — `/admin/air` decision log and banner — copy that contradicts the numbers
**What is wrong:** "Band improved to Unhealthy 14:33, PM2.5 122 at Athletic Field" directly above "Practice cancelled 13:55, PM2.5 80". Going from 80 to 122 is not an improvement. Same page: "Band now Moderate 07:36, PM2.5 9 at Athletic Field" next to "Band improved to Good 07:36, PM2.5 9 at South Lot": the same reading, two bands, because 9.4 rounds to 9 while the Good ceiling is 9.0. The site banner on five pages showed that stale 07:36 advisory while the log's latest entry was 14:51.
**Why a judge cares:** Dr. Mo Zhou teaches data science. "Improved to Unhealthy" and "9 is Moderate" are the first two things she will say out loud.
**Fix:** Verb from the band index delta: worsened / improved / unchanged; if the label is unchanged say "Still Unhealthy". Render PM2.5 with one decimal wherever a band threshold has one (9.4, 35.4, 55.4). Banner should show the newest open alert, not the oldest.

### 11. P1 — `/responder/incident/:code` — three stories about one node
**What is wrong:** Trust panel: "gym: PM2.5 258 (>55), LOCAL_FIRE open". Node-now strip on the same page: "Gymnasium PM2.5 3 ... Local smoke suspected since 14:35:00". Header banner: "Local smoke suspected at Gymnasium: PM2.5 rose 184 ... neighbours sit at 80". 258, 3 and 184 on one screen.
**Fix:** Stamp the trust breakdown with "at 13:19:12" so it reads as history, and put the live reading first. Or recompute the sensor layer live and show the delta.

### 12. P1 — `/admin/alerts` — twelve identical SMS rows
**What is wrong:** The outbox lists 12 rows of the same two-line message ("SENTINEL ALERT (Roosevelt High School, Campus South): FIRE detected at Gymnasium 14:20. Evacuate Campus South to muster points. Do not re-enter. Reply STOP to opt out.") each with "queued (demo)". 1,100px of repeated text. DESIGN_V2 says the outbox collapses to a count with a disclosure.
**Fix:** Group by alert: one row "Fire at Gymnasium, Campus South, 12 phones, 14:20" with the message once underneath and a disclosure for recipients.

### 13. P1 — `/admin/alerts` — six signage labels in one panel, unbalanced grid
**What is wrong:** The thresholds panel has "THRESHOLDS" plus five uppercase tracked field labels ("PM2.5 RISE IN 2 MIN", "TEMPERATURE RISE (°C IN 2 MIN)"...) and helper text like "Fire branch, µg/m³. 5 to 200." Next to it the Open alerts panel is 100px tall, leaving 360px of empty canvas. 12 uppercase elements on the page against a rule of one per panel.
**Fix:** Field labels in 13px sentence-case `ink-2` ("PM2.5 rise in 2 min"). Move Open alerts above Thresholds full width, or make the thresholds a two-column form under a single signage label with the recipients panel beside it.

### 14. P1 — `/admin/drill` — six 130px tiles in a 1,080px column, 600px empty
**What is wrong:** During a running drill the roll-call grid is six small tiles ("3A waiting") hugging the top-left with the rest of the viewport blank. Export report and CSV float as unlabelled ghost links under the right rail.
**Why a judge cares:** Jonathan Briggs is the buyer and this is the page he uses monthly.
**Fix:** `grid-cols-3` at 1440, tiles at least 200px wide with class, teacher, roster count and present count; the muster point and missing list under the grid, not in a rail. Export as a single ghost button "Export" with a menu.

### 15. P1 — `/m/staff` roll call — student IDs instead of names
**What is wrong:** "Missing (tap names)" is followed by 30 mono chips "S-3B-01" to "S-3B-30". The muster-point helper says "In production the node stamps this automatically; pick the node you are standing next to", copied from the node picker.
**Fix:** Seed 30 plausible names in `seed.py` (first name plus initial). Helper: "Where is your class gathered?". Chips in sans.

### 16. P1 — `/hardware` — the schematic is the neon the palette was built to remove
**What is wrong:** The block schematic wires are saturated cyan (`#22D3EE`-class), orange and green on canvas. It is the only place in the product with that cyan, and it is a 1,600px-wide element. The BOM and schematic together put 142 mono text nodes and 123 bordered elements on one page.
**Fix:** Recolour nets to the palette: power `warn`, data `signal`, ground `ink-3`; block outlines `line-strong`. Block titles in sans 13px, pin names mono 11px.

### 17. P1 — `/hardware` campus mesh — overlapping mono labels on a blueprint
**What is wrong:** Node labels are mono 13px and overlap ("Main Hall (office gateway)" over "Gymnasium"); each carries a second mono line "no reading". The scene fills the top third of a 700px panel; the rest is black. The dashed blueprint rectangles look like a game-engine debug view, which the 3D spec explicitly forbids.
**Fix:** Sans labels with collision offset (sort by screen y, push apart 14px). Drop "no reading" (use a dim pillar instead). Camera fov 24 and target at the campus centre so the scene fills the panel. Solid `line-faint` footprints.

### 18. P1 — landing `/` — "How a report gets out" still has the numbered chips and a second numbered diagram
**What is wrong:** Four steps with grey numerals 1 to 4 on the left; on the right a diagram with its own numerals 1 to 4 above five hand-drawn icons (phone, arcs, dots, rectangle, grid) joined by dotted leaders. Step headings hard-wrap mid-phrase ("The report hops box to / box over 915 MHz radio."). DESIGN_V2 §4: one column of three paragraphs, no numbered chips.
**Fix:** Delete the numerals and the forced `<br>`s. Keep the diagram but remove its numbers and the dotted leaders (solid `line` 1px), and align it to the section top, not the vertical centre.

### 19. P1 — landing `/` — two different "open console" buttons on one screen
**What is wrong:** Nav: outlined "Open console". Hero: bone "Open the console" plus ghost "See the hardware". Two primary-looking CTAs 260px apart with different copy.
**Fix:** Nav button becomes a text link "Console"; hero keeps the single bone button. Match the label: "Open the console" in both if the nav keeps a button.

### 20. P1 — all console pages — coloured text on canvas
**What is wrong:** `/admin/nodes` Status column: "Online" in `ok` green eight times. `/responder` queue: "received" and "acknowledged" in green. `/responder/incident`: "Local smoke suspected since 14:35:00" in `warn`. `/admin` header: "LIVE" in teal. `/m`: "Pick the node next to you" and "Change node" links in teal.
**Fix:** Text in `ink` or `ink-2`; state carried by a 6px dot before it. Teal stays for the live dot only.

---

## P2

### 21. P2 — landing `/` — honesty footer is unreadable
**What is wrong:** Three lines of 15px `ink-4` (#45413C) on canvas (#0B0A09): about 1.9:1 contrast. "Hardware designed, not fabricated, per organizer guidance. In this demo the sensors are 8 virtual nodes..." cannot be read on a projector.
**Fix:** `ink-3` at 13px, one sentence: "Simulated: 8 virtual nodes, local UDP mesh, SMS disabled. Schematic and BOM in the submission."

### 22. P2 — landing `/` — pricing "Per seat" breaks the numeric rhythm
**What is wrong:** "$12" and "$25" at 56px next to "Per seat" at the same size in words. The three columns also have three lengths of body copy (4, 3 and 3 lines).
**Fix:** "$0" with the caption "per seat, responder console, free during a declared emergency", or drop the third column into a sentence under the two figures.

### 23. P2 — landing hero — count-up desyncs the number from the pill
**What is wrong:** `useCountUp` tweens the reading over 600ms while the band pill flips instantly, so on every band change the card shows "23" with "Unhealthy" for half a second (screenshot at 390).
**Fix:** Snap the number (delete `useCountUp`) or delay the pill by the same 600ms.

### 24. P2 — landing hero — one log line instead of two, 220px gap
**What is wrong:** At 1440 the right column shows the reading, headline, pill, then 220px of nothing, then a single line "15:09:30 telemetry 8 of 8 nodes". DESIGN_V2 §4 says "last two log lines".
**Fix:** `feedAt(t).slice(-2)`, and pin the log to the bottom with `mt-auto` so the gap is intentional.

### 25. P2 — `/login` — two uppercase field labels, one focus ring on load
**What is wrong:** "EMAIL" and "PASSWORD" are tracked uppercase (two signage labels in one form); the email field renders with the bone focus ring before any interaction. The landing nav focus ring is `ink-2` grey while every other focus ring is bone.
**Fix:** Sentence-case labels in `ink-2`. Autofocus the password (the email is prefilled). Use the bone ring in `LandingBar`.

### 26. P2 — `/responder/audit` — dev artefacts in the table
**What is wrong:** IP column is "127.0.0.1" on every row; panel title "EVERY ACTION, WITH ACTOR AND IP" is a sentence set as signage; "FILTER" signage next to an unstyled native `<select>`; notes mix "trapped ×2 via node gym" (lowercase) with "Delivered to hub via 2 hops" (capitalised); a manual "Refresh" button on a live page.
**Fix:** Hide the IP column when every value is loopback (or show "local"). Title "Audit log" only. Style the select as a `Segmented` (All / Received / Relayed / Acknowledged / Resolved). Sentence-case all notes. Remove Refresh; the socket already updates it.

### 27. P2 — `/responder/incident/:code` — code cells have borders, two check icons
**What is wrong:** "S N - 5 E T 6" is six bordered boxes (DESIGN_V2: bigger cells, no borders). "Acknowledge" and "Resolve" both use the check icon; "En route" uses the send/plane icon that also means "Send" on the message field 200px below.
**Fix:** `CodeCells` with `bg-raised` and no border, 44px cells. Icons: Acknowledge = `eye`, En route = `navigation`, Resolve = `check`, Send = `arrow-up`.

### 28. P2 — `/responder/incident/:code` — the "Where" map is a cropped corner
**What is wrong:** The panel shows a 2x zoom of the campus with a building cut at the top, the track cut at the bottom, and a 7px "Cafeteria" label. Left column ends at 630px while the right column runs to 1,340px.
**Fix:** Show the whole campus at panel width with the incident node ringed; move Timeline and the message box under the code panel and let the right column hold Actions and Trust only.

### 29. P2 — `/responder/incident/:code` not found — heading claims a report that does not exist
**What is wrong:** Desktop: "SN-KDTV" as a 32px mono heading, then red "No incident with code SN-KDTV. Check the four characters after SN." plus both "← Queue" and "Back to the queue". Phone `/m/status?code=SN-TEST`: "Your report / SN–TEST" then "No report with code SN-TEST..." and a "Refresh" button. Three different alphabet explanations across the product ("No zero, no letter O", "no zero, no letter O, no 1, no I", "Check the four characters after SN").
**Fix:** Heading "No report SN-TEST", body in `ink-2`, one link back, and one shared alphabet sentence from `lib/codes.ts`.

### 30. P2 — `/m/report` — primary action below the fold, stray resize grip
**What is wrong:** At 390x844 "Send report" sits at y≈1,000; the six 88px tiles, the stepper, the textarea and the checkbox push it off screen. The textarea shows the browser resize grip in the bottom-right corner (a small stray mark in the screenshot). The stepper's "−" and "+" have no visible label text (they have aria-labels, fine) but the "−" is disabled at 1 with 40% opacity next to a bright "+", which reads as broken.
**Fix:** Tiles 72px, textarea 2 rows with `resize-none`, and make "Send report" sticky at the bottom (`position: sticky; bottom: 0` with a canvas fade).

### 31. P2 — `/m` code screen — "Copy code" is the primary action
**What is wrong:** After "Report received" the bone-equivalent primary is "Copy code", with "Check status" secondary. The page says "Write it on your hand."
**Fix:** Primary "Check status", secondary "Copy code", or no copy button at all.

### 32. P2 — `/m/staff` — disabled primary looks broken
**What is wrong:** "Continue" renders grey at 40% before typing, with the placeholder showing the real demo code "T-3B-7Q2", so the screen looks like a dead button beside a filled field. No "Back" link here while `/m/report` and `/m/responder` have one.
**Fix:** Keep the button enabled and validate on submit; placeholder "T-1A-2B3"; add the Back link.

### 33. P2 — `/admin/nodes` — mono for words, "sim" prefix, empty right column
**What is wrong:** Floor column mixes "1", "2" and mono "outdoor"; Last seen reads "sim 07:50:30" on every row; Firmware "0.9.2-sim". Provisioning panel is 150px tall next to a 620px map and ends with "Adding nodes from this page is not part of the demo."
**Fix:** Floor: "Outdoor" in sans `ink-3`. Last seen: "07:50:30" only (the footer already says simulated). Provisioning panel: stretch to the map height and show the selected node's record by default (hub).

### 34. P2 — `/admin/air` — "3 h" segment selected, 40 minutes plotted
**What is wrong:** Range control says 1 h / 3 h / 8 h with 3 h active; the x-axis runs 14:00 to 14:50 (or 17:30 to 17:55 on an earlier capture). The gym line exits the top of the plot with no tick above 225.
**Fix:** Pad the domain to the selected range even when data is short, and add a top tick at the rounded max.

### 35. P2 — `/admin` — Air / Mesh toggle row holds three unrelated things
**What is wrong:** Under the map: ghost pair "Air | Mesh", then the street address "1410 NE 66th St, Seattle, WA 98115", then a pause icon with "clearing, 60x" and a chevron, all in one row. The time machine below has its own "TIME MACHINE" signage, "Live" dot, clock, play, 1x/10x and another chevron. Two rows of controls for one map.
**Fix:** Merge into one control row: Air | Mesh on the left, play/pause, speed and the sim clock on the right. Address goes to the nodes page.

### 36. P2 — `/hardware` — headline breaks into six lines, part label floats over the canvas
**What is wrong:** "Thirteen / parts. / Thirty-one / dollars. / No internet / required." at 1440 because the left column is 250px; DESIGN_V2 says four lines. When the pinned section scrolls out, a mono "$0.10 at 1k" from the last hovered part sticks at the top-left over the fading 3D view. The 3D canvas is a black rectangle for 6 to 12 s on a phone with no poster or skeleton.
**Fix:** Column 340px so each sentence holds a line. Unmount the part label when the section leaves the viewport. Render a static PNG poster under the canvas until the first frame.

### 37. P2 — `/hardware` — nav and landing nav disagree
**What is wrong:** Landing nav: "How it works · Hardware · Business · Open console". Hardware nav: "Home · Admin · Responder". Two public pages, two navigation models.
**Fix:** One `PublicBar` with "Home, Hardware, Console".

### 38. P2 — `/responder` queue — "Open" label only on the selected card
**What is wrong:** The first card shows "13:19:12  Open" while cards two and three show only the time. Status of the other two is unknown at a glance. Queue cards also use wall-clock seconds (13:19:12) while everything else uses the sim clock (see 6).
**Fix:** Same status word on every card, or none (the queue is by definition open).

### 39. P2 — `DesktopShell` — logout button has no accessible name
**What is wrong:** Tabbing through the header lands on `BUTTON ""` (the log-out icon) with no `aria-label`.
**Fix:** `aria-label="Sign out"` and a tooltip.

### 40. P2 — `/nope` 404 — signage box for a one-line message
**What is wrong:** "404" mono eyebrow, "Page not found" at 40px, then a `surface` panel with the signage "NOTHING HERE" and "That address does not exist. Back to Sentinel", all pinned to the top of a 720px column.
**Fix:** Centre vertically, no panel, no eyebrow: heading plus one link.

---

## Accent count (bone `#D9CFC0`) at 1440, per screen

`/`: hero button fill (1). `/login`: submit fill, email focus ring (2). `/admin`: none visible until a row is selected (selection bar). `/admin/alerts`: Save thresholds fill (1). `/admin/drill`: Close drill fill (1). `/admin/nodes`: selected-row bar (1). `/responder`: selected-card bar (1). `/hardware`: explode slider thumb and track (1). Focus rings on all links and buttons are bone. This is within "sparingly". Signal teal is over budget only on `/admin/drill` (three teal text nodes) and `/m` (two teal links).

## What is already good

The type scale (Archivo 480 to 540 display, Plex 15/17 body, 11px signage) is consistent across every console page. Panels have no borders and no header rules. The 3D node in the hero and exploded view is lit like a product photo and the calm vertical explode on scroll is the best moment in the product. The phone report and code screens are clear at arm's length. Focus rings exist and are the right colour. Table row hover is `raised` with a pointer.
