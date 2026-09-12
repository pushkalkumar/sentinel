# Sentinel: Prior Art, Novelty Claims, and Three Add-On Features

Written 2026-09-12, ~10:40 AM PDT, for the Frontier Cascadia build. Read `spec.md` first. Product name is **Sentinel**; the device is the **Sentinel Node**; incident codes are `SN-XXXX` (example: `SN-7K3F`). Any older "Cascadia Node" wording in the spec should be read as Sentinel Node.

This document does three things:

1. Lists what already exists, what each system does well, and the specific gap Sentinel fills. Judges will have seen some of these; we should name them before they do.
2. States Sentinel's novelty claims precisely, with honest labels (what is new, what is a new combination, what is borrowed).
3. Specs three software-only features, each buildable by one agent in under 90 minutes, plus the pitch and lines that land.

Labels used throughout: **[fact]** verified against a cited source today; **[inference]** our reading of the sources; **[claim]** what we assert about Sentinel.

---

## 1. Prior art

### 1.1 Meshtastic (open-source LoRa mesh)

**What it does.** [fact] Open-source firmware for $20 to $60 ESP32/nRF52 LoRa boards. Text messaging, GPS position sharing, and a telemetry module that reads 30+ I2C sensors including BME280 and the PMSA003I particulate sensor, broadcast at a default interval of 1800 seconds. Flooding mesh with rebroadcast; AES channel encryption with a pre-shared key.

**What it lacks.** [fact] The telemetry docs contain no threshold alerts, no anomaly detection, and no cross-node correlation; the module "functions as a passive data collection and broadcast system". [fact] Its channel encryption "does not include authentication, allowing anyone with the PSK to send a message as any other user", and a known-plaintext replay lets an attacker forge messages without the PSK (firmware issue #4030). [fact] Requires a companion app and a paired radio; there is no captive-portal web page a stranger's phone can open. [inference] Meshtastic is a transport. It has no roles, no trust score, no responder-only resolution, no drill mode, and no alert engine.

**Sentinel's position.** Same radio family, same flooding-with-dedup design (we say so in the spec). Sentinel adds the application layer Meshtastic explicitly does not have: an alert engine, verified inbound reporting, and a web portal served by the node to any phone.

Sources: https://meshtastic.org/docs/introduction/ · https://meshtastic.org/docs/configuration/module/telemetry/ · https://meshtastic.org/docs/about/overview/encryption/limitations/ · https://github.com/meshtastic/firmware/issues/4030

### 1.2 PurpleAir and AirGradient (low-cost PM2.5 sensor networks)

**What they do.** [fact] Both use Plantower optical particle counters. PurpleAir's PA-II has two laser channels (A and B) and publishes a 0 to 100 "confidence score" measuring agreement between the two channels; disagreement flags a fan failure, insects, or dust. [fact] Montana DEQ's "PurpleAirs in Schools" program has installed hundreds of sensors at high schools so athletic directors get "real data instead of guesswork" on smoke days. [fact] EPA applies a wildfire-smoke correction to PurpleAir data for the AirNow Fire and Smoke Map.

**What they lack.** [fact] Both are cloud-dependent; readings go to a vendor map over the building's WiFi. [inference] Neither compares a sensor to its physical neighbours to classify an event; PurpleAir's confidence score is intra-device (two lasers in one box), not inter-device. Neither has heat or combustible-gas channels, so neither can tell "smoke from the sky" from "smoke from this room". Neither accepts inbound human reports, has roles, or runs drills. Neither serves anything when the internet is down.

**Sentinel's position.** Sentinel uses the same class of PM sensor and the same EPA breakpoints. The neighbour-median check is the piece PurpleAir does not do, and the school use case (Montana's program) proves the buyer exists.

Sources: https://community.purpleair.com/t/what-are-channel-a-and-channel-b/3643 · https://community.purpleair.com/t/the-confidence-score/5193 · https://www2.purpleair.com/blogs/blog-home/how-montana-schools-are-using-purpleair-sensors-to-protect-communities-from-wildfire-smoke · https://www.airgradient.com/blog/epa-correction-and-airgradient/ · https://www.epa.gov/sciencematters/epa-research-improves-air-quality-information-public-airnow-fire-and-smoke-map

### 1.3 Watch Duty (wildfire and flood alert app)

**What it does.** [fact] "Human Powered. Zero Noise." About 300 volunteer reporters (retired dispatchers, firefighters, scanner listeners) monitor radio scanners, cameras, satellites, and official announcements 24/7 and push verified incident updates to millions of users in five languages.

**What it lacks.** [fact] Its own overview says it is "real people, not machines or crowdsourcing"; the public does not submit reports that appear on the map. [fact] No mention of offline operation or sensors. [inference] Watch Duty is one-directional and regional. It tells you the hill is on fire; it cannot tell you which aisle, and it cannot take "I'm trapped" from the person standing next to the fire.

**Sentinel's position.** Different layer. Watch Duty is the regional picture; Sentinel is the building and the block. Both want the same thing: verified information. Watch Duty verifies with humans; Sentinel verifies with physics (proximity plus sensor corroboration) so it works with zero staff at 3 AM.

Sources: https://www.watchduty.org/how-it-works/overview · https://www.watchduty.org/get-involved/volunteer

### 1.4 Genasys Protect and Everbridge (mass notification and evacuation zones)

**What they do.** [fact] Pre-defined evacuation zones with catalogued population, vehicle, and structure counts; one-click or API-triggered alerts over SMS, voice, cell broadcast, IPAWS/WEA, sirens (Genasys acoustic devices), social, and signage. [fact] Genasys can "connect facility sensors to send targeted alerts automatically when dangerous readings are detected." Counties preload zones into Everbridge for faster notification.

**What they lack.** [inference] These are outbound government and enterprise platforms priced for counties, not a $30-per-node school budget. They assume the cell network and the cloud are up; the whole delivery path is carrier-dependent. There is no inbound "I need help" channel with proximity proof, no local-only mode when the uplink dies, and no everyday use (they sit idle between incidents, which is the exact failure mode Sentinel's dual-use design targets).

**Sentinel's position.** Sentinel does not replace Genasys. Its WEA draft feature (Section 3.3) is explicitly a handoff to a Genasys-class tool that an agency already has. Sentinel is what happens below that layer, on the site, with or without a network.

Sources: https://genasys.com/genasys-protect/communication-zones/ · https://genasys.com/protect-platform/ · https://www.themountainmail.com/news/commissioners-hears-update-on-new-evacuation-tool/article_188cd07f-5736-47ec-ac06-1ab8d97adf10.html

### 1.5 Zello (push-to-talk app)

**What it does.** [fact] Walkie-talkie app that went mainstream when the Cajun Navy used it during Hurricane Harvey; uses a fraction of a voice call's bandwidth so it can get through congested networks.

**What it lacks.** [fact] "Zello does not work without cellular data service or an internet connection on your phone." NBC ran a live-blog correction during Hurricane Ida because so many people assumed otherwise. [inference] No location verification, no roles, no sensors.

**Sentinel's position.** Zello is the clearest proof of the spec's problem 1.3: every popular emergency app assumes a backbone. Sentinel's demo step 5 ("turn off the WiFi, do it again") is the direct answer.

Sources: https://www.nbcnews.com/news/us-news/live-blog/hurricane-ida-live-updates-n1277879/ncrd1277900 · https://blog.zello.com/how-to-use-zello-during-an-emergency · https://asprtracie.hhs.gov/technical-resources/resource/12507/6-key-ways-zello-helps-first-responders

### 1.6 goTenna Mesh (consumer off-grid mesh, discontinued)

**What it did.** [fact] Paired a phone over Bluetooth to a pocket radio for off-grid texting and location sharing between goTenna users.

**What happened.** [fact] In 2024 goTenna discontinued the entire consumer line (v1 and Mesh) while working with CISA on vulnerabilities in the Pro line; vulnerabilities in the consumer devices had been reported in 2017 and 2018 and were not fixed. goTenna now sells only tactical devices and was acquired by Forterra in October 2025.

**What it lacked.** [inference] Both ends needed a goTenna. A stranger without one could not join. No sensors, no roles, no fixed infrastructure, and a business model that never found a reason for the device to be used on a normal day.

**Sentinel's position.** goTenna is the cautionary tale for the "earns its wall" argument: disaster hardware that sits unused gets abandoned by its own maker. Sentinel's node is the fixed infrastructure; the phone needs nothing installed.

Sources: https://nelos.app/guides/what-happened-to-gotenna-mesh/ · https://thelastmile.gotennapro.com/gotennas-transition-from-consumer-to-tactical-grade-mesh-networking-devices/

### 1.7 Seattle Emergency Communication Hubs

**What they do.** [fact] About 150 pre-determined neighbourhood gathering places in Seattle whose purpose is to "stand up when all communications is down". Volunteers collect and relay information on local needs and resources between hubs, the city's Auxiliary Communications Service (ACS, 150+ ham operators), and other locations. Ham radio reaches government; GMRS links hub to hub.

**What they lack.** [fact] Tools listed on the hubs site are message boards, pocket boards, whiteboards, radio, and "Hub-in-a-Box" containers with forms and how-to manuals. The only software mentioned is an independent NeighborLink map for pre-event connection. [inference] There is no software layer for the day of the event: no structured intake at the table, no de-duplication, no way for a resident to check the status of a request, and no way for a responder to close one.

**Sentinel's position.** This is the PNW Impact story. A Sentinel Node on the hub table is the whiteboard that survives rain, dedupes itself, and hands each person a code. The hub's ham operator is still the uplink; Sentinel just structures what they read out.

Sources: https://seattleemergencyhubs.org/ · https://seattleemergencyhubs.org/blog/ham-radio-operators-essential-communications-when-all-else-fails/ · https://www.seattleacs.org/about

### 1.8 FEMA IPAWS and Wireless Emergency Alerts

**What it does.** [fact] WEA broadcasts short messages from cell towers to every WEA-capable phone in a targeted polygon (100 vertex limit, with limited overshoot since December 2019). Messages carry a required 90-character text and an optional 360-character text; the 360 field is not a continuation of the 90.

**Who can send.** [fact] Only authorised federal, state, local, tribal, and territorial alerting authorities. Becoming one requires the IS-247 course, a state-reviewer-signed application, monthly tests with the IPAWS Lab, and written security procedures against accidental sends.

**What it lacks for Sentinel's users.** [inference] A school, a warehouse, or a neighbourhood hub can never be an alerting authority. WEA is also outbound only, needs the tower up, and carries no site-level detail.

**Sentinel's position.** Sentinel does not pretend to do WEA. It (a) runs its own opt-in SMS registry per zone, (b) alerts every phone on the node's own WiFi with no network at all, and (c) drafts a CAP-shaped WEA message for a logged-in agency to issue through their own authority. That honesty is worth saying out loud to the judges.

Sources: https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/alerting-authorities · https://www.fema.gov/sites/default/files/documents/fema_ipaws-guide-constructing-wea-eas-messages_1.pdf · https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/faqs

### 1.9 NFPA 72 aspirating smoke detection (VESDA, Honeywell FAAST)

**What it does.** [fact] NFPA 72 §17.7 permits very early warning smoke detection via air-sampling systems for high-ceiling spaces where stratification defeats spot detectors. VESDA-E samples air through pipe networks continuously and detects combustion products at concentrations roughly 100x below conventional thresholds. Honeywell FAAST XS/XT connect to the fire alarm control panel over an addressable loop; FAAST XM covers up to about 8,000 sq ft per unit.

**What it lacks.** [inference] Aspirating systems are excellent at "something is burning somewhere in this sampling zone" and poor at "where". A pipe run covers thousands of square feet and reports as one detector address. Systems cost tens of thousands installed and talk to the fire panel, not to warehouse staff's phones. They have no outdoor or wildfire-smoke role and no inbound human channel.

**Sentinel's position.** Sentinel is a supplement, not a replacement (the spec says this explicitly, and we must keep saying it). Its contribution is localisation and trend at $30 a point, plus the same network doing the outdoor smoke job and the disaster job.

Sources: https://www.asdvconsultant.com/blog/aspirating-smoke-detection-vesda · https://www.suppressionsystems.com/vesda/ · https://buildings.honeywell.com/us/en/products/by-category/sensors/smoke-detectors/faast-xs-intelli-aspirating-smoke-detector · https://buildings.honeywell.com/content/dam/hbtbt/en/documents/downloads/AspiratingSmokeDetectors_AppGuide.pdf

### 1.10 Bosch AVENAR 4000 (addressable multi-sensor detectors)

**What it does.** [fact] Optical plus thermal plus (new variants) CO sensing in one head. "Intelligent Signal Processing" with "algorithms trained on over 5,000 real fire patterns" and Dual Ray technology that separates smoke from dust and steam by comparing scattered light at two wavelengths. Bosch Remote Services for remote monitoring; marketed as "IoT-ready".

**What it lacks.** [fact] The product page makes no mention of exposing trend or rate-of-rise data to building staff, and describes no networking outside the panel beyond Bosch's own remote maintenance service. [inference] Each detector decides alone. Correction to the spec: modern addressable panels do show which detector tripped, not only a zone; the spec's "zone number" complaint is true of conventional (non-addressable) panels, which remain common in older warehouses. Say "conventional panels" in the pitch, not "all panels".

**Sentinel's position.** AVENAR is single-point discrimination (is this particle smoke?). Sentinel is spatial discrimination (is this smoke local or regional?). Both are rule-based and neither needs an LLM. Sentinel also shows the staff the numbers, not just a bell.

Sources: https://www.boschbuildingtechnologies.com/lifesafetysystems/en/products/fire-detection/avenar-detector-4000-series/ · https://www.boschbuildingtechnologies.com/lifesafetysystems/en/news-events/co-automatic-fire-detector/

### 1.11 Raptor Technologies, Navigate360, CrisisGo (K-12 safety platforms)

**What they do.** [fact] Raptor: drill planning, silent panic alerts, accountability and reunification, real-time information sharing. Navigate360: drill planning, campus mapping, panic activation, alert routing. CrisisGo: lockdown communication, accountability checks, reunification, parent messaging; has a "Receive Offline Messages" setting for alerts already queued.

**What they lack.** [inference] All three are cloud-hosted apps that require the school's network or the phone's cellular data to function; "offline" means receiving a cached alert, not running a roll call without a server. None has a physical presence on campus, none measures anything (no air quality, no smoke), and none works for a warehouse or a neighbourhood. Roll call in these tools is a form in an app the teacher must have installed and logged into.

**Sentinel's position.** Sentinel's drill mode is deliberately narrower than Raptor's suite. What it adds: the roll call is stamped by the muster-point node the teacher is standing next to, it works on the school's edge server with the internet down, and it is the same UI the school uses for smoke-day decisions, so staff actually know it.

Sources: https://raptortech.com/protect-your-school/emergency-management-suite/ · https://www.coram.ai/post/raptor-vs-navigate360 · https://www.coram.ai/post/crisisgo-competitors · https://crisisgo.helpscoutdocs.com/article/449-why-did-i-not-get-an-alert

### 1.12 Dryad Silvanet (the closest prior art; a judge may raise it)

**What it does.** [fact] Solar-powered gas sensors nailed to trees, each covering an 80 to 100 m radius, running an on-device ML model on VOC, CO, hydrogen, and PM2.5 to detect smouldering fires within minutes. LoRaWAN plus a proprietary multi-hop mesh through Mesh Gateways to Border Gateways to a cloud platform. Over 19,000 sensors deployed in its first sales year; customers include CalFire and PG&E.

**What it lacks.** [inference] Dryad is single-purpose (forest ignition detection) and outbound only. Each sensor classifies alone with a per-device model; the mesh carries results, not a spatial baseline. No human reporting, no roles, no drill or daily use, no phone portal, no indoor or school application, and it is a cloud product priced for utilities.

**Sentinel's position.** This is the one to pre-empt with Amazon and NVIDIA judges. Say: "Dryad proves cheap gas-sensor meshes find fires early. They put the intelligence in each sensor. We put it between the sensors, because our sensors live in buildings and schoolyards where the sky itself is the false alarm."

Sources: https://www.dryad.net/ · https://docs.dryad.app/dryad-documentation/silvanet-suite/silvanet-mesh-network · https://www.lightreading.com/iot/dryad-networks-connects-the-forests-for-early-wildfire-detection

### 1.13 Prior-art summary grid

| System | Sensors | Local vs regional discrimination | Inbound verified reports | Works with internet down | Everyday use | Responder-only close |
|---|---|---|---|---|---|---|
| Meshtastic | passive telemetry | no | no (spoofable) | yes | hobby | no |
| PurpleAir / AirGradient | PM only | no (intra-device only) | no | no | yes (daily AQ) | n/a |
| Watch Duty | none | n/a | no (staff-vetted) | no | yes (news) | n/a |
| Genasys / Everbridge | integrates others' | no | no | no | rarely | n/a |
| Zello | none | n/a | no | no | yes | no |
| goTenna Mesh | none | n/a | no | yes | no (discontinued) | no |
| Seattle Hubs | none | n/a | paper | yes | monthly meetings | no |
| IPAWS / WEA | none | n/a | no | needs towers | no | n/a |
| VESDA / FAAST | smoke (sampling) | no | no | panel only | continuous, invisible | n/a |
| Bosch AVENAR | smoke+heat+CO | single-point only | no | panel only | continuous, invisible | n/a |
| Raptor / Navigate360 / CrisisGo | none | n/a | roles only | cached alerts only | drills | no |
| Dryad Silvanet | gas+PM | per-sensor ML | no | mesh yes, cloud no | no | n/a |
| **Sentinel** | PM+heat+gas | **neighbour median** | **proximity + sensor + crowd** | **node, edge, cloud tiers** | **drills + smoke card** | **yes, audited** |

---

## 2. Sentinel's novelty claims, stated precisely

Rule for the pitch: never say "nobody has done X" unless the row above is empty. Say "we could not find a product that does X" and be ready to name the nearest one.

### 2.1 Spatial-correlation fire-vs-sky discrimination

**[claim]** Sentinel classifies a PM2.5 event by comparing one node against the median of its neighbours within 150 m over the last 5 minutes, and only calls LOCAL_FIRE when the node is more than 2x the regional median, rising more than 40 µg/m³ in 5 minutes, and corroborated by a temperature rise over 3 °C in 2 minutes or a gas delta. The same reading with a high regional median is HAZARDOUS_SMOKE and drives a completely different action (SMS to the zone, not a fire response).

**What is borrowed.** Rate-of-rise heat detection and cross-zoning ("two detectors must agree") are decades old in NFPA 72 practice. Neighbour comparison for sensor quality control is standard in the PurpleAir and EPA correction literature.

**What we could not find.** A product that uses the neighbour median as a *regional smoke baseline* so that the identical PM number is classified as "building" or "sky" and routed to different responders. Dryad classifies per sensor. AVENAR classifies per head. PurpleAir compares two lasers inside one box. Sentinel's classification is a property of the network, not the device, which is why it is software-only and why a $30 node can do it.

**Honest limits.** With fewer than three neighbours the median is fragile; the engine should require n ≥ 3 and fall back to LOCAL_SMOKE_SUSPECT otherwise. Outdoor wind can make a real fire look regional for one tick; the 5-minute window is a guess we would tune with data.

### 2.2 Proximity-verified reporting with a trust score

**[claim]** A report submitted through a node's captive portal is stamped with that node's identity, which proves the reporter's phone was within WiFi range (~50 m) of a known physical location, without GPS, an account, or an installed app. The stamp is one of six additive layers (proximity +40, sensor corroboration +30, crowd corroboration up to +40, verified role +50, GPS consistency ±, device history −40 per confirmed false) that produce a score responders see as Verified / Likely / Unverified.

**What is borrowed.** Device fingerprinting, rate limiting, and role-based trust are ordinary. 911 has had ANI/ALI location for decades.

**What we could not find.** Any public "I need help" system that uses *physical presence at a sensor* as the primary anti-abuse signal and combines it with *what the sensor is currently reading* into a single visible score. Meshtastic is spoofable by design. Watch Duty solves abuse by not accepting public reports at all. Sentinel accepts them and ranks them.

**Honest limits.** The WiFi stamp proves proximity to the box, not identity; a bad actor standing next to the box can still lie, which is why the score is additive and never a hard gate. Internet-submitted reports cap at "Likely".

### 2.3 Dual-use "earns its wall" design

**[claim]** The same node, the same backend, and the same phone UI are used every school day (outdoor activity decision card) and every month (drill roll call, required by RCW 28A.320.125(5)(b): "at least one safety-related drill per month"). The disaster function is a mode of a tool people already touch, not a separate product.

**What is borrowed.** The insight itself is old (fire extinguishers are inspected monthly for the same reason).

**What we could not find.** A product spanning all three: daily air-quality decision, monthly drill accountability, and offline disaster reporting. PurpleAir does the first, Raptor the second, Meshtastic the third. goTenna's discontinuation is the evidence that single-purpose disaster hardware does not survive commercially.

**Honest limits.** Dual use is a design and business claim, not a technical one. Say it as strategy, not invention.

### 2.4 Offline-first with three degradation tiers

**[claim]** Node alone: local alarm, local portal, store-and-forward queue. Node plus edge server (a Raspberry Pi running the same container as the cloud): full admin dashboard, roll call, site incident map, no internet. Cloud reachable: everything plus SMS and cross-site responder view. The phone needs nothing installed; the node's DNS answers every hostname with itself so the captive-portal page opens like hotel WiFi.

**What is borrowed.** Captive portals and store-and-forward are standard. Meshtastic already works with no backbone.

**What we could not find.** An emergency reporting system with roles and a responder console that keeps its *full* function on a site with the uplink dead. CrisisGo's offline mode receives cached alerts. Zello, Genasys, Watch Duty, and Raptor stop.

**Honest limits.** Responder pings queue until an uplink returns; a responder off-site sees nothing until then. The demo runs the "edge" on the laptop, which is the honest equivalent.

### 2.5 Responder-only resolution with an immutable audit log

**[claim]** Only a contracted-agency user can close an incident; closing requires a note; every action is appended with user, time, and IP and cannot be edited. Admins (principals, warehouse ops) see status but cannot dismiss. Reporters look up status by their `SN-XXXX` code.

**What is borrowed.** CAD and 911 systems have audited dispositions. This is policy design, not a new algorithm.

**Why it still matters.** In the public-report context this is what keeps a school from quietly deleting an embarrassing report and what gives the reporter a receipt. Present it as a trust property of the whole system, not as an invention.

### 2.6 What Sentinel is not claiming

- Not claiming an ML model. Every decision is a readable rule. Say "rules first, no LLM in the loop" to the Amazon judges; it is a strength here.
- Not claiming to replace code-required detection, WEA, or 911.
- Not claiming fabricated hardware. Schematic, BOM, and power budget are designed; the demo is simulated and labelled.

---

## 3. Three add-on features (software only, ≤ 90 min each, one agent each)

### 3.0 How the six candidates were scored

Judge impact (1 to 5) is "does a judge visibly react in a 90-second table demo". Effort is one agent, wall-clock, given the spec's backend and simulator already exist by ~2:30 PM.

| Candidate | Impact | Effort | Verdict |
|---|---|---|---|
| Time Machine scrubber with annotated decisions | 5 (controls the whole demo; shows the engine thinking) | ~85 min | **Pick** |
| Sky vs Building explainability panel | 5 (the "why is this a fire" moment; AI-for-Good and Amazon judges) | ~70 min | **Pick** |
| WEA draft generator | 4 (PNW Impact and honesty; responder judges know IPAWS) | ~60 min | **Pick** |
| Sensor drift detector | 3 (credibility with Dr. Zhou, but it is a badge) | ~40 min | Fold a single outlier badge into the explain panel if time allows; not a headline |
| What-if threshold slider | 3 (risks confusing the demo; judges may ask "so is the threshold arbitrary?") | ~70 min | Skip; Time Machine already replays stored decisions |
| Muster-point short-code roll call | 2 (drill mode in the spec already covers this) | ~60 min | Skip; already in spec §6.4 |

The three picks cover three different rubric buckets: Execution (Time Machine), Substance and AI-for-Good (Explain), Business and PNW Impact (WEA draft). They share no code paths, so three agents can build them in parallel with no merge conflicts beyond one route file.

### 3.1 Feature A: Time Machine

**One line.** A scrubber under the admin map that replays the simulated day and pins every engine decision on the track with the numbers that caused it.

**Why it lands.** It turns "fast-forward the simulator" (already required by demo script step 2) into a visible instrument. A judge can drag back to 2:14 PM and watch the gym node turn red alone while the field nodes stay orange. It also makes the demo deterministic and recoverable: if something breaks live, scrub to the good part.

**Data needed.**
- Every reading row already carries `ts`; add `sim_ts` (simulated clock, ISO 8601) written by the simulator. The simulator compresses a 24-hour scripted day into a 6-minute real loop, so `sim_ts` advances 4 sim-minutes per real second.
- `alerts` table gets a `reason` TEXT column written by the engine at decision time, e.g. `LOCAL_FIRE @ Gym: pm_rise 58.2 > 40, temp_rise 4.1 > 3, pm25 210 > 2×median 34`.
- Decision-card changes are stored as alerts of kind `ACTIVITY_ADVISORY` (already in spec), so no new table.

**Backend.**
- `GET /timeline?site_id=&from=&to=&step=30` → `{ok, data: {readings: [{node_id, sim_ts, pm25, temp_c, band}], alerts: [{id, kind, priority, node_id, sim_ts, reason}], incidents: [{code, type, sim_ts, trust_score, status}], sim_now}}`. Readings decimated to one per node per `step` sim-seconds via SQL (`GROUP BY node_id, sim_ts/step`). One query, one JSON, under 200 KB for 8 nodes.
- `POST /sim/jump` `{to: "scene:calm" | "scene:smoke" | "scene:fire" | "<sim_ts>"}` → simulator seeks; the engine re-evaluates from stored state. This is the demo's fast-forward button. Idempotent.
- No new WebSocket events; the live path is unchanged.

**UI (admin route, bottom 96 px strip).**
- Track: 24-hour axis rendered from `sim_ts`, with a thin PM2.5 sparkline of the site median behind it. Decision pins: red (P1), orange (P2), amber (P3), grey (P4). Incident pins as small diamonds.
- Handle: draggable; while dragging, the map, node dots, and decision card read from a zustand `timeline` slice at time t instead of the live slice. Release does not snap back; a **LIVE** button (pulsing dot) returns to the live stream.
- Hover or tap on a pin: a small card with the `reason` string verbatim and a "Show math" link that opens Feature B at that node and time.
- Transport: play/pause, 1x and 10x, keyboard ← → for 1 sim-minute steps.
- Motion: `motion` layout animation on the handle; pins fade in as they enter view.

**Build order (85 min).** 15 min `sim_ts` + `reason` columns and engine write; 20 min `/timeline` and `/sim/jump`; 40 min scrubber component and store slice; 10 min wire pins to Feature B.

**Cut line if late.** Drop 10x and keyboard; keep drag and LIVE.

### 3.2 Feature B: Sky vs Building (explainability panel)

**One line.** Click any node and see the exact rule that fired, with live values substituted, and a bar chart of this node against each neighbour and their median.

**Why it lands.** The spec's best sentence ("one node spiking while its neighbours are flat is a fire in that aisle; every node climbing together is the sky") becomes a picture a judge can read in four seconds. For the Amazon and NVIDIA judges it is the "rules first" proof. For AI-for-Good it shows the decision is auditable.

**Data needed.**
- The engine already computes `pm_rise`, `temp_rise`, `gas_delta`, `neighbours`, `regional` per tick. Keep the last evaluation per node in memory and persist a rolling window of 60 per node to a small `node_evals` table: `(node_id, sim_ts, pm25, pm_rise, temp_rise, gas_delta, regional_median, ratio, neighbour_ids JSON, neighbour_pm25 JSON, branch, thresholds JSON)`.
- Thresholds JSON snapshot `{pm_rise: 40, temp_rise: 3, gas_delta: <tenant>, ratio: 2, hazardous: 225.5, regional_hazardous: 150}` so the panel never hard-codes numbers.

**Backend.**
- `GET /nodes/{id}/explain?at=<sim_ts>` → the eval nearest `at` (default latest): `{ok, data: {node, eval, neighbours: [{id, label, dist_m, pm25}], branch, checks: [{name, expr, lhs, op, rhs, pass}]}}`. `checks` is computed server-side so the UI renders whatever the engine actually tested; four rows for LOCAL_FIRE, two for HAZARDOUS_SMOKE, and so on.
- Broadcast `eval` events on the existing WebSocket only for the node currently selected (client sends `{subscribe_eval: node_id}`), so the panel updates live without flooding.

**UI (right drawer, 360 px, admin and responder routes).**
- Header: node label, verdict pill (`LOCAL_FIRE` red / `HAZARDOUS_SMOKE` orange / `LOCAL_SMOKE_SUSPECT` amber / `ADVISORY` / `CLEAR`), and the plain-English verdict: "This node is 6.2x its neighbours. Heat is rising. This is a fire here, not smoke from outside."
- Chart: horizontal bars, one per neighbour plus this node, PM2.5 on the x-axis, a dashed vertical line at the median and a second at 2x median. This node's bar is the accent colour. Pure SVG, no chart library.
- Checks: one row per condition, monospace, `pm_rise 58.2 > 40 ✓`, `temp_rise 4.1 > 3 ✓`, `pm25 210 > 2 × 34 ✓`; a failed row shows ✗ and dims. Rows animate in with a 40 ms stagger.
- Rule source: a collapsed "Show rule" block with the pseudocode from spec §6.2, the fired branch highlighted.
- Optional 15-minute add if time allows: a small "Outlier?" badge when a node is > 3 median-absolute-deviations from neighbours *without* heat or gas, with the text "Sensor drift suspected; cross-check before trusting." This is the sensor drift detector, reduced to its useful part.

**Build order (70 min).** 15 min `node_evals` write and `checks` builder; 15 min endpoint and WS subscribe; 35 min drawer, SVG bars, check rows; 5 min hook from Feature A pins.

**Cut line if late.** Drop the live WS subscribe; poll the endpoint every 2 s while the drawer is open.

### 3.3 Feature C: WEA Draft Generator

**One line.** When the engine reaches priority 1 or 2 across two or more nodes in a zone, the responder console offers a pre-filled, CAP-shaped Wireless Emergency Alert that the agency can copy into their own IPAWS tool. Sentinel drafts; the agency issues.

**Why it lands.** It answers the "ping every phone in the area" question honestly and precisely (only alerting authorities can send WEA; here are the exact fields they need). Floor judges who have worked with emergency managers will recognise the 90/360 split and the 100-vertex polygon limit. It also closes the loop with Genasys and Everbridge instead of pretending to replace them.

**Data needed.**
- Zone polygon (already in `zones.geom`, GeoJSON), zone name, site address.
- Active alert: kind, priority, node labels, started_at, current PM2.5 and band.
- Agency name from the logged-in responder's tenant.
- No new tables. Log a `wea_drafted` row in `incident_events` (or `alert_events`) with the draft hash so the audit trail shows what was offered.

**Backend.**
- `POST /responder/wea-draft` `{alert_id}` → `{ok, data: {event_code, headline, msg_90, msg_360, severity, urgency, certainty, polygon: [[lat,lng]...], vertex_count, expires, sender, cap_xml}}`.
- Deterministic template, no LLM:
  - `LOCAL_FIRE` → event code `FRW` (Fire Warning), severity `Extreme`, urgency `Immediate`, certainty `Observed`.
  - `HAZARDOUS_SMOKE` → event code `SPW` (Shelter in Place Warning), severity `Severe`, urgency `Immediate`, certainty `Observed`.
  - `msg_90`: `"{AGENCY}: {HAZARD} near {ZONE}. {ACTION}. Check local news."` The builder truncates at word boundaries and asserts ≤ 90.
  - `msg_360`: adds node count, PM2.5 reading, start time, and a "do not call 911 for information" line; asserts ≤ 360.
  - `polygon`: zone ring; if > 100 vertices, run Douglas-Peucker until ≤ 100 (20 lines of Python) and set `simplified: true`.
  - `expires`: started_at + 2 h. `cap_xml`: minimal CAP 1.2 `<alert>` with `<info>` and `<area><polygon>`.
- Guard: returns `{ok:false, error:"NOT_ELIGIBLE"}` unless the alert is priority ≤ 2 and spans ≥ 2 nodes. The rule is stated in the UI so nobody asks why the button is grey.

**UI (responder route, modal from the incident or alert detail).**
- Button **Draft WEA** appears only when eligible; tooltip explains the rule otherwise.
- Modal, two columns. Left: editable 90-char and 360-char text areas with live counters that turn the accent colour at 80% and red past the limit; event code, severity, urgency, certainty as read-only chips. Right: the zone polygon drawn as SVG on the same static map with the affected nodes highlighted and "vertices: 37 / 100".
- Footer: **Copy CAP XML**, **Copy 90**, **Copy 360**, and a permanent label in the modal header: "Sentinel drafts. Your agency issues through IPAWS. Nothing is sent from here."
- Every copy click logs `wea_drafted` with the responder's user id.

**Build order (60 min).** 20 min template builder, truncation, Douglas-Peucker, CAP string; 10 min endpoint and audit row; 30 min modal with counters and polygon preview.

**Cut line if late.** Drop CAP XML; keep 90/360 text and polygon count.

### 3.4 Integration notes for the orchestrator

- Feature A depends on `sim_ts` and `reason`; land those two columns first (they are 15 minutes) so B and C are unaffected if A slips.
- Feature B is the only one that touches the engine's inner loop; give it to the agent who owns the engine.
- Feature C touches only the responder route and one new backend module; safe to assign to a fresh agent.
- All three must carry the demo's honesty labels where relevant: "Simulated node" on the timeline, "Rules, not ML" on the explain panel, "Nothing is sent from here" on the WEA modal.

---

## 4. The 30-second pitch

> Every emergency app assumes the internet exists. Sentinel doesn't. It's a thirty-dollar box that measures smoke, heat, and gas, talks to its neighbours over long-range radio, and serves its own web page to any phone that walks up, no app, no signal. On a normal day a school uses it to decide whether recess goes outside and to run the drill the state requires every month. In a warehouse it tells you which aisle is burning, not which zone. On the worst day, an earthquake or a wildfire, anyone next to the box can report "I'm trapped", get a code, and be seen by a responder on a live map, verified by the fact that they're standing next to a sensor that agrees with them. One node spiking while its neighbours are flat is a fire in that room. Every node climbing together is the sky. Sentinel is the only thing in the building that knows the difference, and it keeps knowing it when the internet dies.

(About 150 words. Cut the warehouse sentence if the judge is a school buyer; cut the drill sentence if the judge is VC.)

---

## 5. Five lines that land (Sentinel edition)

1. **"A sentinel that only wakes up for the disaster is asleep when it matters. Ours takes attendance every month, so it's awake."**
   (Dual use. For Jonathan Briggs and any buyer.)

2. **"One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky. That's the whole algorithm, and it fits on a slide."**
   (Spatial correlation. For Amazon and NVIDIA judges. Then open the Sky vs Building panel.)

3. **"You can't fake standing next to the box. Only a phone on the node's own WiFi can open a verified report, and only a responder can close it."**
   (Trust score and responder-only resolution. For floor judges and anyone who asks about abuse.)

4. **"Turn off the WiFi. Do it again."**
   (Offline-first. Say it, do it, say nothing else until the code appears on the second phone.)

5. **"Sentinel drafts the alert. Your agency sends it. We're not pretending to be FEMA; we're making sure the fire department's message is already written when they log in."**
   (WEA honesty. For PNW Impact and any judge with public-sector experience.)

Backup line for Dryad or Meshtastic questions: **"They put the intelligence in each sensor. We put it between the sensors, because in a schoolyard the sky itself is the false alarm."**

---

## 6. Source list

- Meshtastic introduction: https://meshtastic.org/docs/introduction/
- Meshtastic telemetry module: https://meshtastic.org/docs/configuration/module/telemetry/
- Meshtastic encryption limitations: https://meshtastic.org/docs/about/overview/encryption/limitations/
- Meshtastic forgery issue #4030: https://github.com/meshtastic/firmware/issues/4030
- PurpleAir channels A/B: https://community.purpleair.com/t/what-are-channel-a-and-channel-b/3643
- PurpleAir confidence score: https://community.purpleair.com/t/the-confidence-score/5193
- PurpleAir in Montana schools: https://www2.purpleair.com/blogs/blog-home/how-montana-schools-are-using-purpleair-sensors-to-protect-communities-from-wildfire-smoke
- AirGradient on EPA correction: https://www.airgradient.com/blog/epa-correction-and-airgradient/
- EPA Fire and Smoke Map research: https://www.epa.gov/sciencematters/epa-research-improves-air-quality-information-public-airnow-fire-and-smoke-map
- Watch Duty how it works: https://www.watchduty.org/how-it-works/overview
- Watch Duty volunteers: https://www.watchduty.org/get-involved/volunteer
- Genasys communication zones: https://genasys.com/genasys-protect/communication-zones/
- Genasys Protect platform: https://genasys.com/protect-platform/
- Everbridge zone preload (Chaffee County): https://www.themountainmail.com/news/commissioners-hears-update-on-new-evacuation-tool/article_188cd07f-5736-47ec-ac06-1ab8d97adf10.html
- Zello needs internet (NBC, Ida): https://www.nbcnews.com/news/us-news/live-blog/hurricane-ida-live-updates-n1277879/ncrd1277900
- Zello during an emergency: https://blog.zello.com/how-to-use-zello-during-an-emergency
- Zello for first responders (ASPR TRACIE): https://asprtracie.hhs.gov/technical-resources/resource/12507/6-key-ways-zello-helps-first-responders
- goTenna Mesh discontinuation: https://nelos.app/guides/what-happened-to-gotenna-mesh/
- goTenna consumer-to-tactical transition: https://thelastmile.gotennapro.com/gotennas-transition-from-consumer-to-tactical-grade-mesh-networking-devices/
- Seattle Emergency Hubs: https://seattleemergencyhubs.org/
- Seattle Hubs on ham radio: https://seattleemergencyhubs.org/blog/ham-radio-operators-essential-communications-when-all-else-fails/
- Seattle ACS: https://www.seattleacs.org/about
- FEMA alerting authorities: https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/public-safety-officials/alerting-authorities
- FEMA guide to constructing WEA/EAS messages: https://www.fema.gov/sites/default/files/documents/fema_ipaws-guide-constructing-wea-eas-messages_1.pdf
- FEMA IPAWS FAQ: https://www.fema.gov/emergency-managers/practitioners/integrated-public-alert-warning-system/faqs
- Aspirating smoke detection and NFPA 72 §17.7: https://www.asdvconsultant.com/blog/aspirating-smoke-detection-vesda
- VESDA-E overview: https://www.suppressionsystems.com/vesda/
- Honeywell FAAST XS: https://buildings.honeywell.com/us/en/products/by-category/sensors/smoke-detectors/faast-xs-intelli-aspirating-smoke-detector
- Honeywell FAAST application guide: https://buildings.honeywell.com/content/dam/hbtbt/en/documents/downloads/AspiratingSmokeDetectors_AppGuide.pdf
- Bosch AVENAR 4000: https://www.boschbuildingtechnologies.com/lifesafetysystems/en/products/fire-detection/avenar-detector-4000-series/
- Bosch AVENAR with CO sensor: https://www.boschbuildingtechnologies.com/lifesafetysystems/en/news-events/co-automatic-fire-detector/
- Raptor Emergency Management Suite: https://raptortech.com/protect-your-school/emergency-management-suite/
- Raptor vs Navigate360 comparison: https://www.coram.ai/post/raptor-vs-navigate360
- CrisisGo competitors and scope: https://www.coram.ai/post/crisisgo-competitors
- CrisisGo offline messages setting: https://crisisgo.helpscoutdocs.com/article/449-why-did-i-not-get-an-alert
- Dryad Networks: https://www.dryad.net/
- Dryad Silvanet mesh docs: https://docs.dryad.app/dryad-documentation/silvanet-suite/silvanet-mesh-network
- Dryad deployment figures (Light Reading): https://www.lightreading.com/iot/dryad-networks-connects-the-forests-for-early-wildfire-detection
- RCW 28A.320.125 (monthly drill requirement, subsection 5(b)): https://app.leg.wa.gov/rcw/default.aspx?cite=28A.320.125
