# Sentinel Node BOM (rev A)

Designed, not fabricated. Prices are estimates from distributor and module-vendor pricing in September 2026 and are the numbers in spec §4.1; the three columns are quantity 1, 100 and 1,000.

## Node

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

## Gateway and edge

| Item | Cost |
|---|---|
| LTE gateway node (node + SIM7080G + antenna) | +$20 over a node |
| Cat-M1 data plan | $2–5 / month |
| Edge server (Raspberry Pi 4 kit) | ~$90 one-time |

A school or warehouse gateway is any node that also joins the building network as a WiFi client; it costs nothing extra. The LTE variant is for an outdoor neighbourhood hub with no building network behind it.

## What is counted where

The `/hardware` page's exploded 3D view shows thirteen numbered parts and a part card with a per-part cost at 1,000 units. Those numbers are this table's "Qty 1000" column split where the BOM lumps parts, so the two views agree to the cent:

| 3D part | Cost @1k | BOM row it comes from |
|---|---|---|
| ESP32-S3-WROOM-1 | $3.20 | ESP32-S3 module |
| SX1262 LoRa module | $3.90 | SX1262 LoRa module + antenna ($4.80 split 3.90 + 0.90) |
| 915 MHz helical antenna | $0.90 | SX1262 LoRa module + antenna |
| PMS5003 | $9.00 | PMS5003 PM sensor |
| BME280 | $0.90 | BME280 |
| MQ-2 | $0.60 | MQ-2 gas sensor |
| 18650 cell + holder | $2.80 | 18650 cell + holder |
| Charger + protection + 5 V boost | $0.80 | TP4056 + protection + MT3608 boost |
| 6 V 2 W solar panel | $2.60 | 6 V 2 W solar panel |
| Main PCB | $1.10 | PCB, passives, connectors, MOSFETs |
| Button, WS2812 LED, piezo buzzer | $0.10 each ($0.30) | Button, WS2812, buzzer |
| IP65 lid | $2.20 | IP65 enclosure + mount (lid row carries tray and wall mount) |
| Enclosure tray | $0 | counted with the lid |
| Parts subtotal | $28.30 | |
| Assembly / test | $2.50 | Assembly / test |
| **Total** | **$30.80** | rounds to the "$31" on the stat strip |

The gateway modem, the edge server and the data plan are not part of the node price and do not appear in the 3D registry.

## Notes on part choice

- **ESP32-S3-WROOM-1** was chosen for WiFi AP plus BLE in one module with enough flash for the portal bundle. The pin numbers in the schematic and the sketch are classic ESP32 DevKit numbers from spec §3.2; the S3 has no GPIO22 to 25 and reserves GPIO26 to 32 for flash and PSRAM, so a remap is pending before layout (see the schematic title block).
- **SX1262** over SX1276 for the +22 dBm output and lower receive current. 915 MHz ISM for North America; an 868 MHz build is the same footprint.
- **PMS5003** is the sensor PurpleAir and AirGradient use; the price is the largest single line and the reason the indoor variant can drop duty-cycling hardware but not the sensor.
- **MQ-2** is cheap and unselective (spec §12). It confirms heat-plus-particulate events; it is not a CO detector. A production indoor node should use an electrochemical CO sensor and a photoelectric chamber.
- **TP4056 + DW01/FS8205 + MT3608** is the commodity charger, protection and boost trio. The P-MOSFET on the 5 V rail is what lets the fan and heater be fully cut in sleep, which is where the 3-day normal-mode figure in `POWER_BUDGET.md` comes from.
