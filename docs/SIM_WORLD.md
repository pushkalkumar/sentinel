# SIM_WORLD — the simulated world behind the Sentinel demo

Scope: everything the simulator and the map renderers need and nothing else. Two sites (a Seattle high-school campus and a Harbor Island warehouse), their SVG geometry, node placements with lat/lng, the LoRa graph, and the scripted-day dataset generator. The generator code in §8 is the single source of truth; the tables in this doc were produced from it and match it. Copy `world.py` into `simulator/world.py` as-is.

On-screen label every time a node or reading is shown: **"Simulated node · schematic in submission"** (spec §10.1).

---

## 1. How to use this document

| Agent | Read | Produce |
|---|---|---|
| Simulator agent | §2, §4, §6, §7, §8 | `simulator/world.py` (copy §8), `simulator/run.py` (tick loop, UDP mesh, POST to backend) |
| Campus map agent | §3, §4.3, §9 | `<CampusMap/>` SVG component, 1000×700 viewBox |
| Warehouse map agent | §5 | `<WarehouseMap/>` SVG component, 1000×600 viewBox |
| Alert engine agent | §6.5, §10 | rule thresholds and the two escalation gotchas |
| Frontend data agent | §9 (JSON) | `src/data/campus.json`, `src/data/warehouse.json` |

Fixed decisions, no menus: sim time is a float in **minutes since 00:00** of the demo day. The sim day is Saturday Sept 12, 2026 treated as a school day. Default seed is `2026`. Sim speed is **20×** (1 real second = 20 sim seconds) with a **×4 fast-forward** button; readings are emitted every **10 sim seconds** per node at all times (the production 5-min/30-s cadence from spec §3.3 is documented on screen but not simulated, because the demo has ~90 seconds to show a 20-minute front). Demo starts at sim **12:35** (every node Good; Field turns Moderate ~12 real seconds later).

---

## 2. The scripted day — beats

| Sim time | Real time at 20× from 12:35 | What happens | What the dashboard shows |
|---|---|---|---|
| 06:00–12:30 | (pre-history, reachable via the scrubber) | Calm. PM2.5 5–9 µg/m³ everywhere. Bus Loop bump 07:30–08:15 (+16, idling buses). Cafeteria kitchen bump 11:15–12:15 (+22 PM, +140 MQ-2 counts; Cafeteria shows Moderate over lunch). Outdoor temp 11 → 18 °C. | All green. Decision card "Outdoor practice: OK". |
| 12:35 | 0:00 | **Demo start.** Every node Good (5.5–8.3). | All green. |
| 12:39–12:55 | 0:12–1:00 | Pre-front haze: sky PM2.5 7 → 20. Field Moderate at 12:39, Bus Loop 12:41, Hub 12:48, Science Wing 12:51. Field and Bus Loop reach USG at ~12:54. | Outdoor nodes yellow, then orange; indoor nodes follow. |
| 12:56–12:57 | 1:03–1:06 | Field crosses 55.5 (Unhealthy) with 5-min rise > 40; reads **71 at 12:57**. | Decision card flips: **"Cancel outdoor practice · PM2.5 71 at Field"** (ACTIVITY_ADVISORY). |
| **13:00** | 1:15 | **Front midpoint at the Bus Loop** (logistic centre, τ = 3.2 min, 10→90 % over ~14 min). Sweeps NW: Field (lag 1.0), Cafeteria (1.5), Main Hall (2.5), Hub and Portables (3.0), Gym (3.5), Science Wing (4.5). | Nodes go red in that order ~10 s apart. Field and Bus Loop Very Unhealthy at 13:00, Hub 13:07. |
| 13:07 | 1:36 | Field crosses 225.5 with neighbour median 156 → **HAZARDOUS_SMOKE**. Bus Loop follows at 13:10. | Field and Bus Loop hazardous. SMS outbox fills: Field zone and Bus Loop zone recipients. |
| 13:15–16:30 | 2:00–~12:00 | Plateau: sky ~185–210 (±10 % wobble, 55-min period). Campus median 175–185. Science Wing stays ~110 (filtered HVAC) and only reaches Very Unhealthy for a moment at 15:09. | Stable red campus; Science Wing is visibly the best room. Operator fast-forwards here. |
| **operator trigger** (default 14:05) | any time | **Gym fire.** Smoulder 1.5 min, flaming growth to PMS5003 saturation (999) by +5 min, +28 °C at the node, MQ-2 +1400, RH collapses 47 → 9 %. Hub and Main Hall get ~+30 µg/m³ of leaked ceiling smoke 5–6 min later. | Gym alone spikes. Engine: **LOCAL_FIRE at Gym** ~2 min 10 s after ignition (see §10 for the 40-second HAZARDOUS_SMOKE prelude). Neighbours flat relative to it: the sky-vs-room line lands. |
| +8 min after ignition | | Knockdown: PM decays with 4-min time constant, temp 6-min, MQ-2 5-min. | Gym clears to the regional level over ~10 min. |
| 16:30–18:00 | | Marine push thins smoke: sky 200 → 125 (18-min logistic). Outdoor battery nodes have been draining all afternoon (smoke cuts solar 60 %). | Bands drop to Very Unhealthy / Unhealthy. Field battery shows **~22 %** by 18:00 if the node has been in alert mode since 13:10 (57 % if not). |

The day is compressed: a real Puget Sound smoke onset takes 2–6 hours, not 20 minutes (§6.1). The **shape** is what's preserved.

---

## 3. Campus: Ravenna Ridge High School (fictional)

A fictional campus in the Roosevelt/Ravenna area of north Seattle. Not a real school; do not use a real school's name or footprint. Single 1000×700 SVG coordinate space, north up, **0.4 m per px** (campus ≈ 400 × 280 m). Geo anchor: SVG (0, 0) = **47.6820, -122.3240**.

```
lat = 47.6820 - y * 0.4 / 111320
lng = -122.3240 + x * 0.4 / (111320 * cos(47.68°))      # = x * 5.336e-6
```

### 3.1 Nodes

| id | Label | SVG (x, y) | lat | lng | Placement | Power | Battery 06:00 | Smoke mult | Front lag (min) |
|---|---|---|---|---|---|---|---|---|---|
| `hub` | Hub / Office | 420, 488 | 47.68025 | -122.32176 | Front office, SW corner of the portico. **Gateway** (Ethernet to the edge server). Indoor. | mains | 100 | 0.75 | 3.0 |
| `main` | Main Hall | 560, 395 | 47.68058 | -122.32101 | Central corridor ceiling, east wing. Indoor, old HVAC, doors propped. | mains | 100 | 0.85 | 2.5 |
| `gym` | Gym | 250, 440 | 47.68042 | -122.32267 | Ceiling truss above the north bleachers. Indoor. **Fire scenario node.** | mains | 100 | 0.80 | 3.5 |
| `cafe` | Cafeteria | 755, 440 | 47.68042 | -122.31997 | Servery ceiling. Indoor; kitchen makeup air pulls outdoor smoke in. | mains | 100 | 0.90 | 1.5 |
| `sci` | Science Wing | 275, 205 | 47.68126 | -122.32253 | Second-floor corridor. Indoor, MERV-13 HVAC retrofit (2024). **Best air on campus.** | mains | 100 | 0.55 | 4.5 |
| `port` | Portables | 525, 215 | 47.68123 | -122.32120 | Pole between P1 and P2, under the eave. Semi-outdoor. | solar (55 % of panel sees sky) | 88 | 1.00 | 3.0 |
| `field` | Field | 830, 320 | 47.68085 | -122.31957 | Press-box roof on the south bleachers. Outdoor. **Worst air: open, downwind of the arterial, first sun but panel faces the bleachers.** | solar (20 %) | 62 (tired 2300 mAh cell) | 1.30 | 1.0 |
| `bus` | Bus Loop | 870, 578 | 47.67992 | -122.31936 | Shelter roof on the loop island. Outdoor. **First node the front reaches.** | solar (50 %) | 94 | 1.15 | 0.0 |

SSID pattern: `SENTINEL-<ID>` (e.g. `SENTINEL-GYM`). Emergency rename: `!! EVACUATE - SENTINEL-GYM`.

Zones (alert fan-out units, spec §9): `office`, `main-hall`, `gym`, `cafeteria`, `science`, `portables`, `field`, `bus-loop`. Registered-phone counts for the SMS outbox demo: field 212 (parents of athletes), bus-loop 340, others 40–90.

### 3.2 Building footprints (polygon point lists, SVG px)

Draw order: ground → roads → parking → field → buildings → connectors → trees → walkways → labels → nodes.

| Element | Type | Points / geometry |
|---|---|---|
| Main Hall | polygon | `360,330 640,330 640,470 600,470 600,505 400,505 400,470 360,470` (portico juts south between x 400–600) |
| Gym | polygon | `160,360 330,360 330,525 160,525` |
| Gym ↔ Main Hall connector | polygon | `330,420 360,420 360,450 330,450` |
| Cafeteria | polygon | `670,380 850,380 850,500 670,500` |
| Main Hall ↔ Cafeteria connector | polygon | `640,400 670,400 670,430 640,430` |
| Science Wing | polygon | `150,140 400,140 400,270 150,270` |
| Science ↔ Main Hall covered walk | polygon | `370,270 400,270 400,330 370,330` |
| Portable P1 | rect | `x=455 y=165 w=60 h=40` |
| Portable P2 | rect | `x=535 y=165 w=60 h=40` |
| Portable P3 | rect | `x=455 y=225 w=60 h=40` |
| Portable P4 | rect | `x=535 y=225 w=60 h=40` |
| Bus shelter | rect | `x=845 y=565 w=50 h=25` |
| Bleachers / press box | rect | `x=760 y=305 w=140 h=30` |
| Field (turf) | ellipse | `cx=810 cy=200 rx=140 ry=95` |
| Track, outer | ellipse (stroke only) | `cx=810 cy=200 rx=140 ry=95` |
| Track, inner | ellipse (stroke only) | `cx=810 cy=200 rx=118 ry=73` |
| Goal posts | lines | `(700,200)-(700,185)` and `(920,200)-(920,185)`, 2 px |
| Plaza (front of Main Hall) | rect, faint | `x=400 y=505 w=200 h=55` |
| Parking, SW | rect + stall lines | `x=60 y=560 w=270 h=75`; stall lines every 18 px from x=78, y 560–635, 0.5 px |
| South street ("NE Ridge St") | rect | `x=0 y=645 w=1000 h=55`; dashed centreline at y=672 |
| East street ("25th Ave NE") | rect | `x=960 y=0 w=40 h=645`; dashed centreline at x=980 |
| Campus drive (street → bus loop) | rect | `x=855 y=628 w=30 h=22` |
| Bus loop road | ellipse, stroke 14 px | `cx=870 cy=590 rx=85 ry=40` |
| Bus loop island | ellipse fill | `cx=870 cy=590 rx=70 ry=28` |
| Walkways (0.75 px, muted) | polylines | `500,505 500,560` · `330,435 250,525 195,560` · `850,440 870,440 870,550` · `640,415 700,380 760,340` · `400,300 525,300 525,265` · `385,300 385,330` |

Street names are fictional. Do not use real addresses.

### 3.3 Tree clusters (circles; fill only, two tones alternated)

```
West belt:    (75,150,16) (98,178,13) (70,215,18) (95,250,12) (72,290,15) (100,320,11)
Gym/Science:  (205,300,14) (235,318,10) (300,305,12)
North edge:   (430,95,14) (470,80,11) (640,90,15) (620,120,10)
Cafeteria E:  (905,395,13) (930,430,10) (905,470,14) (935,510,11)
Field NE:     (955,110,9) (940,140,11)    # clipped by east street edge, fine
Portables S:  (470,300,10) (600,300,12)
Parking edge: (45,540,12) (345,550,11)
```

### 3.4 Labels

Uppercase, 10 px, letter-spacing 0.12 em, muted ink, placed inside footprints top-left with 8 px inset. Field label on the turf at (810, 200), centred. Street names along the road bands in 9 px. Show the compass rose at (40, 40) and the scale bar "50 m = 125 px" at (40, 670) over the street band.

### 3.5 Rendering notes for the dark map

The page's design tokens come from the DESIGN doc; the map needs these semantic slots, with fallbacks if the token is missing:

| Slot | Fallback | Used for |
|---|---|---|
| `--map-ground` | `#0B0F14` | SVG background |
| `--map-road` | `#0E1217` fill, `#1F2A36` dashed centreline | roads, drive, parking |
| `--map-building` | `#141A22` fill, `#26303B` 1 px stroke | footprints, connectors |
| `--map-turf` | `#0F1A14` fill, `#1E3A2A` stroke | field, bus island |
| `--map-track` | `#1A2230` stroke 6 px | track ellipses |
| `--map-tree` | `#11201A` / `#0F1B16` | tree circles (alternate tones) |
| `--map-label` | `#6B7A8C` | all text |
| band colours | good `#22C55E`, moderate `#EAB308`, usg `#F97316`, unhealthy `#EF4444`, very_unhealthy `#A855F7`, hazardous `#7F1D1D` | node halos, legend |

Node glyph: 6 px core dot in band colour, 18 px soft halo at 25 % opacity, 30 px pulsing ring when the node is in any alert state. Gateway (`hub`) gets a square core instead of a dot. Dead/low-battery nodes (Field by 17:30 in alert mode) get a hollow core and an amber battery badge.

LoRa links: draw every edge from §4 as a 1 px line, opacity = `0.15 + 0.35 * quality`. A hop animation is a 4 px dot travelling the edge in 350 ms; a dropped packet is the dot fading at 60 % of the edge with a small `×`. The hop path is the path of the **first copy to reach the hub** (flooding), see §4.2.

---

## 4. LoRa mesh graph (campus)

Flooding mesh with de-duplication, TTL 8, gateway = `hub` (spec §3.3). Link `quality` ∈ [0, 1] is the per-hop delivery probability; **`p_drop = 1 - quality`**. Mean over all links is 0.886, so the system-wide drop rate lands near the 15 % the spec asks for once multi-hop paths are counted.

### 4.1 Edges

| a | b | quality | Distance | Why this number |
|---|---|---|---|---|
| hub | main | 0.97 | 67 m | same building |
| hub | gym | 0.92 | 70 m | one wall, connector |
| hub | cafe | 0.85 | 137 m | through the whole Main Hall |
| hub | bus | 0.90 | 182 m | clear line across the plaza and drive |
| main | cafe | 0.93 | 80 m | connector |
| main | sci | 0.80 | 137 m | covered walk, two floors of brick |
| main | port | 0.88 | 73 m | across the north lawn |
| main | gym | 0.90 | 125 m | interior |
| sci | port | 0.94 | 100 m | lawn, line of sight |
| sci | gym | 0.75 | 94 m | tree belt between them |
| port | field | 0.86 | 128 m | lawn to bleachers |
| cafe | field | 0.91 | 57 m | short, outdoor |
| cafe | bus | 0.88 | 71 m | across the drive |
| field | bus | 0.82 | 104 m | hedge and shelter roof |

### 4.2 Expected first-arrival paths to the hub (for the hop animation)

Path score = product of qualities; ties broken by fewer hops. Flooding means any path can win on a given message; these are the typical ones and what the animation should default to when a message is delivered.

| Origin | Path | P(delivered on this path) | Alternatives the flood will also try |
|---|---|---|---|
| main | main → hub | 0.97 | — |
| gym | gym → hub | 0.92 | gym → main → hub (0.87) |
| cafe | cafe → main → hub | 0.90 | cafe → hub (0.85), cafe → bus → hub (0.79) |
| bus | bus → hub | 0.90 | bus → cafe → main → hub (0.79) |
| port | port → main → hub | 0.85 | port → sci → main → hub (0.73) |
| field | field → cafe → main → hub | 0.82 | field → cafe → hub (0.77), field → bus → hub (0.74) |
| sci | sci → main → hub | 0.78 | sci → gym → hub (0.69), sci → port → main → hub (0.80) |

Demo beat (spec §10.3 step 4): judge's report enters at **Field** (the muster point) and hops field → cafe → main → hub. With P ≈ 0.82 per attempt and a 30-sim-second retry, the hop log will occasionally show one drop and retry, which is exactly what the spec wants judges to see. Make the UDP mesh call `packet_dropped(a, b, msg_id)` from §8 so a given message drops deterministically on replay.

### 4.3 RSSI

`rssi_mean = -50 - 80 × (1 - quality)` dBm → hub←main −52, sci←gym −70. Jitter: N(0, 2.5 dB) per 10-second bucket, plus a 5 % chance of an 8–16 dB multipath fade. A node's reported `rssi` is the best RSSI among its neighbours that tick (a node with no neighbours reports −130 and the dashboard flags it). Range: −45 to −95 in practice; show the fleet view bar as `clamp((rssi + 100) / 55, 0, 1)`.

---

## 5. Warehouse: Harbor Island Logistics, Building C (fictional)

Second tenant for the §8.3 floor-plan view. 1000×600 SVG, **0.1 m per px**, so the building is 92 × 52 m ≈ 51,000 sq ft. Geo anchor SVG (0,0) = **47.5795, -122.3530** (Harbor Island industrial area). 12 rack aisles running north–south, one east–west cross-aisle, staging along the south wall with 12 dock doors, office block on the east wall. 6 nodes is pilot coverage of the high-value racks (spec §3.7 asks for ~1 per 2,500–4,000 sq ft, so the full build-out is 14–16; say so on the screen).

### 5.1 Geometry

| Element | Geometry |
|---|---|
| Building outline | rect `x=40 y=40 w=920 h=520`, 2 px stroke, no fill difference from ground (floor is `--map-building`) |
| Office block | rect `x=860 y=60 w=90 h=240`; internal walls at y=140 and y=220 |
| Aisle *i* (1..12) | `x0 = 70 + (i-1)*64`. Rack A: `x0, 100, 20, 350`. Aisle walkway centre `x0 + 32`. Rack B: `x0+44, 100, 20, 350`. |
| Cross-aisle | gap in every rack at y 260–290 (racks are drawn as two runs: y 100–260 and y 290–450) |
| Bays | A 100–140, B 140–180, C 180–220, D 220–260, E 290–330, F 330–370, G 370–410, H 410–450 (40 px = 4 m each). Label racks `7C` etc. on hover only. |
| Staging / pick area | rect `x=70 y=470 w=768 h=70`, faint hatch |
| Dock doors (12) | rects `x = 90 + k*60, y=548, w=36, h=12` for k = 0..11 |
| Column grid | 4 px squares every 128 px in x (70, 198, …) at y = 275 and y = 460 |

### 5.2 Nodes

| id | Label | SVG | lat | lng | Covers | Power |
|---|---|---|---|---|---|---|
| `w1` | Aisles 1–2 | 134, 275 | 47.57925 | -122.35282 | aisles 1–2 | mains |
| `w2` | Aisles 3–4 | 262, 275 | 47.57925 | -122.35265 | aisles 3–4 | mains |
| `w3` | Aisles 5–6 | 390, 275 | 47.57925 | -122.35248 | aisles 5–6 | mains |
| `w4` | Aisles 7–8 | 518, 275 | 47.57925 | -122.35231 | aisles 7–8 · **nearest to the fire** | mains |
| `w5` | Aisles 9–10 | 646, 275 | 47.57925 | -122.35214 | aisles 9–10 | mains |
| `w6` | Office wall / Gateway | 850, 275 | 47.57925 | -122.35187 | aisles 11–12 · **gateway**, Ethernet | mains |

All nodes hang from the cross-aisle ceiling trusses at y = 275, which is why they share a latitude.

Links: w1–w2 0.96, w2–w3 0.95, w3–w4 0.95, w4–w5 0.94, w5–w6 0.93 (neighbours), w1–w3 0.80, w2–w4 0.82, w3–w5 0.80, w4–w6 0.78 (skip-one, through steel racks). Typical path w1 → gateway: w1→w3→w5→w6, P ≈ 0.59, so warehouse messages visibly retry more than campus ones. Good: it motivates the full build-out line.

### 5.3 Scenario: pallet fire, aisle 7 bay C

Fire point SVG (486, 200). `w4` is 8.2 m away. Curve (§8 `warehouse_pm25`, `warehouse_temp`): baseline 9 ± 2 µg/m³ with forklift texture; at ignition `w4` gets +15 over 2 min (smoulder) then +700 by +5 min; temperature climbs ~4 °C/min through +3 to +4.5 min to +24 °C; `w3`/`w5` get +140 from +7 min (smoke spreading under the roof deck), `w2`/`w6` +40 from +10 min. Engine output is LOCAL_FIRE at `w4` about 3 min after ignition, which is the pitch line: "aisle 7, rack row C, temperature rising 4 °C per minute" (spec §1.4). The floor-plan heat-map should interpolate PM2.5 with inverse-distance weighting over the six nodes, clamped to the building rect; the localisation callout is the centroid of the fire node and any neighbour above 100 µg/m³, weighted by reading.

Warehouse has no wildfire-smoke day (indoor, closed dock doors); its one scenario is the fire. This is the **stretch** site: build the campus first.

---

## 6. Curve design and why it looks like this

### 6.1 What real Seattle smoke days looked like (research)

Sources consulted this morning; specific hourly figures marked as approximate where the source gives categories instead of numbers.

- **September 2020 (Labor Day fires).** Puget Sound Clean Air Agency: "In September of 2020, we recorded the highest ever fine particle levels since we started monitoring for them in 1999"; unhealthy fine-particle days ran Sept 8–18, with the agency's 25 µg/m³ daily health goal exceeded on up to 12 days at individual monitors. [PSCAA 2020 Data Summary](https://pscleanair.gov/640/2020-Data-Summary)
- Washington Ecology's narrative of the same event: east winds on Sept 8 brought the first smoke to the Seattle area, with Seattle, Shoreline and Bellevue in "very unhealthy" by **mid-morning Sept 8**; Sept 10 a wind shift pushed the offshore Oregon plume back onshore and cooler air "mixed it down to ground level"; Sept 13–16 it **stagnated** under an inversion because the smoke itself blocked sunlight ("wintertime-like inversions"); a front with rain arrived **Sept 17** and clearing went west to east over Sept 18–21. [Ecology, "A smoky siege"](https://ecology.wa.gov/blog/september-2020/a-smoky-siege); [KING 5 Sept 8 2020](https://www.king5.com/article/weather/weather-impact/wildfire-smoke-lower-air-quality-western-washington/281-ecb1346d-da70-4b40-a812-8f025c130f40)
- **October 2022 (Bolt Creek fire).** Seattle ranked worst air quality of any major city in the world on Oct 19 and 20, 2022, AQI "over 240" (Very Unhealthy; AQI 240 ≈ 190 µg/m³ PM2.5 on the 2022 index). [Seattle Times](https://www.seattletimes.com/seattle-news/environment/seattle-air-quality-among-worst-in-world/); [Deseret News](https://www.deseret.com/2022/10/20/23414889/seattle-worst-air-quality/); [Washington Post](https://www.washingtonpost.com/climate-environment/2022/10/20/seattle-air-quality-worst-in-world/); [Wikipedia, Bolt Creek fire](https://en.wikipedia.org/wiki/Bolt_Creek_fire)
- The Washington Smoke Blog described the Oct 2022 pattern as a day–night **"sloshing"**: mountain drainage winds pushed smoke west into the lowlands after dark, with "modest clearing during the daytime hours", until the rain of Oct 20–21 ended it. [WA Smoke Blog 2022](https://wasmoke.blogspot.com/2022/)
- Approximate (not found as a citable number this morning, verify before saying it on stage): hourly PM2.5 at Seattle monitors during Sept 12–13, 2020 exceeded ~250 µg/m³; Oct 19–20, 2022 hourly peaks were in the 150–200 range.

What those events have in common, and what the generator reproduces:

1. **A front, not a ramp.** Onset is sigmoidal: hours of near-normal readings, then a 2–6 hour climb to a plateau. We use a logistic with τ = 3.2 sim-minutes instead of τ ≈ 60 real minutes. Same shape, 20× faster, because the demo has 90 seconds.
2. **A wobbling plateau, not a flat line.** Stagnation days wander ±10–15 % over an hour as the inversion breathes. We add a ±10 % sine with a 55-minute period plus 1/f-ish drift.
3. **Hyperlocal spread.** The spec's whole premise (§1.1). Outdoor nodes read 1.15–1.30× the regional number; unfiltered buildings 0.75–0.90×; a filtered building ~0.55×. Indoor/outdoor ratios of 0.3–0.7 during smoke events are well documented for buildings without enhanced filtration; we sit at the leaky end because it is an old school with doors propped open.
4. **Slow clearing.** Marine push or rain clears over hours (here an 18-minute logistic starting 16:30), never a step.
5. **Sun loss.** Thick smoke cut insolation enough in 2020 to make inversions; we cut panel output 60 % and knock 1.5 °C off the afternoon high.

### 6.2 PM2.5 per node

```
sky(t)        = base + haze(t) + (plateau - base)·σ((t - t_front)/τ) + wobble(t) - clear(t)
node_pm(t)    = base·(0.8 if indoor else 1.0) + (sky(t - lag) - base)·mult
              + texture bumps (bus exhaust, kitchen)
              + fire component
              + drift (4 % of level) + white noise (2.5 % of level + 0.4)
clamped to [0, 999]        # PMS5003 effective upper range
```

`pm1 = 0.62·pm25`, `pm10 = 1.18·pm25` (wildfire smoke is fine-mode dominated; these ratios are typical and constant enough for a demo).

### 6.3 Temperature and humidity

Outdoor: `15.5 + 4.5·cos(2π(t - 16:00)/24h)` → 11.6 °C at 06:00, 18.5 °C at 16:00 after the smoke penalty. Indoor: setpoint 21 °C + per-node offset, +1.2 °C drift through the afternoon, 1.5 °C night setback before 07:00. RH outdoor: `67 - 19·cos(...)` → 86 % at dawn, 48 % mid-afternoon. Indoor 48 % falling to 44 %. Fire: absolute humidity held constant, so `RH *= exp(-0.058·ΔT)`; at +28 °C the gym reads ~9 % RH, which is a real and underused fire signature.

### 6.4 MQ-2

Raw ADC counts 0–4095. Baselines 310–520 per node (cafeteria highest: gas range). Wildfire smoke adds 0.5 counts per µg/m³ above baseline (MQ-2 responds weakly to smoke organics; this keeps `gas_delta` under ~110 during the smoke day so it never contributes to a false LOCAL_FIRE). Kitchen bump +140 at lunch. Fire: +1400 lagging PM by ~30 s. Drift ±12, white ±6. Engine `gas_delta` threshold: **400**.

### 6.5 Fire curve (gym)

| τ (min after ignition) | PM2.5 | Temp | RH | MQ-2 |
|---|---|---|---|---|
| 0 | 160 | 23.2 | 47 | 487 |
| 1 | 209 | 24.5 | 43 | 509 |
| 2 | 294 | 30.0 | 31 | 584 |
| 3 | 585 | 42.2 | 15 | 900 |
| 4 | 938 | 49.1 | 11 | 1459 |
| 5 | 999 (saturated) | 50.6 | 9 | 1789 |
| 8 (knockdown) | 999 | 50.6 | 9 | 1880 |
| 10 | 772 | 42.9 | 13 | 1419 |
| 14 | 367 | 33.0 | 25 | 905 |

Rule replay (spec §6.2, 10-second ticks, regional = median of graph neighbours, `gas_delta > 400`): **LOCAL_FIRE first fires at τ ≈ 2:10** with pm_rise(5 min) = 189, temp_rise(2 min) = 8.8, pm = 360 vs regional 157. Before that, between τ ≈ 1:30 and 2:10, the gym satisfies the HAZARDOUS_SMOKE branch (pm > 225.5 and regional > 150) because the room is already sitting at ~155 from the sky. See §10.

### 6.6 Battery

Solar nodes only (indoor nodes are mains and report 100 %). Integrated in 5-minute steps from 06:00: draw 47 mA normal (spec §3.6 averaged), 215 mA in alert mode (AP fully up, sensors continuous); charge = `2 W × solar_factor × 0.85 / 4.2 V`, solar is a half-sine from 06:45 to 19:25 cut by 60 % once the smoke is in. Cell 3400 mAh except Field (2300 mAh, tired). Results: Field 62 → 57 % by 18:00 on a normal day, **→ 22 % if in alert mode from 13:10** (the fleet view gets a real low-battery warning during the demo); Bus Loop and Portables hover 79–100 %.

### 6.7 Noise philosophy

All randomness is hashed from `(seed, node, channel, 10-second bucket)`, so two simulator processes, or a replay, produce identical readings and identical packet drops without sharing state. No RNG is stepped; call order does not matter.

---

## 7. Simulator contract

The simulator agent owns the tick loop; this is what it must do with §8:

1. `t = 12*60 + 35` at start; every real second: `t += 20 / 60 * speed_multiplier` (speed 1 or 4), emit `reading(node_id, t, scenario, alert_since)` for all 8 nodes every 10 sim-seconds (so 2 emits/real-second/node at 1×).
2. `POST /ingest/telemetry` with the reading dict plus `ts` (ISO 8601 UTC derived from `t` on 2026-09-12) and `site_id: "rrhs"`. The reading already carries `band` and `simulated: true`.
3. Mesh messages (incidents, button presses) travel the §4 graph over local UDP: each node rebroadcasts unseen `msg_id` after 10–200 ms back-off; for each edge call `packet_dropped(a, b, msg_id)`; log every hop as `{msg_id, from, to, hop, dropped, rssi}` and POST to `/ingest/mesh-message` when a copy reaches `hub`. Retry from the origin every 30 sim-seconds until acked, max 6.
4. Operator endpoints on the simulator (not the backend): `POST /sim/speed {1|4}`, `POST /sim/fire {node?: "gym"}` sets `scenario.fire_start_min = t`, `POST /sim/fire/out` sets `fire_out_min = t`, `POST /sim/reset`, `POST /sim/seek {minute}`.
5. `alert_since_min` for battery: set to the first `t` at which the backend reports any alert for that node; the simulator may approximate it as the first tick the node's `band` is `unhealthy` or worse.
6. Warehouse: same loop, `warehouse_pm25/temp`, 6 nodes, `site_id: "hil-c"`, only when the `/admin?site=hil-c` view is open (flag `--warehouse`).

---

## 8. Generator code — `simulator/world.py`

Pure Python 3.11+, stdlib only. Verified this morning: `python3 world.py` prints the campus JSON in §9; the §2 and §6.5 tables came from replaying the spec §6.2 rules over this module at 10-second resolution.

```python
"""Sentinel simulated world: node definitions, LoRa graph, scripted-day curves.

Pure functions. Everything is deterministic given (seed, node_id, sim_minute).
No numpy. Sim time `t` is a float: minutes since 00:00 of the demo day.
"""
from __future__ import annotations

import json
import math
import random
import zlib
from dataclasses import dataclass, asdict, field

# --------------------------------------------------------------------------- #
# Campus: Ravenna Ridge High School (fictional), SVG space 1000x700, 0.4 m/px
# --------------------------------------------------------------------------- #
SVG_ORIGIN_LAT, SVG_ORIGIN_LNG = 47.6820, -122.3240
M_PER_PX = 0.4
LAT_PER_PX = M_PER_PX / 111_320
LNG_PER_PX = M_PER_PX / (111_320 * math.cos(math.radians(47.68)))


def svg_to_latlng(x: float, y: float) -> tuple[float, float]:
    return (round(SVG_ORIGIN_LAT - y * LAT_PER_PX, 5),
            round(SVG_ORIGIN_LNG + x * LNG_PER_PX, 5))


@dataclass(frozen=True)
class NodeDef:
    id: str
    label: str
    x: int
    y: int
    zone: str
    indoor: bool
    power: str            # "solar" | "mains"
    battery0: float       # % at 06:00
    smoke_mult: float     # node PM2.5 / regional sky PM2.5 during smoke
    smoke_lag_min: float  # minutes after the front reaches the Bus Loop
    temp_offset: float    # °C added to indoor setpoint / outdoor curve
    mq2_base: int         # ADC counts (0-4095)
    solar_factor: float = 0.0  # fraction of the 2 W panel that actually sees sky (shade, tilt, dirt)
    is_gateway: bool = False


NODES: tuple[NodeDef, ...] = (
    NodeDef("hub",   "Hub / Office",  420, 488, "office",    True,  "mains", 100.0, 0.75, 3.0,  0.0, 360, 0.0, True),
    NodeDef("main",  "Main Hall",     560, 395, "main-hall", True,  "mains", 100.0, 0.85, 2.5, -0.5, 380),
    NodeDef("gym",   "Gym",           250, 440, "gym",       True,  "mains", 100.0, 0.80, 3.5,  1.0, 400),
    NodeDef("cafe",  "Cafeteria",     755, 440, "cafeteria", True,  "mains", 100.0, 0.90, 1.5,  1.5, 520),
    NodeDef("sci",   "Science Wing",  275, 205, "science",   True,  "mains", 100.0, 0.55, 4.5, -1.0, 340),
    NodeDef("port",  "Portables",     525, 215, "portables", False, "solar",  88.0, 1.00, 3.0,  0.0, 330, 0.55),
    NodeDef("field", "Field",         830, 320, "field",     False, "solar",  62.0, 1.30, 1.0,  0.0, 310, 0.20),
    NodeDef("bus",   "Bus Loop",      870, 578, "bus-loop",  False, "solar",  94.0, 1.15, 0.0,  0.5, 450, 0.50),
)
NODE_BY_ID = {n.id: n for n in NODES}

# LoRa links: (a, b, quality 0..1). p_drop = 1 - quality. Flooding mesh, gateway = hub.
LINKS: tuple[tuple[str, str, float], ...] = (
    ("hub", "main", 0.97), ("hub", "gym", 0.92), ("hub", "cafe", 0.85), ("hub", "bus", 0.90),
    ("main", "cafe", 0.93), ("main", "sci", 0.80), ("main", "port", 0.88), ("main", "gym", 0.90),
    ("sci", "port", 0.94), ("sci", "gym", 0.75),
    ("port", "field", 0.86),
    ("cafe", "field", 0.91), ("cafe", "bus", 0.88),
    ("field", "bus", 0.82),
)


def neighbours(node_id: str) -> list[tuple[str, float]]:
    out = []
    for a, b, q in LINKS:
        if a == node_id:
            out.append((b, q))
        elif b == node_id:
            out.append((a, q))
    return out


def link_quality(a: str, b: str) -> float:
    for x, y, q in LINKS:
        if {x, y} == {a, b}:
            return q
    return 0.0


# --------------------------------------------------------------------------- #
# Deterministic noise
# --------------------------------------------------------------------------- #
def _rng(seed: int, *keys) -> random.Random:
    h = zlib.crc32(("|".join(map(str, keys))).encode()) ^ (seed * 0x9E3779B1 & 0xFFFFFFFF)
    return random.Random(h)


def white(seed: int, node_id: str, channel: str, t: float, sigma: float) -> float:
    """Gaussian noise, stable for a given (seed, node, channel, 10-second bucket)."""
    bucket = int(round(t * 6))  # 10-second buckets
    return _rng(seed, node_id, channel, bucket).gauss(0.0, sigma)


def drift(seed: int, node_id: str, channel: str, t: float, amp: float) -> float:
    """Slow 1/f-ish wander: three sines with node-specific phases. Period in minutes."""
    r = _rng(seed, node_id, channel, "phase")
    p1, p2, p3 = (r.uniform(0, 2 * math.pi) for _ in range(3))
    return amp * (0.55 * math.sin(2 * math.pi * t / 47 + p1)
                  + 0.30 * math.sin(2 * math.pi * t / 13 + p2)
                  + 0.15 * math.sin(2 * math.pi * t / 4.3 + p3))


def logistic(x: float) -> float:
    if x < -40:
        return 0.0
    if x > 40:
        return 1.0
    return 1.0 / (1.0 + math.exp(-x))


def bump(t: float, start: float, end: float, peak: float) -> float:
    """Smooth half-sine bump between start and end minutes, height `peak`."""
    if t <= start or t >= end:
        return 0.0
    return peak * math.sin(math.pi * (t - start) / (end - start))


# --------------------------------------------------------------------------- #
# Scenario
# --------------------------------------------------------------------------- #
H = 60.0  # minutes per hour, for readability: 13 * H == 13:00


@dataclass
class Scenario:
    seed: int = 2026
    smoke_front_min: float = 13 * H          # front reaches the Bus Loop node
    smoke_tau_min: float = 3.2               # logistic time constant (10-90 % in ~14 min)
    smoke_plateau: float = 185.0             # regional outdoor PM2.5 at plateau, ug/m3
    smoke_clear_start_min: float = 16.5 * H  # marine push begins
    smoke_clear_floor: float = 110.0         # where it settles by 18:00
    fire_node: str = "gym"
    fire_start_min: float | None = None      # None = no fire; operator sets e.g. 14*H + 5
    fire_out_min: float | None = None        # None = burns until fire_start + 8 min
    baseline_pm: float = 7.0


DEFAULT = Scenario()


# --------------------------------------------------------------------------- #
# Regional "sky" PM2.5 (what a county monitor would read), before node effects
# --------------------------------------------------------------------------- #
def sky_pm25(t: float, sc: Scenario = DEFAULT) -> float:
    base = sc.baseline_pm
    # faint pre-front haze: the smell arrives before the monitors move
    haze = 8.0 * logistic((t - (sc.smoke_front_min - 12)) / 3.5)
    rise = (sc.smoke_plateau - base) * logistic((t - sc.smoke_front_min) / sc.smoke_tau_min)
    # plateau drift: real plateaus wander +/-10 %
    plateau_wobble = 0.10 * sc.smoke_plateau * math.sin(2 * math.pi * (t - sc.smoke_front_min) / 55.0) \
        * logistic((t - sc.smoke_front_min - 12) / 3.0)
    # late-afternoon marine push thins it (Sept 2020 Sep 17-18 / Oct 2022 Oct 21 pattern, compressed)
    clear = (sc.smoke_plateau - sc.smoke_clear_floor) * logistic((t - sc.smoke_clear_start_min) / 18.0)
    return max(0.0, base + haze + rise + plateau_wobble - clear)


# --------------------------------------------------------------------------- #
# Fire component (added on top of the smoke day), per node
# --------------------------------------------------------------------------- #
def _fire_tau(t: float, sc: Scenario) -> float | None:
    if sc.fire_start_min is None or t < sc.fire_start_min:
        return None
    return t - sc.fire_start_min


def fire_pm25(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    tau = _fire_tau(t, sc)
    if tau is None:
        return 0.0
    out = sc.fire_out_min if sc.fire_out_min is not None else sc.fire_start_min + 8.0
    if node_id == sc.fire_node:
        # smoulder 0-1.5 min, flaming growth to ~900 by 4.5 min, hold, then knockdown decay
        smoulder = 20.0 * min(tau, 1.5) / 1.5
        growth = 880.0 * logistic((tau - 3.0) / 0.55)
        v = smoulder + growth
    else:
        # neighbours: ceiling smoke leaks out 3 min later, small and slow
        q = link_quality(node_id, sc.fire_node)
        if q == 0.0:
            return 0.0
        leak = 0.25 if node_id in ("hub", "main") else 0.12
        v = 120.0 * leak * logistic((tau - 5.5) / 1.2)
    if t > out:
        v *= math.exp(-(t - out) / 4.0)
    return v


def fire_temp(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    tau = _fire_tau(t, sc)
    if tau is None or node_id != sc.fire_node:
        return 0.0
    out = sc.fire_out_min if sc.fire_out_min is not None else sc.fire_start_min + 8.0
    v = 0.5 * min(tau, 1.5) + 27.0 * logistic((tau - 2.6) / 0.5)  # +0.75 then +27 -> ~+28 C
    if t > out:
        v *= math.exp(-(t - out) / 6.0)
    return v


def fire_mq2(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    tau = _fire_tau(t, sc)
    if tau is None:
        return 0.0
    out = sc.fire_out_min if sc.fire_out_min is not None else sc.fire_start_min + 8.0
    if node_id == sc.fire_node:
        v = 1400.0 * logistic((tau - 3.5) / 0.6)  # lags PM by ~30 s
    elif node_id in ("hub", "main"):
        v = 90.0 * logistic((tau - 6.0) / 1.2)
    else:
        v = 0.0
    if t > out:
        v *= math.exp(-(t - out) / 5.0)
    return v


# --------------------------------------------------------------------------- #
# Per-node channels
# --------------------------------------------------------------------------- #
def pm25(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    n = NODE_BY_ID[node_id]
    sky = sky_pm25(t - n.smoke_lag_min, sc)
    # indoor nodes track the sky with the multiplier, but the building also has a floor of its own
    v = sc.baseline_pm * (0.8 if n.indoor else 1.0) + (sky - sc.baseline_pm) * n.smoke_mult
    # ordinary-day texture: bus drop-off/pick-up exhaust, cafeteria kitchen
    if node_id == "bus":
        v += bump(t, 7.5 * H, 8.25 * H, 16.0) + bump(t, 14.9 * H, 15.4 * H, 12.0)
    if node_id == "cafe":
        v += bump(t, 11.25 * H, 12.25 * H, 22.0)
    if node_id == "field":
        v += bump(t, 7 * H, 9 * H, 3.0)  # arterial rush hour, faint
    v += fire_pm25(node_id, t, sc)
    v += drift(sc.seed, node_id, "pm", t, 0.04 * max(v, 8.0))
    v += white(sc.seed, node_id, "pm", t, 0.025 * max(v, 8.0) + 0.4)
    return round(min(max(v, 0.0), 999.0), 1)  # PMS5003 effective range clamp


def outdoor_temp(t: float, sc: Scenario = DEFAULT) -> float:
    # Seattle mid-September: min 11 C at ~06:00, max ~20 C at ~16:00 (smoke trims the max)
    v = 15.5 + 4.5 * math.cos(2 * math.pi * (t - 16 * H) / (24 * H))  # 11 C at 04:00, 20 C at 16:00
    # smoke blocks sun: knock up to 1.5 C off once the plateau is in
    v -= 1.5 * logistic((t - sc.smoke_front_min - 20) / 10.0)
    return v


def temp_c(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    n = NODE_BY_ID[node_id]
    if n.indoor:
        # HVAC setpoint 21 C, building warms 1.2 C over the afternoon, setback before 07:00
        v = 21.0 + n.temp_offset + 1.2 * logistic((t - 13 * H) / 90.0) - 1.5 * logistic((7 * H - t) / 20.0)
    else:
        v = outdoor_temp(t, sc) + n.temp_offset
    v += fire_temp(node_id, t, sc)
    v += drift(sc.seed, node_id, "temp", t, 0.25)
    v += white(sc.seed, node_id, "temp", t, 0.08)
    return round(v, 2)


def rh_pct(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    n = NODE_BY_ID[node_id]
    if n.indoor:
        v = 48.0 - 4.0 * logistic((t - 13 * H) / 90.0)
    else:
        # outdoor: 86 % at dawn falling to ~48 % mid-afternoon, mirror of temperature
        v = 67.0 - 19.0 * math.cos(2 * math.pi * (t - 16 * H) / (24 * H))  # 86 % at 04:00, 48 % at 16:00
    # fire: absolute humidity roughly constant, RH collapses as T rises
    dT = fire_temp(node_id, t, sc)
    v *= math.exp(-0.058 * dT)
    v += drift(sc.seed, node_id, "rh", t, 1.2)
    v += white(sc.seed, node_id, "rh", t, 0.4)
    return round(min(max(v, 3.0), 100.0), 1)


def mq2_raw(node_id: str, t: float, sc: Scenario = DEFAULT) -> int:
    n = NODE_BY_ID[node_id]
    v = float(n.mq2_base)
    # MQ-2 responds weakly to wildfire smoke organics: +0.5 counts per ug/m3 of smoke above baseline
    v += 0.5 * max(pm25_smoke_only(node_id, t, sc) - sc.baseline_pm, 0.0)
    if node_id == "cafe":
        v += bump(t, 11.25 * H, 12.25 * H, 140.0)  # gas range, cooking
    if node_id == "bus":
        v += bump(t, 7.5 * H, 8.25 * H, 90.0)
    v += fire_mq2(node_id, t, sc)
    v += drift(sc.seed, node_id, "mq2", t, 12.0)
    v += white(sc.seed, node_id, "mq2", t, 6.0)
    return int(min(max(v, 0.0), 4095.0))


def pm25_smoke_only(node_id: str, t: float, sc: Scenario = DEFAULT) -> float:
    n = NODE_BY_ID[node_id]
    sky = sky_pm25(t - n.smoke_lag_min, sc)
    return sc.baseline_pm + (sky - sc.baseline_pm) * n.smoke_mult


def solar_w(t: float, sc: Scenario = DEFAULT) -> float:
    """Panel output 0..2 W; sunrise 06:45, sunset 19:25 on Sept 12 in Seattle; smoke cuts it."""
    rise, set_ = 6.75 * H, 19.42 * H
    if t <= rise or t >= set_:
        return 0.0
    v = 2.0 * math.sin(math.pi * (t - rise) / (set_ - rise))
    v *= 1.0 - 0.6 * logistic((t - sc.smoke_front_min - 10) / 8.0)  # thick smoke: ~40 % of clear-sky
    return v


def battery_pct(node_id: str, t: float, sc: Scenario = DEFAULT, alert_since_min: float | None = None) -> float:
    """Battery % at sim-minute t. Integrates from 06:00 in 5-minute steps (cheap, deterministic)."""
    n = NODE_BY_ID[node_id]
    if n.power == "mains":
        return 100.0
    cap_mah = 3400.0 if node_id != "field" else 2300.0  # Field has a tired cell
    b = n.battery0
    step = 5.0
    tt = 6 * H
    while tt < t:
        in_alert = alert_since_min is not None and tt >= alert_since_min
        draw_ma = 215.0 if in_alert else 47.0   # spec 3.6: ~47 mA normal incl. sensors, ~215 mA disaster
        charge_ma = solar_w(tt, sc) * n.solar_factor / 4.2 * 1000.0 * 0.85  # through TP4056 at ~85 %
        d_mah = (charge_ma - draw_ma) * (step / 60.0)
        b = min(100.0, max(0.0, b + 100.0 * d_mah / cap_mah))
        tt += step
    return round(b, 1)


def rssi_dbm(a: str, b: str, t: float, sc: Scenario = DEFAULT) -> int:
    """RSSI of a packet from a heard at b. Mean from link quality, gaussian jitter, occasional fade."""
    q = link_quality(a, b)
    if q == 0.0:
        return -130
    mean = -50.0 - 80.0 * (1.0 - q)
    r = _rng(sc.seed, a, b, "rssi", int(round(t * 6)))
    v = mean + r.gauss(0.0, 2.5)
    if r.random() < 0.05:
        v -= r.uniform(8.0, 16.0)  # multipath fade
    return int(round(v))


def packet_dropped(a: str, b: str, msg_id: str, sc: Scenario = DEFAULT) -> bool:
    q = link_quality(a, b)
    return _rng(sc.seed, a, b, msg_id).random() > q


# --------------------------------------------------------------------------- #
# Warehouse: Harbor Island Logistics, Building C (fictional). SVG 1000x600, 0.1 m/px
# --------------------------------------------------------------------------- #
WAREHOUSE = {
    "site": {"id": "hil-c", "name": "Harbor Island Logistics, Building C", "svg": [1000, 600],
             "m_per_px": 0.1, "origin_latlng": [47.5795, -122.3530], "aisles": 12,
             "bays": ["A", "B", "C", "D", "E", "F", "G", "H"]},
    "nodes": [
        {"id": "w1", "label": "Aisles 1-2",   "x": 134, "y": 275, "aisles": [1, 2],   "power": "mains", "mq2_base": 350},
        {"id": "w2", "label": "Aisles 3-4",   "x": 262, "y": 275, "aisles": [3, 4],   "power": "mains", "mq2_base": 360},
        {"id": "w3", "label": "Aisles 5-6",   "x": 390, "y": 275, "aisles": [5, 6],   "power": "mains", "mq2_base": 355},
        {"id": "w4", "label": "Aisles 7-8",   "x": 518, "y": 275, "aisles": [7, 8],   "power": "mains", "mq2_base": 370},
        {"id": "w5", "label": "Aisles 9-10",  "x": 646, "y": 275, "aisles": [9, 10],  "power": "mains", "mq2_base": 350},
        {"id": "w6", "label": "Office wall / Gateway", "x": 850, "y": 275, "aisles": [11, 12], "power": "mains",
         "mq2_base": 340, "is_gateway": True},
    ],
    "links": [
        {"a": "w1", "b": "w2", "quality": 0.96}, {"a": "w2", "b": "w3", "quality": 0.95},
        {"a": "w3", "b": "w4", "quality": 0.95}, {"a": "w4", "b": "w5", "quality": 0.94},
        {"a": "w5", "b": "w6", "quality": 0.93}, {"a": "w1", "b": "w3", "quality": 0.80},
        {"a": "w2", "b": "w4", "quality": 0.82}, {"a": "w3", "b": "w5", "quality": 0.80},
        {"a": "w4", "b": "w6", "quality": 0.78},
    ],
    "gateway": "w6",
    "fire": {"aisle": 7, "bay": "C", "x": 486, "y": 200, "nearest": "w4", "neighbours": ["w3", "w5"]},
}


def warehouse_pm25(node_id: str, t: float, fire_start_min: float | None, seed: int = 2026) -> float:
    """Indoor baseline ~9 ug/m3 with forklift/dust texture; pallet fire at aisle 7 bay C."""
    v = 9.0 + 2.0 * math.sin(2 * math.pi * t / 35.0)
    if fire_start_min is not None and t >= fire_start_min:
        tau = t - fire_start_min
        if node_id == "w4":
            v += 15.0 * min(tau, 2.0) / 2.0 + 700.0 * logistic((tau - 4.0) / 0.6)
        elif node_id in ("w3", "w5"):
            v += 140.0 * logistic((tau - 7.0) / 1.5)
        elif node_id in ("w2", "w6"):
            v += 40.0 * logistic((tau - 10.0) / 2.0)
    v += drift(seed, node_id, "wpm", t, 0.05 * max(v, 8.0))
    v += white(seed, node_id, "wpm", t, 0.03 * max(v, 8.0) + 0.4)
    return round(min(max(v, 0.0), 999.0), 1)


def warehouse_temp(node_id: str, t: float, fire_start_min: float | None, seed: int = 2026) -> float:
    v = 17.5 + 1.5 * logistic((t - 14 * H) / 120.0)  # unheated warehouse warms slowly through the day
    if fire_start_min is not None and t >= fire_start_min and node_id == "w4":
        tau = t - fire_start_min
        v += 0.4 * min(tau, 2.0) + 24.0 * logistic((tau - 3.6) / 0.5)  # ~4 C/min through the growth phase
    v += drift(seed, node_id, "wtemp", t, 0.2) + white(seed, node_id, "wtemp", t, 0.06)
    return round(v, 2)


def band(pm: float) -> str:
    if pm <= 9.0: return "good"
    if pm <= 35.4: return "moderate"
    if pm <= 55.4: return "usg"
    if pm <= 125.4: return "unhealthy"
    if pm <= 225.4: return "very_unhealthy"
    return "hazardous"


def reading(node_id: str, t: float, sc: Scenario = DEFAULT, alert_since_min: float | None = None) -> dict:
    n = NODE_BY_ID[node_id]
    pm = pm25(node_id, t, sc)
    best_rssi = max((rssi_dbm(other, node_id, t, sc) for other, _ in neighbours(node_id)), default=-130)
    return {
        "node_id": node_id,
        "sim_minute": round(t, 3),
        "pm1": round(pm * 0.62, 1),
        "pm25": pm,
        "pm10": round(pm * 1.18, 1),
        "temp_c": temp_c(node_id, t, sc),
        "rh": rh_pct(node_id, t, sc),
        "mq2_raw": mq2_raw(node_id, t, sc),
        "battery_pct": battery_pct(node_id, t, sc, alert_since_min),
        "rssi": best_rssi,
        "band": band(pm),
        "simulated": True,
    }


def export_nodes_json() -> str:
    nodes = []
    for n in NODES:
        lat, lng = svg_to_latlng(n.x, n.y)
        d = asdict(n)
        d.update({"lat": lat, "lng": lng, "ssid": f"SENTINEL-{n.id.upper()}"})
        nodes.append(d)
    return json.dumps({
        "site": {"id": "rrhs", "name": "Ravenna Ridge High School", "svg": [1000, 700], "m_per_px": M_PER_PX,
                 "origin_latlng": [SVG_ORIGIN_LAT, SVG_ORIGIN_LNG]},
        "nodes": nodes,
        "links": [{"a": a, "b": b, "quality": q} for a, b, q in LINKS],
        "gateway": "hub",
    }, indent=2)


def export_warehouse_json() -> str:
    lat0, lng0 = WAREHOUSE["site"]["origin_latlng"]
    mpp = WAREHOUSE["site"]["m_per_px"]
    nodes = []
    for n in WAREHOUSE["nodes"]:
        d = dict(n)
        d["lat"] = round(lat0 - n["y"] * mpp / 111_320, 5)
        d["lng"] = round(lng0 + n["x"] * mpp / (111_320 * math.cos(math.radians(47.58))), 5)
        d.setdefault("is_gateway", False)
        nodes.append(d)
    return json.dumps({**WAREHOUSE, "nodes": nodes}, indent=2)


if __name__ == "__main__":
    print(export_nodes_json())
```

---

## 9. JSON exports

### 9.1 `src/data/campus.json` (output of `export_nodes_json()`)

```json
{
  "site": {
    "id": "rrhs",
    "name": "Ravenna Ridge High School",
    "svg": [
      1000,
      700
    ],
    "m_per_px": 0.4,
    "origin_latlng": [
      47.682,
      -122.324
    ]
  },
  "nodes": [
    {
      "id": "hub",
      "label": "Hub / Office",
      "x": 420,
      "y": 488,
      "zone": "office",
      "indoor": true,
      "power": "mains",
      "battery0": 100.0,
      "smoke_mult": 0.75,
      "smoke_lag_min": 3.0,
      "temp_offset": 0.0,
      "mq2_base": 360,
      "solar_factor": 0.0,
      "is_gateway": true,
      "lat": 47.68025,
      "lng": -122.32176,
      "ssid": "SENTINEL-HUB"
    },
    {
      "id": "main",
      "label": "Main Hall",
      "x": 560,
      "y": 395,
      "zone": "main-hall",
      "indoor": true,
      "power": "mains",
      "battery0": 100.0,
      "smoke_mult": 0.85,
      "smoke_lag_min": 2.5,
      "temp_offset": -0.5,
      "mq2_base": 380,
      "solar_factor": 0.0,
      "is_gateway": false,
      "lat": 47.68058,
      "lng": -122.32101,
      "ssid": "SENTINEL-MAIN"
    },
    {
      "id": "gym",
      "label": "Gym",
      "x": 250,
      "y": 440,
      "zone": "gym",
      "indoor": true,
      "power": "mains",
      "battery0": 100.0,
      "smoke_mult": 0.8,
      "smoke_lag_min": 3.5,
      "temp_offset": 1.0,
      "mq2_base": 400,
      "solar_factor": 0.0,
      "is_gateway": false,
      "lat": 47.68042,
      "lng": -122.32267,
      "ssid": "SENTINEL-GYM"
    },
    {
      "id": "cafe",
      "label": "Cafeteria",
      "x": 755,
      "y": 440,
      "zone": "cafeteria",
      "indoor": true,
      "power": "mains",
      "battery0": 100.0,
      "smoke_mult": 0.9,
      "smoke_lag_min": 1.5,
      "temp_offset": 1.5,
      "mq2_base": 520,
      "solar_factor": 0.0,
      "is_gateway": false,
      "lat": 47.68042,
      "lng": -122.31997,
      "ssid": "SENTINEL-CAFE"
    },
    {
      "id": "sci",
      "label": "Science Wing",
      "x": 275,
      "y": 205,
      "zone": "science",
      "indoor": true,
      "power": "mains",
      "battery0": 100.0,
      "smoke_mult": 0.55,
      "smoke_lag_min": 4.5,
      "temp_offset": -1.0,
      "mq2_base": 340,
      "solar_factor": 0.0,
      "is_gateway": false,
      "lat": 47.68126,
      "lng": -122.32253,
      "ssid": "SENTINEL-SCI"
    },
    {
      "id": "port",
      "label": "Portables",
      "x": 525,
      "y": 215,
      "zone": "portables",
      "indoor": false,
      "power": "solar",
      "battery0": 88.0,
      "smoke_mult": 1.0,
      "smoke_lag_min": 3.0,
      "temp_offset": 0.0,
      "mq2_base": 330,
      "solar_factor": 0.55,
      "is_gateway": false,
      "lat": 47.68123,
      "lng": -122.3212,
      "ssid": "SENTINEL-PORT"
    },
    {
      "id": "field",
      "label": "Field",
      "x": 830,
      "y": 320,
      "zone": "field",
      "indoor": false,
      "power": "solar",
      "battery0": 62.0,
      "smoke_mult": 1.3,
      "smoke_lag_min": 1.0,
      "temp_offset": 0.0,
      "mq2_base": 310,
      "solar_factor": 0.2,
      "is_gateway": false,
      "lat": 47.68085,
      "lng": -122.31957,
      "ssid": "SENTINEL-FIELD"
    },
    {
      "id": "bus",
      "label": "Bus Loop",
      "x": 870,
      "y": 578,
      "zone": "bus-loop",
      "indoor": false,
      "power": "solar",
      "battery0": 94.0,
      "smoke_mult": 1.15,
      "smoke_lag_min": 0.0,
      "temp_offset": 0.5,
      "mq2_base": 450,
      "solar_factor": 0.5,
      "is_gateway": false,
      "lat": 47.67992,
      "lng": -122.31936,
      "ssid": "SENTINEL-BUS"
    }
  ],
  "links": [
    {
      "a": "hub",
      "b": "main",
      "quality": 0.97
    },
    {
      "a": "hub",
      "b": "gym",
      "quality": 0.92
    },
    {
      "a": "hub",
      "b": "cafe",
      "quality": 0.85
    },
    {
      "a": "hub",
      "b": "bus",
      "quality": 0.9
    },
    {
      "a": "main",
      "b": "cafe",
      "quality": 0.93
    },
    {
      "a": "main",
      "b": "sci",
      "quality": 0.8
    },
    {
      "a": "main",
      "b": "port",
      "quality": 0.88
    },
    {
      "a": "main",
      "b": "gym",
      "quality": 0.9
    },
    {
      "a": "sci",
      "b": "port",
      "quality": 0.94
    },
    {
      "a": "sci",
      "b": "gym",
      "quality": 0.75
    },
    {
      "a": "port",
      "b": "field",
      "quality": 0.86
    },
    {
      "a": "cafe",
      "b": "field",
      "quality": 0.91
    },
    {
      "a": "cafe",
      "b": "bus",
      "quality": 0.88
    },
    {
      "a": "field",
      "b": "bus",
      "quality": 0.82
    }
  ],
  "gateway": "hub"
}
```

### 9.2 `src/data/warehouse.json` (output of `export_warehouse_json()`)

```json
{
  "site": {
    "id": "hil-c",
    "name": "Harbor Island Logistics, Building C",
    "svg": [
      1000,
      600
    ],
    "m_per_px": 0.1,
    "origin_latlng": [
      47.5795,
      -122.353
    ],
    "aisles": 12,
    "bays": [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H"
    ]
  },
  "nodes": [
    {
      "id": "w1",
      "label": "Aisles 1-2",
      "x": 134,
      "y": 275,
      "aisles": [
        1,
        2
      ],
      "power": "mains",
      "mq2_base": 350,
      "lat": 47.57925,
      "lng": -122.35282,
      "is_gateway": false
    },
    {
      "id": "w2",
      "label": "Aisles 3-4",
      "x": 262,
      "y": 275,
      "aisles": [
        3,
        4
      ],
      "power": "mains",
      "mq2_base": 360,
      "lat": 47.57925,
      "lng": -122.35265,
      "is_gateway": false
    },
    {
      "id": "w3",
      "label": "Aisles 5-6",
      "x": 390,
      "y": 275,
      "aisles": [
        5,
        6
      ],
      "power": "mains",
      "mq2_base": 355,
      "lat": 47.57925,
      "lng": -122.35248,
      "is_gateway": false
    },
    {
      "id": "w4",
      "label": "Aisles 7-8",
      "x": 518,
      "y": 275,
      "aisles": [
        7,
        8
      ],
      "power": "mains",
      "mq2_base": 370,
      "lat": 47.57925,
      "lng": -122.35231,
      "is_gateway": false
    },
    {
      "id": "w5",
      "label": "Aisles 9-10",
      "x": 646,
      "y": 275,
      "aisles": [
        9,
        10
      ],
      "power": "mains",
      "mq2_base": 350,
      "lat": 47.57925,
      "lng": -122.35214,
      "is_gateway": false
    },
    {
      "id": "w6",
      "label": "Office wall / Gateway",
      "x": 850,
      "y": 275,
      "aisles": [
        11,
        12
      ],
      "power": "mains",
      "mq2_base": 340,
      "is_gateway": true,
      "lat": 47.57925,
      "lng": -122.35187
    }
  ],
  "links": [
    {
      "a": "w1",
      "b": "w2",
      "quality": 0.96
    },
    {
      "a": "w2",
      "b": "w3",
      "quality": 0.95
    },
    {
      "a": "w3",
      "b": "w4",
      "quality": 0.95
    },
    {
      "a": "w4",
      "b": "w5",
      "quality": 0.94
    },
    {
      "a": "w5",
      "b": "w6",
      "quality": 0.93
    },
    {
      "a": "w1",
      "b": "w3",
      "quality": 0.8
    },
    {
      "a": "w2",
      "b": "w4",
      "quality": 0.82
    },
    {
      "a": "w3",
      "b": "w5",
      "quality": 0.8
    },
    {
      "a": "w4",
      "b": "w6",
      "quality": 0.78
    }
  ],
  "gateway": "w6",
  "fire": {
    "aisle": 7,
    "bay": "C",
    "x": 486,
    "y": 200,
    "nearest": "w4",
    "neighbours": [
      "w3",
      "w5"
    ]
  }
}
```

---

## 10. Notes for the alert-engine agent (two gotchas found in replay)

1. **Priority must be allowed to escalate on the same node.** The gym is at ~155 µg/m³ from the sky before the fire starts. It crosses 225.5 (HAZARDOUS_SMOKE branch) about 40 seconds before it crosses 2× its neighbours' median (LOCAL_FIRE branch). If the engine latches the first alert kind per node, the demo shows "hazardous smoke at gym" and never "fire". Rule: a node's open alert is replaced whenever a higher-priority kind matches; emit an `escalated` event so the timeline shows "13:06 smoke → 14:07 FIRE".
2. **Debounce LOCAL_SMOKE_SUSPECT over two consecutive readings.** With the lags in §3.1 the replay produced zero false positives during the front, but the margin at Field vs its neighbours is thinnest around 13:00 (Field ~115, neighbour median ~65, 5-min rise ~80; the rule needs 2× and gets 1.8×). Requiring two consecutive matching readings (20 s) costs nothing and protects against anyone retuning the lags.

Expected alert sequence for the default scenario with a fire at 14:05 (seed 2026):

```
12:57   field  ACTIVITY_ADVISORY   unhealthy        decision card: cancel outdoor practice, PM2.5 71
13:07   field  HAZARDOUS_SMOKE     pm 228 reg 156   SMS → field zone
13:10   bus    HAZARDOUS_SMOKE     pm 228 reg 162   SMS → bus-loop zone
14:06   gym    HAZARDOUS_SMOKE     pm 229 reg 151   (40 s prelude)
14:07   gym    LOCAL_FIRE          pm 360 reg 157   temp +8.8 in 2 min, gas +216   ← the beat
```

Campus median at plateau: 175–185 µg/m³ (so `regional > 150` holds for the hazardous branch); Science Wing never exceeds ~125; Cafeteria lunch bump (11:15–12:15) peaks at 21 with no temperature rise and never trips anything.

---

## 11. What is deliberately not here

- No per-student or per-class data (drill doc).
- No incident/trust-score data (incident doc); the only incident-related item here is `packet_dropped`, which the mesh uses.
- No real building names, addresses, or footprints. Both sites are fictional and labelled so.
- No weather API, no map tiles, no fonts. Two SVGs and one Python file.
