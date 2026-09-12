# Xenon live hardware demo

Two Particle Xenons (nRF52840, BLE only) on the table stand in for two LoRa mesh nodes.
Xenon A is a field node, Xenon B is a gateway. The message that goes over the air is the
24-byte struct from spec §3.3; the radio is BLE advertising instead of LoRa.

## What is real, what is swapped

Real:

- Two boards, no cloud, no WiFi, no Particle mesh. `SYSTEM_MODE(MANUAL)`, BLE only.
- The 24-byte packed `SentinelMsg` (`msg.h`): `msg_id`, `origin`, `hop_count`, `ttl`, `priority`, `kind`, payload.
- A advertises a reading every 5 s. B scans, de-duplicates by `msg_id`, rebroadcasts once with
  `hop_count+1` / `ttl-1`, and prints one JSON line per new message on USB serial.
- MODE on A sends a priority-2 button message. It shows up in the backend mesh log as
  `xenon-a -> xenon-b -> hub` and drives the same hop animation the simulator uses.
- Battery millivolts (`analogRead(BATT)` on A, ~4170 mV on USB) and BLE RSSI as measured by B.

Swapped or placeholder:

- Radio: BLE advertising (~10 m indoors) in place of LoRa (km). Same payload, one radio swapped.
- Temperature is a fixed 23.0 °C. The Xenon has no user-readable temperature sensor.
- PM1/PM2.5/PM10, humidity and MQ-2 are sent as `0`. No such sensors on the board. These are
  placeholders so the reading fits the ingest schema, not measurements.
- The last hop (`xenon-b -> hub`) is the USB cable plus the laptop bridge, not a radio hop.
- Reading timestamps use the simulator clock (see "Clocks" below), so `last_seen` on `xenon-a`
  shows sim time, not wall time.
- `xenon-b` never posts a reading of its own, so the dashboard lists it as `offline` even while it
  is relaying. Its liveness is visible through the button hops and the bridge log.

## Boards

| Role | Device id | Port on this laptop | Device OS | Firmware |
|---|---|---|---|---|
| Xenon A, field node | `e00fce686a17cdf58eae8569` | `/dev/tty.usbmodem1301` | 1.5.2 | `node_a/node_a.ino` |
| Xenon B, gateway | `e00fce68c9f6eb12f3069ca4` | `/dev/tty.usbmodem1401` | 1.5.2 | `node_b/node_b.ino` |

Both shipped with Device OS 1.1.0, which predates the BLE API (1.3.0). They were upgraded with
`particle update --target 1.5.2 <deviceid>`. 1.5.2 is the last release that supports the Xenon.

Tell them apart at the table: A flashes **blue** every 5 s (send), B flashes **green** on every
message it receives.

## Toolchain

Particle cloud compiler, target 1.5.2, flashed over USB. `particle-cli` 3.50.1 accepts the
`xenon` platform at `--target 1.5.2` (verified 2026-09-12). No local toolchain needed.

```sh
npm i -g particle-cli
particle login
cd hardware/xenon
particle compile xenon node_a/node_a.ino msg.h --target 1.5.2 --saveTo node_a.bin
particle compile xenon node_b/node_b.ino msg.h --target 1.5.2 --saveTo node_b.bin
```

`msg.h` is passed explicitly because the cloud compiler only uploads the files you name.

## Flash

The prebuilt `node_a.bin` / `node_b.bin` are checked in, so flashing works offline.

```sh
particle flash --local --application-only e00fce686a17cdf58eae8569 node_a.bin
particle flash --local --application-only e00fce68c9f6eb12f3069ca4 node_b.bin
```

The CLI switches the board into DFU mode itself. If it cannot (board wedged, wrong mode):
hold MODE, tap RESET, keep holding MODE until the RGB LED blinks yellow, release. Then
`particle flash --usb node_a.bin` (one board plugged in at a time in that case).

To start from a fresh board: `particle update --target 1.5.2 <deviceid>` first.

## Run the bridge

```sh
make backend                   # :8000, if not already up
make bridge                    # auto-detects the gateway port
make bridge PORT=/dev/tty.usbmodem1401
# or
cd backend && .venv/bin/python -m app.hardware_bridge --port /dev/tty.usbmodem1401
```

The bridge reads B's serial JSON and POSTs:

- readings to `POST /api/ingest/telemetry` as `node_id: "xenon-a"` (rssi = BLE RSSI measured by B,
  battery % from mV);
- MODE presses to `POST /api/ingest/mesh-message` twice, `xenon-a -> xenon-b` (status `ok`) then
  `xenon-b -> hub` (status `delivered`), with `X-Sim-Key: sentinel-sim`.

It never exits on serial or HTTP errors: it reconnects every 2 s and logs one line per event.
Auto-detect probes each Particle port for ~7 s and picks the one printing JSON (only B prints).

Bench trigger without touching the board: send the byte `b` to A's serial port. It takes the same
code path as a MODE click.

```sh
python3 -c "import serial; serial.Serial('/dev/tty.usbmodem1301',115200).write(b'b')"
```

## Clocks

Readings are stamped with the simulator clock (`GET /api/sim/state`), extrapolated through short
backend outages, and only fall back to wall time when the simulator has been gone for 2 min.
Reason: `update_site_band()` computes the site band from outdoor nodes inside a rolling window
ending at the reading's `ts`. A wall-clock reading would make `xenon-a` the only outdoor node in
the window, flip the site band to `good`, and flip it back on the next simulator tick.
When the simulator is paused the sim clock stands still and repeated readings are rejected as
duplicates (`(node_id, ts)` is unique); the bridge logs `duplicate ts (sim paused?)`.

## Seeding

`shared/topology.json` carries both nodes with `"hardware": true`. `seed.py` builds them like any
other node (firmware `xenon-ble-0.1`) and `ensure_hardware_nodes()` inserts them into an
already-seeded database on startup, so no reset is needed. `simulator/world.py` skips
`hardware` nodes so the simulator never invents readings for the real boards.

## Troubleshooting

- **No serial port**: `particle serial list`. Port numbers follow the USB socket
  (`usbmodem1301` vs `usbmodem1401`); a different hub gives different names. Use auto-detect or
  pass `--port`.
- **Board blinking magenta / safe mode**: user firmware compiled for a newer Device OS than the
  board runs. `particle serial identify --port ...` shows the OS; run
  `particle update --target 1.5.2 <deviceid>`, then reflash.
- **Board blinking blue (listening mode)**: MODE was held for 3 s or more. Tap RESET.
- **Cloud compile refuses `xenon`**: try `--target 1.4.4`; failing that, install
  `neopo` or Particle Workbench and build locally against 1.5.2. Prebuilt bins are in this folder.
- **B prints nothing**: A not powered, or out of range. Adjacent boards read about -20 to -30 dBm;
  across a room -60 to -80 dBm. Past about -90 dBm packets stop. Note the advertisement is exactly
  31 bytes; anything added to the advert silently breaks it.
- **B prints, backend shows nothing**: bridge not running, wrong port, or `xenon-a` not in the DB
  (bridge logs `rejected (node not seeded? run make seed)`; restarting the backend inserts it).
- **`POST ... timed out` in the bridge log**: backend reloading (uvicorn `--reload` restarts on any
  edit under `backend/app`). It recovers on its own.
- **Mesh log needs auth**: `POST /api/auth/login` with `admin@sentinel.demo` / `sentinel`, then
  `GET /api/mesh/log?limit=5` with the bearer token.
