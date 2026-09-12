# Screenshots

Captured by the integrator during the integrate step at 1440×900 (desktop) and 390×844 (phone), PNG. The seven marked "gallery" go to Devpost in that order; the rest are linked from the README.

| File | Route and state | Caption | Gallery |
|---|---|---|---|
| `01-landing.png` | `/` as the hop dash crosses the hero card | Landing page. The hero card plays a calm-to-smoke-to-fire loop with a message hopping to the gateway. | 1 |
| `02-admin-calm.png` | `/admin` at 07:30, all green | Admin overview on a calm morning. Card reads "Outdoor practice: OK". | |
| `03-admin-smoke.png` | `/admin` after `jump smoke`, air mode | Regional smoke. Every node climbs together; the card cancels outdoor practice at PM2.5 about 71. | |
| `04-admin-fire.png` | `/admin` after `trigger_fire gym`, mesh mode | One node spiking while its neighbours are flat. LOCAL_FIRE at the gym, banner red, alarm message hopping gym to science to hub. | 2 |
| `05-explain-gym.png` | Sky vs Building drawer open on gym during the fire | The rule that fired, with live numbers: three passing checks and the gym bar far past twice the neighbour median. | 3 |
| `06-time-machine.png` | `/admin` with the handle dragged to 13:30 | Time Machine. The map and card read the stored 13:30 decision; pins mark every engine decision of the day. | |
| `07-air.png` | `/admin/air` with the gym line spiking alone | Per-node PM2.5 for the day. Seven lines rise together in the afternoon; one leaves the pack. | |
| `08-alerts-outbox.png` | `/admin/alerts` SMS outbox | Every text the engine would have sent, with zone and recipient count. SMS provider disabled in the demo, as the tag says. | |
| `09-responder-queue.png` | `/responder` with three incidents, one selected | Responder queue sorted by priority then trust. Verified, Likely and Unverified pills. | |
| `10-incident-detail.png` | `/responder/incident/:code` | Incident detail: trust meter at 70 (proximity plus sensor corroboration), timeline, actions rail. Only this role can resolve. | 4 |
| `11-wea-draft.png` | WEA modal open | Draft Wireless Emergency Alert: FRW, 90 and 360 character texts, zone polygon. Sentinel drafts; the agency issues. | |
| `12-audit.png` | `/responder/audit` | Audit log. Every action with user, time and IP, append-only. | |
| `13-drill-grid.png` | `/admin/drill` mid-drill, one amber tile | Fire drill roll call. Class 3B submitted 28 of 30; two names in the missing list with their muster point. | |
| `14-phone-picker.png` | `/m` at 390 wide | Phone role picker: I need help, I'm staff, I'm a responder. In production this page is served by the node itself. | |
| `15-phone-report.png` | `/m/report` with Trapped selected | Report form: type tiles, count, optional text and location. One button. | |
| `16-phone-code.png` | The code screen | The receipt. Written large enough to copy onto a hand; no zero, no letter O. | 5 |
| `17-phone-status.png` | `/m/status` at Resolved | Status by code, updated live over the WebSocket when the responder acts. | |
| `18-phone-rollcall.png` | `/m/staff` roll call form | Teacher roll call: present count, tap names to mark missing, muster point, submit. | |
| `19-hardware-assembled.png` | `/hardware` explode 0 | The Sentinel Node, assembled, rendered from the part registry. | |
| `20-hardware-exploded.png` | `/hardware` explode 1 with chips | Exploded view with part chips. Thirteen parts summing to the BOM. | 6 |
| `21-hardware-mesh.png` | 3D mesh scene with a pulse | Campus mesh in 3D with a message pulse on a hop. | |
| `22-schematic.png` | `docs/schematic.png` | Node schematic: power, radio, sensor and control nets. Designed, not fabricated; pin numbers per the spec's DevKit map. | 7 |

Rules for captures: sim tag visible where the view has one, no browser chrome, no DevTools, dark theme on desktop, light on phone. Phone captures come from a real phone on the hotspot where possible, otherwise the 390×844 device emulation.
