# Devpost submission: Sentinel

Paste each field into Devpost as labelled. The fields from Tagline through Award fit total under 900 words.

## Project name

Sentinel

## Tagline

A roll-call and smoke-decision tool schools and warehouses use every week, which turns into a verified emergency reporting network when the internet dies.

## Inspiration

Puget Sound had multi-day hazardous air in 2020, 2022, 2023 and 2025, and the call to hold practice outside is still a coach reading a county AQI from a sensor miles away. Washington schools run a drill every month on clipboards. Planning for the M8+ earthquake this region expects assumes cell and internet service west of I-5 is down for days, and Seattle's Emergency Communication Hubs run on whiteboards and ham radio. Every emergency app we looked at assumes a backbone. We wanted a box that earns its wall on a Tuesday and still works on the worst day.

## What it does

The Sentinel Node is a $31 ESP32 device with particulate, temperature, humidity and gas sensors, a LoRa radio, and its own WiFi access point. Nodes relay readings and messages to each other; a gateway carries them to a backend that also runs on a Raspberry Pi at the site when the cloud is unreachable.

The alert engine compares each node against the median of its neighbours: one node rising fast with heat while the others sit flat is `LOCAL_FIRE` in that room; every node climbing together is wildfire smoke, which flips the school's outdoor-activity card and sends a simulated SMS to registered phones in the zone. Anyone standing next to a node can open its page from a phone with no app, tap "Trapped", and get a code like `SN-7K3F`; the report carries a trust score built from node proximity, what the node's sensors read right now, other phones reporting the same thing, and the reporter's role. Only a responder can resolve an incident, with a note, and every action lands in an audit log with user, time and IP.

Three add-ons make the engine visible. Time Machine scrubs the simulated day and pins every decision with the numbers that caused it. Sky vs Building shows, for any node, the exact rule that fired with live values and a bar chart of the node against its neighbours. The WEA draft builds a CAP-shaped 90/360-character alert with the zone polygon for the agency to issue through its own IPAWS authority. Sentinel drafts; the agency sends.

## How we built it

FastAPI with SQLite and one WebSocket; a Python asyncio simulator that plays a scripted smoke day across 14 virtual nodes and passes mesh messages over local UDP with 15% drop, so de-dup and retry run for real; Vite, React, TypeScript and Tailwind on the front, with react-three-fiber for the exploded node on the hardware page. One shared `topology.json` feeds backend, simulator and map.

We wrote the spec and pitch first, then an integration contract, a design system and a build plan, and ran thirteen parallel Claude Code agents against those documents, one per module, with frozen file ownership and one notes file for cross-agent requests. No runtime APIs: no tiles, no CDN fonts, no SMS provider, no LLM in the loop. Every decision the product makes is a readable rule.

## Challenges

Keeping the fire test honest: jumping the simulator forward must not create a false `LOCAL_FIRE`, so `pm_rise` is zero when no reading exists five minutes back, and the engine wants three neighbours before trusting the median. Making the phone path work on a hotspot with the laptop's uplink off meant the frontend could never name a host.

## Accomplishments

A phone on the hotspot reports from the gym node, gets a code, hops across the map to the gateway, shows up as Verified 70 on the responder queue, is resolved with a note, and its status page flips live, all with the laptop's uplink off. The neighbour-median rule fires at the gym and nowhere else. A teacher submits 28 present and 2 missing and the office grid turns amber within two seconds. The hardware page loads offline with an exploded 3D node, a part registry that sums to the BOM, and the schematic.

## What we learned

Disaster hardware fails commercially because it sits unused; goTenna Mesh is the cautionary tale. The spatial test is a property of the network, not the device, which is why a cheap node can do it. Writing the honesty labels first made every later scope call easier.

## What's next

Flash the firmware on two DevKits and run the mesh over real SX1262 radios. Swap MQ-2 for an electrochemical CO sensor indoors. Pilot the outdoor-activity card with one school athletics department this smoke season. TCPA opt-in and STOP handling before any real SMS.

## Built with

Python, FastAPI, SQLAlchemy, SQLite, aiohttp, TypeScript, React, Vite, Tailwind CSS, zustand, three.js, react-three-fiber, ESP32-S3, SX1262, PMS5003, BME280, MQ-2, RadioLib.

## Honesty statement

Hardware is designed, not fabricated, per organiser guidance: schematic, BOM, pin map, power budget and firmware sketch are in the repo. Sensors, the LoRa mesh and SMS are simulated in the demo and labelled on screen wherever they appear. Engine, trust, audit and drill logic is real.

## Award fit

- Best IoT and Connected Systems: ESP32 node, LoRa mesh, gateway, edge server, schematic and BOM.
- Best AI for Good: fire-vs-smoke discrimination and trust scoring, rule-based and explained on screen.
- PNW Impact: earthquake planning, smoke season, Seattle Emergency Hubs, the WA drill law.
- Frontier Award: the reporting path works with the internet dead.
- Crowd Favorite: judges join the network from their own phones.

## Links

- Repo: `<repo-url>`
- Demo video: `<video-url>`
- Schematic: `docs/schematic.png`
- AI tools disclosure: `docs/AI_TOOLS_DISCLOSURE.md`

## Gallery order

`01-landing.png`, `04-admin-fire.png`, `05-explain-gym.png`, `10-incident-detail.png`, `16-phone-code.png`, `20-hardware-exploded.png`, `22-schematic.png`
