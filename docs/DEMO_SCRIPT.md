# Demo script

Four minutes on stage. One laptop, one projector, two Xenons on the table. The stage version is the `/demo` war room playing itself; you talk over it, press one physical button, and finish on the exploded node.

## Before you go up (do this five minutes early, not one)

1. Open https://sentinel-seattle.vercel.app in the browser you will present from. The backend sleeps on Render after 15 idle minutes and takes about 50 seconds to wake; the landing page's live counters tell you when it is back. Do this before you are called, never on stage.
2. Log in at `/login` as `admin@sentinel.demo` / `sentinel`. Open `/demo`. Press F for fullscreen. Set speed to 2x. Do not press Play yet; the page sits on chapter 1 with the map calm.
3. Press R once so the director resets to calm and clears any rows a previous run left behind.
4. Plug both Xenons into the laptop. Xenon A blinks blue every 5 s, Xenon B blinks green when it hears A. In a terminal: `make bridge`. Wait for the line that says it is posting readings. Open `/hardware` in a second tab and confirm the live panel shows Xenon A with a fresh reading.
5. Slides open in a third tab or a second window, three slides only.
6. Back to the `/demo` tab. That is the one on the projector when your name is called.

Local fallback if the venue network is bad: `make clean && make seed && make dev`, then the same steps at http://localhost:5173. The bridge posts to `:8000` by default.

## The four minutes

| t | On screen | Say |
|---|---|---|
| 0:00 | Slide 1: the box on a wall, price, one line. | "Disaster hardware fails because it sits unused. This box earns its wall every month: it decides whether practice goes outside in smoke season and it runs the fire drill Washington requires. Then, on the bad day, it is already there." |
| 0:20 | Slide 2: the algorithm, one sentence. | "The whole algorithm fits on this slide. One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky." |
| 0:40 | Slide 3: what is real today. Campus from OpenStreetMap, two boards on the table, rules decide, model advises. | "Everything you are about to see runs on the public site. The campus is Roosevelt High, from OpenStreetMap. Two real boards are on this table. The alerts are decided by rules you can read; a small model sits beside them and says when it disagrees." |
| 1:00 | Switch to `/demo`. Press Play. Chapter 1, calm. | "07:30. Eight nodes, all green, practice is on. Every emergency app assumes the internet exists. Sentinel doesn't." |
| 1:10 | Chapter 2, smoke. Dots go orange together, card flips to "Cancel outdoor practice". | "Smoke afternoon. Every node climbs together. That's the sky, not the building, so the card cancels practice and nothing else happens." |
| 1:25 | Chapter 3, fire. Gym alone goes alarm red, hop dash gym to science to hub, `LOCAL_FIRE` in the decision panel. | "One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky. That's the whole algorithm." Pause until the hop reaches the hub. |
| 1:45 | Chapter 4, report. Incident card appears: Trapped, 2, "Gym storage room, door jammed", Verified. Beside the phone mock, the triage card shows the reporter's words in quotes with type, count and urgency, and a basis line saying whether Gemini or the keyword rules read it. | "Only a phone standing next to the box can open a verified report. This one is standing next to the gym node, and the gym's own sensors agree with it. The model read the text and agrees; it did not decide anything. Only a responder can close it." |
| 2:05 | Chapter 5, responder. Timeline fills: acknowledged, en route with a note, resolved "Crew 3 walked both out". The situation brief under the header rewrites itself from the stored rows. | "Acknowledged, en route, resolved with a note. Every action is in the audit log with an IP. The reporter's phone flipped to Resolved on its own." Press space to pause here. Chapters 6 and 7 exist if a judge asks about drills; you do not run them on stage. |
| 2:30 | Pick up Xenon A. Press MODE once. Toast on screen; a hop travels `xenon-a -> xenon-b -> hub` on the live map. | "Turn off the WiFi. Do it again." Hold the board up. "This is not the simulator. Same 24-byte message our nodes will send over LoRa, over Bluetooth for today, relayed by the second board, on the map." |
| 2:50 | Switch to `/hardware`. Drag explode to 1. Point at the live panel with A's last reading and B's relay. | "Thirty-one dollars a node at a thousand units. Schematic, BOM, power budget and firmware are in the repo. The ESP32 node is designed, not fabricated; these two are the radio layer standing in for it." |
| 3:10 | Stay on `/hardware`, explode back to 0. | "Rules decide. Humans resolve. The model advises and is honest about being trained on a simulated day. Sentinel drafts the emergency alert; your agency sends it. Thank you." |
| 3:25 | Done. Leave the war room up for questions. | Questions. Keep `/demo` paused on chapter 5; the map still shows the fire, the incident and the audit trail, which is what most questions point at. |

Thirty-five seconds of slack. Spend it on the pause after the hop reaches the hub, not on talking faster.

## If a judge wants more

- Drills: press right arrow twice. Chapter 6 musters six classes; 3B comes in `28 / 30` with two named missing. "A sentinel that only wakes up for the disaster is asleep when it matters."
- All clear: chapter 7. Overrides decay and the engine closes the fire alert itself. "Nothing here needed the internet."
- The model: `/admin`, click the gym dot. The explain drawer shows the rule that fired with live numbers and, under it, the Second Opinion panel with the model's class probabilities, whether it agrees with the open rule branch, and the drift note. `GET /api/ml/model-card` on the backend URL shows the training metadata and the confusion matrix.
- Gemini: the triage card in chapter 4 and the situation brief on `/demo` are the two live surfaces. Both carry a `basis` line; with the key set it names the model, without it it says `fallback: keyword rules`. `POST /api/ai/triage` with a sentence in Spanish or Hindi returns the detected language and an English summary quoting the original; the phone report page does not call it yet.

## Failure playbook

1. **Render is asleep.** Symptom: the landing page counters stay blank, `/demo` says loading, or the login spins. Cause: nobody hit the API for 15 minutes. Fix: open the site five minutes before you are called. On stage, if it happens anyway, present slides 1 to 3 slowly and press Play when the header shows LIVE; the wake takes about 50 seconds. Never refresh repeatedly; each hit resets nothing and the container still needs its boot time.
2. **Gemini is down or rate-limited.** Nothing on stage depends on it. The triage and brief endpoints fall back to keyword rules within 8 seconds and label the result `fallback: keyword rules` with a reason. If a judge asks, point at the label: "The product does the same thing without the model; it just says so."
3. **Bridge is not running.** Symptom: MODE press does nothing on the map, `/hardware` live panel says none yet. Fix in a spare terminal: `make bridge` (or `make bridge PORT=/dev/tty.usbmodem1401`). It auto-detects the gateway port and reconnects every 2 s. If the board is blinking magenta, it is in safe mode; skip the button beat and say "the hop you saw in chapter 3 is the same path".
4. **Bridge says duplicate ts (sim paused?).** The director is paused, so the sim clock is not moving and readings collide on `(node_id, ts)`. Press space to resume, or `jump calm` from `/admin`. The button hop still posts.
5. **A chapter reports a wait timed out.** The director shows what it saw and moves on; the map holds the last state. Press left then right arrow to re-run the chapter; chapters are idempotent.
6. **WebSocket stuck** (LIVE pill stays on RECONNECTING, dots frozen): reload the tab. The page rehydrates from one overview call. You stay logged in.
7. **Card did not flip after the smoke chapter:** the 10-minute rolling average lags. Wait three seconds; if still calm, left then right arrow.
8. **Fire did not open in chapter 3:** the gym had less than five sim minutes of history. Re-run the chapter; it waits for history before lighting.
9. **Total loss:** play the 60-second backup video from the desktop and narrate it with the table above.

## Which judge gets which line

| Judge | Lead with | Line |
|---|---|---|
| Amazon (Aayush Shah, Rishi Cheruku) | The neighbour-median test and where the model sits relative to it. | "Rules decide, the model advises. Here is the disagreement log it would take to change that." |
| NVIDIA (Surbhi Jha) | Same container on a Pi at the site or in the cloud; ingest idempotent on `(node_id, ts)`; the model is numpy, no GPU, under a millisecond. | "Node alone, node plus a Pi, or cloud. Three tiers, same code." |
| Eastside Prep CTIO (Jonathan Briggs) | He is the buyer. Price per building, the drill grid replacing clipboards. Run chapter 6. | "A sentinel that only wakes up for the disaster is asleep when it matters." |
| Eastside Prep data science (Dr. Mo Zhou) | The model card, the confusion matrix, why the labels come from the scenario and not the rules. | "It is not a copy of the rules, and it is not trained on real fires. Both are on the card." |
| Floor judges from Seattle tech and VC | Warehouse loss prevention is the revenue story; schools are distribution. | "You can't fake standing next to the box." |
| Anyone who raises Dryad or Meshtastic | Name them first. | "They put the intelligence in each sensor. We put it between the sensors, because in a schoolyard the sky itself is the false alarm." |
| Anyone with public-sector experience | The WEA draft modal on an incident. | "Sentinel drafts the alert. Your agency sends it." |
