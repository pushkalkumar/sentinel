# Sentinel Node power budget (rev A)

Designed, not measured. Currents are datasheet typicals for the parts in `BOM.md` at 3.3 V (logic) and 5 V (fan, heater), rounded the way spec §3.6 rounds them. Nothing here has been put on a bench.

## Per-state currents (spec §3.6)

| State | Avg current | Notes |
|---|---|---|
| Normal, sensors duty-cycled, AP beacon only | ~12 mA | dominated by ESP32 light sleep + periodic wake |
| PMS5003 fan burst | +100 mA for 30 s / 5 min | ~10 mA averaged |
| MQ-2 heater | +150 mA when on | duty-cycle to 10 s / 60 s → ~25 mA averaged; drop MQ-2 entirely for outdoor-only nodes |
| LoRa TX | +120 mA for ~150 ms per packet | negligible at normal rates |
| Disaster mode, AP fully up, sensors continuous | ~180–250 mA | |

## Where the normal-mode number comes from

The ~12 mA base is the ESP32 in light sleep (~1 mA) waking every 2 s for the loop, the AP beacon in modem-sleep (~5 to 8 mA averaged), the SX1262 in receive (~5 mA at DC-DC), and the BME280 forced reads (microamps). The sensor duty cycles add on top:

```
base (MCU + AP beacon + LoRa RX)      ~12 mA
PMS5003  100 mA × 30 s / 300 s        ~10 mA
MQ-2     150 mA × 10 s / 60 s         ~25 mA
LoRa TX  120 mA × 0.15 s / 300 s      ~0.06 mA
                                      ------
normal mode, all sensors              ~47 mA
normal mode, outdoor node (no MQ-2)   ~22 mA
```

## 18650 runtime

Cell: 3400 mAh nominal at 3.6 V. The DW01 cuts off at 2.5 V and the 3.3 V regulator drops out around 3.4 V under load, so take 90 % of nominal as usable: **~3060 mAh**.

```
normal, all sensors:      3060 mAh / 47 mA   = 65 h   ≈ 2.7 days   ("roughly 3 days")
normal, outdoor no MQ-2:  3060 mAh / 22 mA   = 139 h  ≈ 5.8 days
disaster, low estimate:   3060 mAh / 180 mA  = 17 h
disaster, high estimate:  3060 mAh / 250 mA  = 12 h                 ("12 to 18 hours")
```

Disaster mode is the AP fully up with a phone or two attached (~80 to 120 mA on its own), the PMS5003 fan continuous (100 mA), the MQ-2 heater continuous (150 mA on the 5 V rail, ~100 mA reflected at the cell through the boost), and telemetry every 30 s. The range in the table is the difference between nobody attached to the AP and several phones attached.

## Solar assumption

Panel: 6 V 2 W monocrystalline, lid-mounted, feeding the TP4056 through a Schottky OR with the USB-C input. The TP4056 is a linear charger, so the 6 V to 4.2 V drop is lost as heat; count 70 % end-to-end from panel to cell.

```
Seattle peak-sun hours:  summer ~4.5 h/day, September to October ~2.5 h/day, December ~1 h/day

summer:   2 W × 4.5 h × 0.70 / 3.7 V  = 1.70 Ah/day   vs   47 mA × 24 h = 1.13 Ah/day   surplus
fall:     2 W × 2.5 h × 0.70 / 3.7 V  = 0.95 Ah/day   vs   1.13 Ah/day                  slight deficit, ~6 % of the cell per day
winter:   2 W × 1.0 h × 0.70 / 3.7 V  = 0.38 Ah/day   vs   1.13 Ah/day                  drains in ~4 days without help
```

So "indefinite normal mode with the 2 W panel in Seattle summer/fall" (spec §3.6) holds for summer and for an outdoor node with the MQ-2 dropped (22 mA, 0.53 Ah/day) through October. An outdoor node with the MQ-2 fitted needs a 3 W panel or a shorter heater duty cycle to hold through fall. Nobody should plan on solar alone through a Seattle winter; wildfire smoke season is June to October, which is the season the outdoor node is for.

## Indoor mains note

Indoor nodes should be mains-powered with the battery as backup; the same board takes a 5 V USB input on the USB-C jack and the Schottky OR picks it over the panel. On mains the duty cycles are moot and the node can run the PMS5003 continuously for better trend data. The 18650 then covers a power cut: ~12 to 18 hours in disaster mode, which is the case that matters, because a building fire and a power cut arrive together.

## What would change these numbers

- The ESP32-S3 pin remap (see the schematic title block) does not change the budget.
- A WiFi AP with clients attached is the single largest variable. The firmware keeps the AP beacon-only in normal mode and brings it fully up only on a button press or a mesh disaster flag (spec §3.3); that rule is what makes the 3-day figure possible.
- Replacing the MQ-2 with an electrochemical CO sensor (spec §12) removes the heater and cuts normal-mode draw to ~22 mA for indoor nodes too.
