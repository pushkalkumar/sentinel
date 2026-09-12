# Sentinel Node hardware

The physical half of Sentinel: a $31 box (at 1,000 units) built around an ESP32-S3 that measures smoke, heat and gas, relays readings and messages to neighbouring boxes over 915 MHz LoRa, runs its own WiFi access point with a captive portal, and keeps working when the internet and cell towers are down.

**Status: designed, not fabricated**, per organiser guidance. What is in this folder is a block-level schematic, a bill of materials, a power budget and a reviewable firmware sketch. Nothing here has been laid out, ordered, soldered or flashed. The demo in this repository uses simulated nodes and labels them as such on every screen.

## Files

| File | What it is |
|---|---|
| [`schematic.svg`](schematic.svg) | Block-level schematic, 1600 × 1000, hand-authored SVG. Power row, MCU, peripherals, every net labelled. Opens in any browser from `file://`. A 2× PNG lives at [`docs/schematic.png`](../docs/schematic.png) for Devpost. |
| [`BOM.md`](BOM.md) | Node bill of materials at 1 / 100 / 1,000 units ($60 / $42 / $31), gateway and edge costs, and how the `/hardware` page's per-part costs map onto the BOM rows. |
| [`POWER_BUDGET.md`](POWER_BUDGET.md) | Per-state currents, the 18650 runtime math, the solar assumption for Seattle, and the indoor mains note. |
| [`firmware/sentinel_node.ino`](firmware/sentinel_node.ino) | Arduino-ESP32 sketch: WiFi AP + captive DNS + portal, sensor loop, local alert rules, SX1262 flooding mesh with store-and-forward. See [`firmware/README.md`](firmware/README.md). |

## What the node is

- **Sensors:** PMS5003 (PM1 / PM2.5 / PM10, laser scattering), BME280 (temperature, humidity, pressure), MQ-2 (combustible gas, heater-based).
- **Radio:** SX1262 LoRa at 915 MHz, +22 dBm, SF9 / BW125. 300 to 600 m through buildings, 1 to 2 km with line of sight, further by hopping. Flooding mesh with de-duplication, TTL 8, 256-message store-and-forward queue.
- **Local WiFi:** the ESP32 runs an open access point `SENTINEL-<node_id>` at 192.168.4.1 with a DNS server that answers every hostname with itself, so a phone that joins gets the "sign in to network" sheet and lands on the report form. No internet is involved at any step.
- **Local alarm:** rate-of-rise and absolute thresholds (spec §6.2) run on the node. Red LED, buzzer, portal banner and a priority mesh message fire with no backend and no neighbours.
- **Power:** 18650 3400 mAh, TP4056 charger with DW01 protection, MT3608 5 V boost on a MOSFET-switched rail for the fan and heater, 6 V 2 W solar on the lid or 5 V USB-C for indoor nodes. Roughly 3 days in normal mode with no sun, 12 to 18 hours in full disaster mode.
- **Enclosure:** IP65 polycarbonate, vented sensor chamber on one side, sealed electronics bay on the other, wall mount. The "I'm here" button is a sealed 16 mm dome on the front wall.

## Supplement, not replacement

Sentinel Node is a **supplement** to code-required detection, not a replacement; it adds location, trend, and networking. NFPA 72 spacing for spot smoke detectors is about 30 ft (9 m) on smooth ceilings, and nothing in this folder changes what a building is required to install. Plan one node per 2,500 to 4,000 sq ft for useful localisation indoors, denser near high-value racks.

## Known gaps and honest caveats (spec §12)

- WEA/IPAWS broadcast to all phones requires government authority; the product drafts, agencies send.
- PMS5003 sensors drift and need cleaning; cross-node comparison flags this but does not fix it.
- MQ-2 is a cheap heater-based gas sensor with poor selectivity; a production indoor node should use an electrochemical CO sensor and a proper photoelectric smoke chamber, and must sit alongside code-required detection, not replace it.
- LoRa flooding mesh does not scale past ~80 nodes per channel; larger sites need multiple gateways or channel planning.
- Browser geolocation is opt-in and often coarse indoors; node proximity is the primary location signal.
- Legal: SMS registry requires TCPA-compliant opt-in and STOP handling; student roster data requires FERPA-compliant handling and a data processing agreement with the district.
- Demo today contains no fabricated hardware, no live sensors, and no live SMS. Every one of those is labelled on screen.

One more that is specific to this folder: the pin numbers in the schematic and the sketch are classic ESP32 DevKit numbers (GPIO21/22 for I²C, GPIO23/19/18/5 for SPI, GPIO34/35 for the ADC), because that is what spec §3.2 lists. The ESP32-S3 has no GPIO22 to 25 and reserves GPIO26 to 32 for flash and PSRAM. The remap is a mechanical change before layout; it is noted in the schematic title block rather than guessed silently.

## Gateway and edge server

Any node plus an uplink is a gateway. At a school or warehouse the ESP32 also joins the building network as a WiFi client and posts to the backend, falling back to LoRa-only if that network dies. An outdoor neighbourhood hub adds a SIM7080G Cat-M1 modem (about $20 over a node) and a data plan. The edge server is a Raspberry Pi 4 or any old laptop running the same backend container against SQLite; it is what keeps the admin dashboard working with no internet, and it syncs to the cloud when it can.
