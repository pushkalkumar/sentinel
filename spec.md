# Sentinel — Project Specification

**Event:** Frontier Cascadia, September 12, 2026, UW Foster School of Business (Founders Hall), Seattle. 12-hour high school hackathon. Devpost lock 5:30 PM PDT.
**Status:** Hardware is designed (schematic, BOM, power budget) but not fabricated, per organizer guidance. All demo functionality is software. No external APIs are called during the demo; SMS and sensors are simulated in-app with an honest label.

---

## 0. One-paragraph pitch

Cascadia Node is a smarter smoke alarm that talks. It is a $30 box built around an ESP32 that measures smoke, heat, and gas, relays readings and messages to neighboring boxes over long-range radio, and keeps working when the internet and cell towers are down. On ordinary days schools use it for monthly drill roll call and for "is it safe to hold practice outside" decisions during wildfire smoke season. Warehouses use it to pinpoint exactly which aisle a fire started in, minutes before a conventional alarm panel would tell anyone anything useful. On the worst day, an earthquake or a fast-moving wildfire, anyone nearby can join the box's own WiFi with a phone, report "I'm in danger" with a verified location, and get a tracking code, while emergency responders see every report on a live map, get pinged, and are the only ones who can mark it resolved. Above a danger threshold, every registered phone in the affected zone gets an SMS alert automatically.

**Two-line version:** A roll-call and smoke-decision tool that schools and warehouses use every week, which turns into a verified emergency reporting network when the internet dies.

---

## 1. Problem

### 1.1 Wildfire smoke decisions are made badly
Puget Sound has had multi-day hazardous air (AQI > 300) in 2020, 2022, 2023, and 2025. Schools and youth sports leagues decide daily whether to hold recess, PE, and practice outdoors. Today that decision is a coach looking at a regional AQI number from a sensor miles away. Smoke is hyperlocal; a field next to a highway or in a valley can be far worse than the county reading. Nobody is measuring at the field.

### 1.2 Emergency drills run on clipboards
Washington schools are required to run emergency drills every month (fire, lockdown, earthquake/shelter-in-place; see RCW 28A.320.125, verify current text). At the muster point, teachers count heads on paper and runners carry sheets to the office. In a real evacuation the office has no picture of who is accounted for until the paper arrives.

### 1.3 Every emergency app assumes the internet exists
The Cascadia Subduction Zone has roughly a one-in-three chance of a magnitude 8+ earthquake in the next 50 years (USGS/OSU estimates; treat as approximate). Planning documents for Washington and Oregon assume cell and internet service west of I-5 is down for days to weeks. Nextdoor, FEMA, Zello, group chats, 911 itself: all need a backbone. Seattle already has a volunteer program for this exact gap, the Seattle Emergency Communication Hubs (over 100 neighborhood meetup points, verify count). They run on whiteboards and ham radio. There is no software layer.

### 1.4 Warehouse fires are found too late
Conventional smoke detectors in large warehouses report to a panel as a zone number, not a location. By the time staff walk the zone, high-rack storage fires have grown past what handheld extinguishers can stop. Losses per incident routinely run into the millions in goods alone, before business interruption. A grid of cheap networked sensors that reports "aisle 14, rack row C, temperature rising 4 °C per minute" is worth more than the goods in that aisle.

### 1.5 Reporting systems get abused
Any public "I'm in danger" button gets false reports. Systems that do not solve this get turned off. Verification has to be built in from the start.

---

## 2. Solution overview

One physical device, one backend, four user roles.

```
                       ┌──────────────────────────────────────────────────┐
                       │                 CLOUD / EDGE BACKEND              │
   Registered phones   │  FastAPI · Postgres · Redis · WebSockets          │
   ◄──── SMS alerts ───┤  Alert engine · Triage engine · Tenant isolation  │
                       └───────┬───────────────────────────┬──────────────┘
                               │ HTTPS / WebSocket          │ HTTPS / WebSocket
                    ┌──────────▼──────────┐      ┌──────────▼──────────┐
                    │  DESKTOP WEB APP    │      │  PHONE WEB APP      │
                    │  Admin / School     │      │  Teacher roll call  │
                    │  Emergency Responder│      │  Responder field    │
                    │  Warehouse Ops      │      │  Civilian "in danger"│
                    └─────────────────────┘      └──────────┬──────────┘
                                                            │ joins node WiFi
                                                            │ (no internet needed)
        LTE / Ethernet         LoRa 915 MHz mesh            │
   ┌────────────┐  ◄────────►  ┌─────────┐  ◄──►  ┌─────────▼┐  ◄──►  ┌─────────┐
   │ GATEWAY    │              │  NODE   │        │  NODE    │        │  NODE   │
   │ ESP32+LTE  │              │ ESP32   │        │ ESP32    │        │ ESP32   │
   └────────────┘              └─────────┘        └──────────┘        └─────────┘
                                 PM2.5 · temp · humidity · gas · button · LED · battery · solar
```

### 2.1 The device
An ESP32-based node with a particulate sensor, temperature/humidity sensor, combustible gas sensor, a LoRa radio for node-to-node relay, a physical "I'm here" button, an RGB status LED, and a battery with solar top-up. It runs a WiFi access point of its own so phones can reach it without any network.

**How it makes its own WiFi:** the same way a phone makes a hotspot. The ESP32's radio can run in access-point mode instead of client mode. It broadcasts a network name, hands out an IP address to any phone that joins, and serves one small web page stored in its own flash memory. A tiny DNS server on the node answers every hostname with the node's own address, which is what makes phones pop up the "sign in to network" screen automatically, exactly like hotel WiFi. No internet is involved at any step.

### 2.2 The backend
Tenant-aware FastAPI service. Receives telemetry and messages from gateways, runs the alert engine (thresholds, rate-of-rise, spatial correlation), runs the triage engine (ranking incident reports), pushes updates to web clients over WebSockets, and sends SMS through a provider. The same container image runs on a Raspberry Pi at a school as an edge server so the school keeps working with no internet; it syncs to cloud when connectivity returns.

### 2.3 The four roles

| Role | Device | Verified how | Can do |
|---|---|---|---|
| **Admin / School / Warehouse ops** | Desktop | Tenant account, SSO or email | Configure nodes and zones, run drills, see roll call, see air quality decisions, see incident map (read-only), manage staff, manage alert thresholds, export reports |
| **Emergency responder** | Desktop + phone | Contracted agency account, per-user credentials, optional hardware key | See all incidents in jurisdiction, get pinged on new incidents, see reporter location, message reporter, **mark resolved** (only this role), flag false report |
| **Teacher / staff** | Phone | Pre-provisioned staff code tied to tenant | Roll call ("Class 3B: 28 present, 2 missing, names"), drill acknowledgement, report hazard |
| **Civilian / person in danger** | Phone | Proximity (must be on a node's WiFi) + device fingerprint + corroboration | Report incident (type, count, free text, optional GPS), receive incident code, check incident status by code |

---

## 3. Hardware

### 3.1 Node block diagram

```
                     ┌────────────────────────────────────────┐
   6 V 2 W solar ───►│ TP4056 charger + protection            │
                     │      │                                  │
   18650 3400 mAh ◄──┴──────┘                                  │
        │                                                      │
        ▼                                                      │
   3.3 V buck/LDO ───► ESP32-S3 (WiFi AP + BLE + MCU)          │
                          │  UART2 ◄── PMS5003 (PM1/2.5/10)    │
                          │  I2C   ◄── BME280 (temp/RH/press)  │
                          │  ADC   ◄── MQ-2 (smoke/LPG/CO-ish) │
                          │  SPI   ◄─► SX1262 LoRa 915 MHz      │
                          │  GPIO  ◄── tactile button           │
                          │  GPIO  ──► WS2812 RGB LED           │
                          │  GPIO  ──► piezo buzzer             │
                     └────────────────────────────────────────┘
                     IP65 enclosure, vented sensor chamber, wall mount
```

### 3.2 Pin map (ESP32-S3 DevKit, adjust to board)

| Peripheral | Signal | ESP32 pin | Notes |
|---|---|---|---|
| PMS5003 | TX → RX | GPIO16 (UART2 RX) | 5 V supply, 3.3 V logic OK |
| PMS5003 | RX ← TX | GPIO17 (UART2 TX) | for sleep/wake commands |
| PMS5003 | SET | GPIO4 | duty-cycle the fan to save power |
| BME280 | SDA | GPIO21 | I2C addr 0x76 |
| BME280 | SCL | GPIO22 | |
| MQ-2 | AOUT | GPIO34 (ADC1_CH6) | needs 5 V heater, 20 s warm-up; voltage divider to 3.3 V |
| SX1262 | MOSI | GPIO23 | |
| SX1262 | MISO | GPIO19 | |
| SX1262 | SCK | GPIO18 | |
| SX1262 | NSS | GPIO5 | |
| SX1262 | DIO1 | GPIO26 | IRQ |
| SX1262 | RST | GPIO14 | |
| SX1262 | BUSY | GPIO27 | |
| Button | IN | GPIO0 | pull-down, debounced in firmware |
| RGB LED | DIN | GPIO2 | WS2812, one pixel |
| Buzzer | OUT | GPIO25 | PWM |
| Battery sense | ADC | GPIO35 | 2:1 divider |

Power rails: battery → TP4056 (charge) → protection IC → 3.3 V regulator for ESP32/BME280/SX1262; separate 5 V boost (MT3608) for PMS5003 fan and MQ-2 heater, switched by a MOSFET so both can be fully cut in sleep.

### 3.3 Firmware behaviour (per node)
- Boot: start WiFi AP `CASCADIA-<node_id>`, open network, IP 192.168.4.1. Run a DNS server that answers every hostname with 192.168.4.1 so phones auto-open the captive portal. Serve the phone web app from flash (< 60 KB, no external assets).
- Sensor loop: BME280 every 60 s; PMS5003 fan on for 30 s every 5 min in normal mode, continuous when any alert level is active; MQ-2 sampled every 10 s.
- Local alert logic runs on the node (does not need the backend): rate-of-rise and absolute thresholds from Section 6. On local alarm, LED red, buzzer, portal page banner, and a priority mesh message.
- Mesh: flooding with de-duplication. Message carries `msg_id`, `origin_node`, `hop_count`, `ttl` (default 8), `priority`. Nodes rebroadcast unseen messages after a random back-off (10–200 ms, shorter for higher priority). Store-and-forward queue of 256 messages survives with no neighbours; retry every 30 s. Same design family as Meshtastic.
- Telemetry: compact binary, ~24 bytes per reading, every 5 min normal, every 30 s when alerting.
- Sleep: light sleep between tasks; WiFi AP stays up in disaster mode, drops to beacon-only in normal mode to save power (a button press or a mesh "disaster" flag brings it fully up).

### 3.4 Gateway
Any node plus an uplink. Two variants:
- **Ethernet/WiFi-client gateway** (school, warehouse): ESP32 also joins the building network as a client and posts to the backend. Falls back to LoRa-only if the building network dies.
- **LTE gateway** (neighbourhood hub, outdoor): adds SIM7080G Cat-M1/NB-IoT modem (~$15) and a data plan. Cat-M1 often survives when consumer LTE is congested, but not when towers are down; that is why the school edge server exists.

### 3.5 Edge server
Raspberry Pi 4 or any old laptop at the school/warehouse running the same backend container against SQLite/Postgres. Talks to the gateway over USB serial or LAN. Serves the desktop and phone apps on the local network. Syncs to cloud when it can. This is what keeps the admin dashboard working with no internet.

### 3.6 Power budget (one node)

| State | Avg current | Notes |
|---|---|---|
| Normal, sensors duty-cycled, AP beacon only | ~12 mA | dominated by ESP32 light sleep + periodic wake |
| PMS5003 fan burst | +100 mA for 30 s / 5 min | ~10 mA averaged |
| MQ-2 heater | +150 mA when on | duty-cycle to 10 s / 60 s → ~25 mA averaged; drop MQ-2 entirely for outdoor-only nodes |
| LoRa TX | +120 mA for ~150 ms per packet | negligible at normal rates |
| Disaster mode, AP fully up, sensors continuous | ~180–250 mA | |

With a 3400 mAh 18650: roughly 3 days normal mode with no sun, 12–18 hours in full disaster mode, indefinite normal mode with the 2 W panel in Seattle summer/fall. Indoor nodes should be mains-powered with the battery as backup; the same board takes a 5 V USB input.

### 3.7 Radio range and coverage
- LoRa SX1262 at 915 MHz, +22 dBm, SF9, BW125: 1–2 km urban line-of-sight-ish, 300–600 m through buildings, 5+ km rural. Mesh hops extend this.
- Node WiFi AP: ~30–50 m outdoors, one or two rooms indoors. Good enough for a muster point or a hub table.
- Indoor warehouse smoke coverage: NFPA 72 spacing for spot smoke detectors is about 30 ft (9 m) on smooth ceilings. Cascadia Node is a **supplement** to code-required detection, not a replacement; it adds location, trend, and networking. Plan one node per ~2,500–4,000 sq ft for useful localisation, denser near high-value racks.

---

## 4. Cost estimate

### 4.1 Node BOM

| Part | Qty 1 | Qty 100 | Qty 1000 |
|---|---|---|---|
| ESP32-S3 module | $8.00 | $4.50 | $3.20 |
| SX1262 LoRa module + antenna | $10.00 | $6.50 | $4.80 |
| PMS5003 PM sensor | $15.00 | $11.00 | $9.00 |
| BME280 | $3.00 | $1.40 | $0.90 |
| MQ-2 gas sensor | $2.00 | $1.00 | $0.60 |
| 18650 cell + holder | $5.00 | $3.50 | $2.80 |
| TP4056 + protection + MT3608 boost | $2.50 | $1.20 | $0.80 |
| 6 V 2 W solar panel | $5.00 | $3.50 | $2.60 |
| PCB, passives, connectors, MOSFETs | $4.00 | $1.80 | $1.10 |
| Button, WS2812, buzzer | $1.00 | $0.50 | $0.30 |
| IP65 enclosure + mount | $5.00 | $3.00 | $2.20 |
| Assembly / test | $0 (hand) | $4.00 | $2.50 |
| **Total** | **~$60** | **~$42** | **~$31** |

Indoor mains-powered variant (no solar, smaller battery, no PMS duty-cycling hardware): about $6 less per node.

### 4.2 Gateway and edge

| Item | Cost |
|---|---|
| LTE gateway node (node + SIM7080G + antenna) | +$20 over a node |
| Cat-M1 data plan | $2–5 / month |
| Edge server (Raspberry Pi 4 kit) | ~$90 one-time |

### 4.3 Recurring platform costs (at 10,000 nodes across 200 tenants)

| Item | Estimate |
|---|---|
| Cloud compute (2–3 small API instances, managed Postgres, Redis) | $400–700 / month |
| Object storage, logs | $50 / month |
| SMS at $0.008/msg, assume 2 alerts/node/month, average fan-out of 20 recipients | ~$3,200 / month worst case; near zero in a quiet month |
| Per node per month all-in | ~$0.40–0.50 |

### 4.4 Pricing model (for the Business criterion)
- **Schools:** hardware at cost + $12 per node per year. A 6-building district with 40 nodes: ~$1,700 hardware, $480/year. Cheaper than one commercial weather station.
- **Warehouses:** $25 per node per year plus responder integration fee; a 200,000 sq ft facility needs ~60 nodes: ~$2,500 hardware, $1,500/year. One prevented pallet fire pays for the building.
- **Emergency agencies:** responder console licensed per seat under contract; data from all tenants in jurisdiction is shared with them free during declared emergencies.

---

## 5. Scalability

### 5.1 Radio layer
- Flooding mesh scales to roughly 50–80 nodes per LoRa channel at telemetry every 5 min before airtime collisions climb. Beyond that, split by channel/frequency or add gateways; each gateway anchors its own mesh segment. US 915 MHz ISM has no legal duty-cycle limit, but the design keeps airtime under 1% per node anyway.
- Incident messages are tiny (< 40 bytes) and prioritised over telemetry in the queue.
- Telemetry is decimated at the gateway: raw readings stay on the edge server; cloud gets 1-minute aggregates unless a node is alerting.

### 5.2 Backend
- Stateless FastAPI behind a load balancer; horizontal scale.
- Postgres partitioned by tenant and month for telemetry; TimescaleDB hypertables if volume justifies.
- Redis pub/sub fans out WebSocket updates; one WebSocket per open dashboard, not per node.
- Alert engine is a worker consuming a queue; idempotent on `(node_id, reading_ts)` so retries from flaky gateways do not double-alert.
- Tenant isolation at the row level; responders get a cross-tenant read scoped to a jurisdiction polygon.

### 5.3 Offline and degraded operation
- Node alone: local alarm, local portal, local queue. Nothing else needed.
- Nodes + edge server, no internet: full admin dashboard, roll call, incident map for that site. Responder pings queue for delivery when uplink returns; if the responder is on-site, their phone can join a node directly.
- Cloud reachable: everything, plus SMS and cross-site responder view.

### 5.4 Fleet management
- OTA firmware over WiFi when a node has a client connection, or over LoRa in chunks for isolated nodes (slow, but works).
- Each node reports battery, RSSI to neighbours, and last-seen; the dashboard flags dead or drifting sensors. PMS5003 sensors drift; cross-check against neighbours and flag outliers for cleaning.

---

## 6. Alert engine

### 6.1 Air quality bands (EPA 2024 PM2.5 breakpoints, µg/m³, 24-h basis; the engine applies them to 10-minute rolling averages for outdoor-activity decisions)

| Band | PM2.5 | Outdoor activity guidance shown to schools |
|---|---|---|
| Good | 0–9.0 | Normal |
| Moderate | 9.1–35.4 | Normal; sensitive students may limit prolonged exertion |
| Unhealthy for sensitive groups | 35.5–55.4 | Move sensitive groups indoors; limit intense practice to 60 min |
| Unhealthy | 55.5–125.4 | Cancel outdoor practice and recess; PE indoors |
| Very unhealthy | 125.5–225.4 | All outdoor activity cancelled; consider dismissal per district policy |
| Hazardous | 225.5+ | Shelter indoors; **automatic SMS to all registered phones in the zone** |

Thresholds are per-tenant configurable within these defaults. Washington DOH and OSPI publish school smoke guidance; ship those as the default policy pack (verify current tables before shipping).

### 6.2 Fire vs. wildfire smoke discrimination
The interesting problem. A wildfire raises PM2.5 slowly and regionally; a fire in the building raises it fast and locally, usually with heat and gas.

```
for each node reading r (every 10 s when active):
    pm_rise   = r.pm25 - pm25_5min_ago
    temp_rise = r.temp - temp_2min_ago
    gas_delta = r.mq2 - mq2_baseline

    neighbours = readings from nodes within 150 m in last 5 min
    regional   = median(neighbours.pm25)

    if pm_rise > 40 and (temp_rise > 3 or gas_delta > threshold) and r.pm25 > 2 * regional:
        LOCAL_FIRE (priority 1)            # this node, this spot
    elif r.pm25 > 225.5 and regional > 150:
        HAZARDOUS_SMOKE (priority 2)       # regional event
    elif pm_rise > 40 and r.pm25 > 2 * regional:
        LOCAL_SMOKE_SUSPECT (priority 3)   # one node spiking, no heat; ask staff to check
    elif band(r.pm25) worsened since last decision:
        ACTIVITY_ADVISORY (priority 4)     # update the school's outdoor decision card
```

The spatial check is what conventional detectors cannot do. One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky.

### 6.3 Geo-targeted SMS ("ping every phone in the area")
Honest constraints first:
- Sending to *literally every phone* in an area is Wireless Emergency Alerts (WEA), which only authorised government agencies can issue through FEMA's IPAWS. Cascadia Node cannot do that alone.
- What it can do:
  1. **Opt-in SMS registry per zone.** Parents, staff, residents, warehouse crews register a phone number against a zone (school, building, neighbourhood polygon). Above threshold, the alert engine sends SMS to every number in every zone intersecting the affected area. Provider: Twilio or AWS SNS in production. Delivery is best-effort and depends on cell service.
  2. **Local broadcast without any network.** Every phone joined to a node's WiFi gets the alert instantly on the portal page, plus the node's buzzer and red LED. Nearby phones that are not joined see the SSID rename to `!! EVACUATE - CASCADIA-<id>`.
  3. **Responder handoff to WEA.** When a contracted agency is logged in and the engine reaches priority 1 or 2 across multiple nodes, the responder console offers a pre-filled IPAWS/WEA message (polygon, text, severity) that the agency can send through their own authority. Cascadia Node drafts; the agency issues.
- Rate limits and de-duplication: one SMS per recipient per zone per severity level per hour, escalations only upward, an all-clear message when the band drops two levels for 30 minutes.

### 6.4 Roll call and drills
- Admin starts a drill (or the engine starts a real evacuation event). Every teacher's phone page switches to roll-call mode for their assigned class.
- Teacher enters present count and taps names for missing students (roster pre-loaded). Submits. Time-stamped, node-stamped (which muster point).
- Admin dashboard: grid of classes, green when submitted and count matches roster, amber when submitted with missing, grey when not yet submitted, with elapsed time. Missing-student list aggregated for the office and, in a real event, pushed to responders.
- Drill report exported as PDF for the compliance file.

---

## 7. Incident reporting, verification, and resolution

### 7.1 Report flow (civilian)
1. Phone joins node WiFi or opens the site over the internet.
2. Taps type: **Safe / Need water / Need medical / Trapped / Fire / Other**. Optional: number of people, free text, "share my GPS" (browser geolocation, opt-in).
3. Submits. Receives an **incident code** like `CN-7K3F` (5 characters from a base-32 alphabet without 0/O/1/I, ~33 million combinations, unique per tenant per 30 days). Code is shown large on screen and can be written on a hand.
4. Reporter can revisit the page, enter the code, and see status: Received → Acknowledged by responder → En route → Resolved. Responder can send a short message to that code.

### 7.2 Verification layers (anti-abuse)
No single check is enough; reports accumulate a **trust score** and responders see it.

| Layer | Mechanism | Score effect |
|---|---|---|
| Proximity proof | Report submitted through a node's local WiFi is stamped with that node's ID; the reporter was physically within ~50 m of a known location | +40 |
| Sensor corroboration | Node's own sensors show fire/smoke/heat consistent with the report | +30 |
| Crowd corroboration | Two or more distinct device fingerprints report the same type from the same node within 10 minutes | +20 per extra device, cap +40 |
| Verified role | Reporter is a logged-in teacher, staff, or responder | +50 |
| GPS consistency | Shared GPS is within 100 m of the node location | +10; if GPS is far from the node, −30 |
| Device history | Fingerprint (cookie + local storage token + coarse UA hash; MAC address on the node side) with prior false flags | −40 per prior confirmed false report; auto-block after 3 |
| Rate limit | Max 3 open incidents per device per hour; max 20 per node per 10 minutes before the node asks staff to confirm | reports beyond limit are queued, not shown |

Display rule: score ≥ 60 shows as **Verified**, 30–59 **Likely**, below 30 **Unverified** (still visible to responders, sorted lower). Internet-only reports with no node stamp cap at "Likely" unless a verified role submits them.

### 7.3 Responder console (contracted agencies only)
- Live map of incidents in jurisdiction, coloured by priority and trust score, with node locations and current sensor readings.
- New-incident ping: browser push, SMS, and an audible alert; escalates to a supervisor if unacknowledged in 5 minutes.
- Incident detail: type, count, free text, node, GPS if shared, trust breakdown, timeline, messages.
- Actions: **Acknowledge**, **En route**, **Resolve** (only responders can resolve; resolution requires a one-line note and is immutable in the audit log), **Flag false** (feeds device history), **Merge duplicates**, **Draft WEA**.
- Every action is logged with user, time, and IP for after-action review.

### 7.4 Admin view of incidents
Read-only. Admins see incidents on their own sites and their status, so a principal knows a responder has acknowledged the report from the gym, but cannot resolve or dismiss anything.

---

## 8. Interfaces

### 8.1 Desktop web app (admins and responders)
Routes:
- `/login`
- `/admin` — site overview: nodes, battery/health, current air band per node, today's outdoor-activity card, open incidents (read-only)
- `/admin/drill` — start drill, live class grid, missing list, end and export
- `/admin/air` — per-node PM2.5 trend, band history, decision log ("Practice cancelled 3:10 PM, PM2.5 71 at Field node")
- `/admin/alerts` — thresholds, zones, registered phone counts, SMS log
- `/admin/nodes` — provisioning, placement map, firmware version
- `/responder` — jurisdiction map, incident queue sorted by priority then trust score
- `/responder/incident/:code` — detail and actions
- `/responder/audit` — action log

### 8.2 Phone web app (served by the node itself and by the cloud)
Under 60 KB, no external fonts or scripts, large touch targets, readable in sun.
- `/` — role picker: **I need help** / **I'm staff** / **I'm a responder**
- `/report` — type buttons, count, text, GPS opt-in, submit → code screen
- `/status?code=` — track by code
- `/staff` — enter staff code → roll-call page for assigned class
- `/responder` — enter credentials → compact incident list for field use, acknowledge/resolve
- Banner at top always shows current air band and any active alert for this node.

### 8.3 Warehouse operations variant
Same admin app with a floor-plan view instead of a campus map: nodes placed on the plan, heat-map of PM2.5 and temperature, alarm shows the specific node and its neighbours' readings, one-tap "notify fire department" that pre-fills the responder console and the building's address and access instructions.

---

## 9. Data model (backend)

```
tenants(id, name, type: school|warehouse|neighbourhood|agency, policy_pack)
sites(id, tenant_id, name, geom polygon, floor_plan_url?)
zones(id, site_id, name, geom polygon)              -- alert fan-out unit
nodes(id, site_id, zone_id, label, lat, lng, floor?, fw_version, last_seen, battery_pct)
readings(node_id, ts, pm1, pm25, pm10, temp_c, rh, mq2_raw, rssi)    -- partitioned by month
alerts(id, tenant_id, zone_id, node_id?, kind, priority, band_from, band_to, started_at, cleared_at)
sms_recipients(id, tenant_id, zone_id, phone_e164, consent_at, opted_out_at?)
sms_log(id, alert_id, recipient_id, status, provider_msg_id, sent_at)
users(id, tenant_id, role: admin|teacher|responder, email, staff_code_hash?)
classes(id, site_id, name, teacher_user_id) ; roster(class_id, student_ref)
drills(id, site_id, kind, started_at, ended_at, started_by)
rollcalls(id, drill_id, class_id, node_id, present, missing_refs[], submitted_at)
incidents(id, code, tenant_id, node_id?, type, count, text, lat?, lng?, device_fp, trust_score, status, created_at)
incident_events(id, incident_id, actor_user_id?, action, note, at)
device_history(device_fp, tenant_id, false_flags, blocked_at?)
```

All timestamps ISO 8601 UTC. Phone numbers E.164. Geometry as GeoJSON.

Core endpoints (FastAPI, JSON envelopes `{ok, data, error}`):
- `POST /ingest/telemetry` (gateway) · `POST /ingest/mesh-message` (gateway)
- `POST /incidents` · `GET /incidents/{code}` · `POST /incidents/{code}/events` (responder) · `GET /responder/incidents?bbox=`
- `POST /drills` · `POST /drills/{id}/rollcall` · `GET /drills/{id}` · `POST /drills/{id}/end`
- `GET /sites/{id}/air` · `GET /sites/{id}/decision-card`
- `PUT /tenants/{id}/thresholds` · `POST /zones/{id}/recipients` · `GET /alerts`
- `WS /live?tenant=` streams readings, alerts, incidents, rollcalls

---

## 10. Hackathon demo build (today, no hardware, no external APIs)

Everything below runs on one laptop and, over the laptop's hotspot, on judges' phones. Nothing calls the internet. Anywhere production would call a service, the demo shows a labelled simulation.

### 10.1 What is simulated and how it is labelled
| Production | Demo | Label on screen |
|---|---|---|
| ESP32 nodes with sensors | `simulator/` Python process spawning 8 virtual nodes on a UW campus map, each emitting readings from a scripted day (calm morning → smoke afternoon → one node "fire" spike) | "Simulated node · schematic in submission" |
| LoRa mesh | Virtual nodes exchange messages over local UDP with 15% random drop; de-dup and retry logic is real | hop animation on map, hop log panel |
| Twilio SMS | "SMS Outbox" panel listing every message the engine would have sent, with recipient zone and text | "SMS provider disabled in demo" |
| Node captive portal | Laptop hotspot + phone app at `http://<laptop-ip>:5173` | "In production this page is served by the node itself" |
| Cloud Postgres | SQLite | none needed |

### 10.2 Stack
- Frontend: Vite + React + TypeScript + Tailwind. One app, routes for desktop and phone.
- Backend: FastAPI + SQLite + one WebSocket endpoint. Uvicorn on `0.0.0.0:8000`.
- Simulator: Python, `asyncio`, posts to the backend like a gateway would.
- Map: static SVG of the campus or a plain grid with node dots. No tile server (that would be an API).

### 10.3 Demo script (90 seconds at the table, 3 minutes on stage)
1. Dashboard shows calm campus, all nodes green, decision card "Outdoor practice: OK".
2. Fast-forward the simulator: smoke rolls in. Nodes turn orange then red together. Decision card flips to "Cancel outdoor practice, PM2.5 71". Say: regional pattern, sky not building.
3. Trigger a fire at the gym node. That node alone spikes with temperature. Engine fires LOCAL_FIRE at the gym, not a smoke advisory. Say: the neighbours are flat, so this is a fire in this room. Warehouse pitch lands here.
4. Judge takes out phone, joins hotspot, opens the page, taps "Trapped", 2 people. Message hops across the map to the hub. Code `CN-7K3F` appears on their phone. Responder view pings, shows the report as Verified (node proximity + sensor corroboration).
5. Turn off the laptop's uplink WiFi. Do step 4 again from a second phone. Still works. Say: nothing here needed the internet.
6. Responder marks resolved. Judge's phone status page updates. SMS outbox shows the zone alert that went to registered parents.
7. Start a drill. Teacher page: "Class 3B, 28 present, missing 2". Admin grid updates. Say: same buttons every month, so staff know them on the bad day.

### 10.4 Build order and cut list
1. Backend skeleton, `POST /incidents`, WebSocket, phone report page, responder list. One message end to end. (target 12:30)
2. Simulator with 8 nodes, scripted readings, mesh hop with drop/retry, map with hop animation. (target 2:30)
3. Alert engine rules, decision card, LOCAL_FIRE vs HAZARDOUS_SMOKE, SMS outbox. (target 3:30)
4. Trust score display, incident code, status lookup, responder resolve, audit log. (target 4:15)
5. Drill mode and roll-call grid. (target 4:45)
6. Hotspot test with a real phone, schematic PNG, BOM table, 60-second backup video, Devpost text, AI tool disclosure. (target 5:15, lock by 5:20)

Cut in this order if behind: drill mode → hop animation (keep hop log) → trust score breakdown (keep Verified/Unverified) → SMS outbox (describe verbally).

### 10.5 Devpost submission checklist
- Project name, description, problem, how built, technologies.
- **AI tools disclosure file** naming each tool and paid tier (required by rules).
- Repo link. Screenshots of all three views. Schematic image. BOM table. Demo video.
- State clearly: hardware designed not fabricated per organizer guidance; sensors, mesh radio, and SMS are simulated in the demo; all logic is real.

---

## 11. Hackathon context

### 11.1 Rubric (Devpost)
- **Substance:** strength of the problem, originality, technical depth, significance of the attempt.
- **Execution:** functionality, technical implementation, build quality, UX, demonstration.
- **Business:** usefulness, target user or customer, real-world potential, ability to explain why it matters.

### 11.2 Awards this project targets
| Award | Value | How this project qualifies |
|---|---|---|
| Grand / 2nd / 3rd (in-person only) | $4k+$16k / $1.5k+$6.5k / $1k+$5k | Scores across all three rubric buckets |
| Best IoT & Connected Systems | $500 + $7.5k | ESP32 node, LoRa mesh, gateway, edge server, full schematic and BOM |
| Best AI for Good | $500 + $5.5k | Fire-vs-smoke discrimination, triage ranking, trust scoring (rule-based, honest about it) |
| PNW Impact | $500 + $3.5k | Cascadia quake, wildfire smoke season, Seattle Emergency Hubs, WA drill law |
| Frontier Award | $500 + $4.5k | Works with the internet dead; almost no one attempts offline-first |
| Crowd Favorite (in-person) | audience vote | Judges and audience join the network from their own phones |
| Best FinTech, Best Automated SWE | skipped on purpose | bolting them on would cost Execution |

Rules do not state one award per team. Assume a cap is possible.

### 11.3 Judges and what to say to whom
- **Aayush Shah (Amazon AGI), Rishi Cheruku (Amazon):** lead with the spatial-correlation fire detector and the flooding-mesh design; say "rules first, no LLM in the loop, here is why."
- **Surbhi Jha (NVIDIA, infra/automation background):** edge server runs the same container as cloud; idempotent ingest; OTA over LoRa.
- **Jonathan Briggs (Eastside Prep CTIO, robotics coach):** hardware BOM and price per building; drill roll call replaces clipboards; he is the buyer.
- **Dr. Mo Zhou (Eastside Prep, programming and data science):** the decision card and the smoke-day data; simulated day is a real dataset shape.
- **Floor judges from Seattle tech/VC:** warehouse loss prevention is the revenue story; schools are the distribution story.

### 11.4 Lines that land
- "Disaster hardware fails because it sits unused. This box earns its wall every month."
- "One node spiking while its neighbours are flat is a fire in that aisle. Every node climbing together is the sky."
- "Only a responder can close an incident. Only a phone standing next to the box can open a verified one."
- "Turn off the WiFi. Do it again."

---

## 12. Known gaps and honest caveats
- WEA/IPAWS broadcast to all phones requires government authority; the product drafts, agencies send.
- PMS5003 sensors drift and need cleaning; cross-node comparison flags this but does not fix it.
- MQ-2 is a cheap heater-based gas sensor with poor selectivity; a production indoor node should use an electrochemical CO sensor and a proper photoelectric smoke chamber, and must sit alongside code-required detection, not replace it.
- LoRa flooding mesh does not scale past ~80 nodes per channel; larger sites need multiple gateways or channel planning.
- Browser geolocation is opt-in and often coarse indoors; node proximity is the primary location signal.
- Legal: SMS registry requires TCPA-compliant opt-in and STOP handling; student roster data requires FERPA-compliant handling and a data processing agreement with the district.
- Demo today contains no fabricated hardware, no live sensors, and no live SMS. Every one of those is labelled on screen.
