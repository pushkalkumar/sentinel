# Devpost submission: Sentinel

Paste each field into Devpost as labelled. The fields from Tagline through Award fit total under 900 words.

## Project name

Sentinel

## Tagline

A roll-call and smoke-decision tool schools and warehouses use every week, which turns into a verified emergency reporting network when the internet dies.

## Inspiration

Puget Sound had multi-day hazardous air in 2020, 2022, 2023 and 2025, and the call to hold practice outside is still a coach reading a county AQI from miles away. Washington schools run a monthly drill on clipboards. Earthquake planning here assumes cell and internet are down for days. We wanted a box that earns its wall on a Tuesday and still works on the worst day.

## What it does

The Sentinel Node is a $31 ESP32 device with particulate, temperature, humidity and gas sensors, a LoRa radio, and its own WiFi access point. Nodes relay to each other; a gateway carries readings to a backend that can also run on a Pi at the site.

The alert engine compares each node against the median of its neighbours: one node rising fast with heat while the others sit flat is `LOCAL_FIRE` in that room; every node climbing together is wildfire smoke, which flips the school's outdoor-activity card. Anyone next to a node can open its page from a phone, tap "Trapped", and get a code like `SN-7K3F`; the report carries a trust score built from proximity, live sensor agreement, other phones and the reporter's role. Only a responder can resolve an incident, and every action lands in an audit log with user, time and IP.

Beside the rules sits a small offline model: a logistic regression over seven features giving a second opinion (fire, sky, clear, suspect) per node, plus a drift detector that spots a dirty sensor sitting above its neighbours for half an hour. It flags disagreement; it never opens or closes an alert. Gemini flash-lite reads free-text reports in any language and returns type, count, urgency and a summary quoting the reporter's own words, and writes a ten-second situation brief from live rows. Without a key, or on any error, the same endpoints answer from keyword rules and say so. Rules decide, humans resolve.

The map is the real Roosevelt High School campus from OpenStreetMap. Two Particle Xenons on the table carry the 24-byte mesh message over BLE in place of LoRa; pressing MODE on one hops across the live map through the other.

## How we built it

FastAPI with SQLite and one WebSocket; a Python asyncio simulator that plays a scripted smoke day across 14 virtual nodes and passes mesh messages over local UDP with 15% drop, so de-dup and retry run for real; Vite, React, TypeScript and Tailwind on the front, react-three-fiber for the campus scene and the exploded node. A `/demo` war-room page runs seven scripted chapters server-side, so the stage demo is one Play button. Frontend on Vercel, backend and simulator in one container on Render's free tier. The model is trained in numpy from the simulator's own curves and ships with its confusion matrix and a model card endpoint.

We wrote the spec and pitch first, then a contract, a design system and a build plan, and ran parallel Claude Code agents against those documents with frozen file ownership. Xenon firmware was compiled on Particle's cloud compiler and flashed over USB.

## Challenges

Jumping the simulator forward must not create a false `LOCAL_FIRE`, so the demo waits for five minutes of history at the gym before lighting it. The Xenons shipped with a Device OS older than the BLE API and had to be upgraded. Hardware readings must carry the simulator clock or they flip the site's air band.

## Accomplishments

A phone on the hotspot reports from the gym node, gets a code, hops to the gateway, shows as Verified 70 on the responder queue, and is resolved while its status page flips live, uplink off. The neighbour-median rule fires at the gym and nowhere else. The model scores 98.4% on held-out synthetic windows. A real button press on a real board appears on the map.

## What we learned

Disaster hardware fails because it sits unused. The spatial test is a property of the network, not the device, so a cheap node can do it. A model earns trust by sitting beside the rules for a season and logging where it disagreed.

## What's next

Real SX1262 radios in place of BLE. An electrochemical CO sensor indoors. Recalibrate the model on real smoke-season logs before trusting any probability. Pilot the outdoor-activity card with one athletics department. TCPA opt-in and STOP handling before any real SMS.

## Built with

Python, FastAPI, SQLite, numpy, Gemini API, TypeScript, React, Vite, Tailwind, three.js, OpenStreetMap, Particle Xenon, ESP32-S3, SX1262, Vercel, Render.

## Honesty statement

The production node is designed, not fabricated: schematic, BOM, power budget and firmware sketch are in the repo. The Xenons are dev boards running our firmware over BLE with placeholder sensor values. Sensors, LoRa and SMS are simulated and labelled on screen. The model is trained on synthetic data only. Gemini annotates; it never decides.

## Award fit

- Best IoT and Connected Systems: node design, LoRa mesh, two live BLE boards, schematic and BOM.
- Best AI for Good: offline second opinion with a model card, multilingual triage, rules keep authority.
- PNW Impact: earthquake planning, smoke season, the WA drill law, a real Seattle campus.
- Frontier Award: the reporting path works with the internet dead.
- Crowd Favorite: judges join the network from their own phones.

## Links

- Repo: https://github.com/pushkalkumar/sentinel
- Live site: https://sentinel-seattle.vercel.app (backend on Render free tier; first load after idle takes about 50 s)
- War room: https://sentinel-seattle.vercel.app/demo, login `admin@sentinel.demo` / `sentinel`, press Play
- Demo video: `<video-url>`
- Schematic: `docs/schematic.png`
- AI for Good notes: `docs/AI_FOR_GOOD.md`
- AI tools disclosure: `docs/AI_TOOLS_DISCLOSURE.md`

## Gallery order

`01-landing.png`, `demo-fire.png`, `05-explain-gym.png`, `10-incident-detail.png`, `16-phone-code.png`, `20-hardware-exploded.png`, `xenon-table.jpg`, `22-schematic.png`
