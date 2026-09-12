# Sentinel Node firmware

`sentinel_node.ino` is the per-node sketch described in spec §3.3. It is written to be read by a reviewer and to compile against the current arduino-esp32 core, but it has not been flashed: there is no board. Designed, not fabricated. Pin numbers per spec §3.2 (DevKit numbering); S3 remap pending.

## What it does

| Function | Where in the sketch | Spec |
|---|---|---|
| WiFi AP `SENTINEL-<node_id>`, open, 192.168.4.1, beacon-only in normal mode | `ap_start()` | §2.1, §3.3 |
| Captive DNS: every hostname resolves to the node | `DNSServer` wildcard in `ap_start()` | §2.1 |
| 2 KB portal page with the report form, `POST /report` returns an `SN-XXXX` code | `PORTAL_HTML`, `handle_root()`, `handle_report()`, `handle_not_found()` (302 for every probe URL) | §7.1, §8.2 |
| BME280 every 60 s over I²C at 0x76 | `bme_read()` | §3.2, §3.3 |
| PMS5003 over UART2, fan 30 s per 5 min via SET, continuous in alert | `pms_service()`, `pms_read_frame()` | §3.3, §3.6 |
| MQ-2 on the ADC, heater 10 s per 60 s, slow rolling baseline | `mq2_service()`, `mq2_heater_on()` | §3.2, §3.6, §6.2 |
| Switched 5 V rail cut when neither fan nor heater needs it | `PIN_5V_EN` writes in the two services above | §3.2 |
| Local alert rules: rate-of-rise and absolute thresholds | `evaluate_rules()` | §6.2 |
| WS2812 status LED and piezo buzzer patterns | `indicate()` | §3.3 |
| SX1262 flooding mesh: `{msg_id, origin, hop_count, ttl, priority}`, de-dup, back-off 10 to 200 ms shorter for higher priority | `MeshHeader`, `mesh_handle_rx()`, `backoff_ms()` | §3.3, §5.1 |
| 256-entry store-and-forward ring, retry every 30 s | `MeshQueue`, `mesh_retry()` | §3.3 |
| Telemetry every 5 min normal, 30 s when alerting, ~24 bytes | `send_telemetry()`, `TelemetryPayload` | §3.3 |
| Light sleep between tasks; button or mesh disaster flag brings the AP fully up | end of `loop()`, `button_service()`, `enter_disaster_mode()` | §3.3 |

## Toolchain

- Arduino IDE 2.x or `arduino-cli` with the **esp32** core by Espressif, 3.x.
- Board: `ESP32 Dev Module` today (the pin numbers are DevKit numbers). Switch to `ESP32S3 Dev Module` once the pin map is remapped for the S3 module in the BOM.
- Libraries from the Library Manager: **RadioLib** (SX1262 driver), **Adafruit BME280 Library** (pulls in Adafruit Unified Sensor), **Adafruit NeoPixel**.
- `WiFi`, `DNSServer`, `WebServer`, `Wire`, `Preferences`, `HardwareSerial` ship with the core.

```
arduino-cli core install esp32:esp32
arduino-cli lib install RadioLib "Adafruit BME280 Library" "Adafruit NeoPixel"
arduino-cli compile --fqbn esp32:esp32:esp32 hardware/firmware
```

## Things a reviewer should know

- **Pin map.** GPIO22, 23, 25, 26, 27, 34 and 35 are legal on a classic ESP32 and not on an S3. The sketch keeps the spec's numbers so the schematic, the sketch and the `/hardware` page agree; the remap is one block of constants at the top of the file.
- **Ground truth for the rules is the backend.** The node runs the same rate-of-rise and absolute tests as spec §6.2, but the spatial check (`r.pm25 > 2 × regional`) needs a real median of neighbours. On the node, `regional_pm25` is an EMA of whatever telemetry it overhears, and the test is skipped when nothing has been heard. That makes a lone node more sensitive, not less; the backend re-evaluates with the full picture.
- **Incident codes.** The node mints a provisional `SN-XXXX` from its id and a counter so the reporter has something to write on their hand immediately. The backend keeps it if unused and otherwise reissues on the reporter's next status check.
- **Plain telemetry is fire-and-forget; alerts and reports go into the ring.** Filling a 256-slot ring with 5-minute telemetry would push out the messages that matter.
- **No encryption or authentication on the mesh.** Same gap Meshtastic has (NOVELTY §1.1). A production build needs at minimum an HMAC over the header with a per-site key; the packet struct leaves no room for it yet and should grow by 8 bytes.
- **Light sleep, not deep sleep.** Deep sleep would drop the AP and the LoRa receive window; light sleep keeps both at ~1 mA MCU cost, which is what the ~12 mA base in `POWER_BUDGET.md` assumes.
- **Outdoor-only nodes** set `MQ2_PRESENT = false` and skip the heater entirely (spec §3.6).
- **The portal page is the minimum viable form.** Production serves the full phone app (< 60 KB, no external assets) from flash; the 2 KB page here proves the captive-portal path with nothing to download.
