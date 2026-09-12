# Sentinel `/hardware` page: 3D technical plan

Owner: frontend 3D agent(s). Target: fully working by 3:30 PM PDT, Sept 12 2026. Everything here runs offline on the demo laptop and over its hotspot. No GLB, no HDRI, no runtime font fetch, no tile server.

Two scenes, one page:

1. **Node explode** (hero). A procedural model of the Sentinel Node that pulls apart as you scroll or drag a slider. Twelve numbered hotspots, each with part name, 1k-qty cost, and role. This is the thing judges photograph.
2. **Campus mesh** (below the BOM). Eight glowing pillars on a dark plane with a campus outline, LoRa links as animated dashes, and a pulse that travels along a link for every live `hop` event from the backend WebSocket. Drops are visible.

Design register: dark, editorial, one warm accent. Reference is mosaic-report.vercel.app for structure (huge grotesque headline, product as hero, 4-stat strip, numbered how-it-works) but Sentinel is near-black with amber, not light. Fonts already installed in `frontend/package.json`: Bricolage Grotesque (display), Geist / Instrument Sans (body), JetBrains Mono (numbers, codes). All via `@fontsource-variable/*`, imported at build time, never fetched at runtime.

---

## 0. Verified versions and imports (checked against npm and package source, Sept 12 2026)

| Package | Version to pin | Notes |
|---|---|---|
| `@react-three/fiber` | `9.7.0` | peerDep `react >=19 <19.3`. **Keep `react`/`react-dom` at `19.2`** (already pinned in `frontend/package.json`). `react@19.3.0` is latest on npm and will fail the peer check. |
| `@react-three/drei` | `10.7.8` | peerDep `@react-three/fiber ^9`, `three >=0.159`, `react ^19`. |
| `three` | `0.186.0` | plus `@types/three@0.186.0`. |
| `zustand` | `5.0.15` | drei depends on it too; one copy. |
| `motion` | `13.2.0` | `useScroll`, `useMotionValueEvent` for the scroll driver. |
| `react-router` | `7.18.3` | v7 pinned on purpose; npm latest is 8.x, do not upgrade today. |
| `tailwindcss` / `@tailwindcss/vite` | `4.3.3` | |

Import names, confirmed present in the 10.7.8 tarball:

```ts
import { Canvas, useFrame, useThree, invalidate } from '@react-three/fiber'   // Canvas is fiber, NOT drei
import {
  OrbitControls, Html, Float, ContactShadows, Edges, Line, RoundedBox,
  Grid, Bounds, useCursor, AdaptiveDpr, PerformanceMonitor,
} from '@react-three/drei'
import * as THREE from 'three'
```

Verified prop facts that matter for this build:

- `Line`: `points`, `color`, `lineWidth` (px), `dashed`, plus every `LineMaterial` prop passes through (`dashSize`, `gapSize`, `dashOffset`, `dashScale`, `opacity`, `transparent`). The ref is a `Line2`; animate with `ref.current.material.dashOffset -= delta * speed`. It calls `computeLineDistances()` for you.
- `Html`: `center`, `distanceFactor`, `zIndexRange`, `occlude` (`true` | `'raycast'` | `'blending'` | ref[]), `transform`, `sprite`, `wrapperClass`, `pointerEvents`. Content is a DOM overlay; it inherits page CSS and Tailwind classes.
- `Float`: `speed`, `rotationIntensity`, `floatIntensity`, `floatingRange`, `autoInvalidate`. Not used on the node model (it would fight the scroll-driven transform). Used nowhere by default; see §7.
- `ContactShadows`: `opacity`, `scale`, `blur`, `far`, `resolution`, `color`, `frames`.
- `Edges`: `threshold` (deg), `color`, `lineWidth`, `scale`. Renders `EdgesGeometry` as a `LineSegments2` child of a mesh.
- `RoundedBox`: `args=[w,h,d]`, `radius`, `smoothness`, `bevelSegments`, `creaseAngle`.
- `OrbitControls`: `makeDefault`, `enablePan`, `enableZoom`, `minDistance`, `maxDistance`, `minPolarAngle`, `maxPolarAngle`, `autoRotate`, `autoRotateSpeed`, `enableDamping`, `target`. It calls `invalidate()` on change, so it works with `frameloop="demand"`.
- `Canvas`: `frameloop: 'always' | 'demand' | 'never'`, `dpr: number | [min,max]`, `gl`, `camera`, `flat`, `fallback` (DOM shown when WebGL is unavailable). `useThree(s => s.setFrameloop)` switches the loop at runtime.

### Offline rules (hard)

| Banned | Why | Use instead |
|---|---|---|
| `<Environment preset="...">` or `files=` | fetches HDRI from a CDN | plain lights (§4.2) |
| `<Text>` (drei / troika) | with no `font`, troika resolves glyphs from `cdn.jsdelivr.net/gh/lojjic/unicode-font-resolver`; even with a local `.ttf`, any glyph the font lacks falls back to that CDN | `<Html>` for every label |
| `useGLTF`, `useTexture(url)`, `useFont(url)` | asset fetches | procedural geometry, `CanvasTexture` generated in JS |
| `Stats`, `Loader` | not banned, just noise | nothing |
| `MeshTransmissionMaterial`, `MeshReflectorMaterial` | heavy; transmission needs a full extra scene pass | `meshPhysicalMaterial` with `clearcoat` for the solar glass only |

Sanity check before commit: run `npm run build && npm run preview`, open DevTools Network, turn on "Offline", hard-reload `/hardware`. Zero failed requests is the pass condition.

---

## 1. File layout

```
shared/
  campus.json                       # nodes + links, single source for simulator AND frontend
frontend/src/
  pages/Hardware.tsx                # page shell, sections, scroll container
  stores/hardwareStore.ts           # explode value, selected/hovered part, quality tier
  stores/meshStore.ts               # node bands, hop ring buffer, last-hop timestamp
  lib/ws.ts                         # the one WebSocket client, dispatches to stores
  lib/motionPrefs.ts                # useReducedMotion(), useDeviceTier()
  three/node/NodeScene.tsx          # Canvas, camera, lights, controls, shadows
  three/node/NodeModel.tsx          # iterates PART_REGISTRY, applies explode transform
  three/node/parts.ts               # PART_REGISTRY data array (the contract)
  three/node/partMeshes/*.tsx       # one small component per part (12 files)
  three/node/materials.ts           # shared materials + procedural textures
  three/node/Hotspot.tsx            # numbered chip (Html)
  three/node/useExplodeDriver.ts    # scroll + slider -> store, smoothing
  three/mesh/MeshScene.tsx          # Canvas, camera, plane, grid, outline
  three/mesh/Pillars.tsx            # 8 pillars, band colours
  three/mesh/Links.tsx              # dashed Lines
  three/mesh/Pulses.tsx             # InstancedMesh pulse pool driven by hop events
  three/mesh/campusGeometry.ts      # json -> world coords, outline polylines
  assets/schematic.svg              # hand-drawn block schematic (§9)
```

Files are small on purpose so three agents can work in parallel: (A) registry + scene + driver + hotspots, (B) the 12 part meshes + materials, (C) mesh scene + ws + stores. Interface between A and B is `parts.ts` and the `PartMeshProps` type. Interface between C and the backend is the hop event schema.

---

## 2. Units, axes, camera

- **1 world unit = 10 mm.** All numbers below are in world units; multiply by 10 for mm.
- Y is up. The node sits on the ground plane `y = 0`, lid on top, front wall (the one with the vents and the button) faces `+Z`.
- Origin is the centre of the enclosure footprint.
- Enclosure outer: **140 × 50 × 90 mm** => `[14, 5, 9]`. Slightly larger than a typical Hammond 1554 so the PMS5003 fits with a vented chamber; still a wall-mount box.
- PCB: **130 × 1.6 × 80 mm** => `[13, 0.16, 8]`, top face at `y = 0.66`.
- Camera: `PerspectiveCamera fov=30 near=0.5 far=200`, rest position `[16, 11, 18]`, target `[0, 2.2, 0]`. At full explode the stack spans `y ≈ -0.8 … 10.6`, so the controls target rises with explode: `target.y = 2.2 + 2.6 * t`.
- OrbitControls: `enablePan={false}`, `minDistance={16}`, `maxDistance={40}`, `minPolarAngle={0.25}`, `maxPolarAngle={1.35}`, `enableDamping`, `dampingFactor={0.08}`. No autorotate on the node scene (it competes with scroll).

---

## 3. Part registry (the contract)

Costs are the 1k-qty column of spec §4.1, split where the BOM lumps parts. They sum to **$30.80**, which is the "$31" on the stat strip. Hover/selected card shows `cost1k`, the sidebar total shows the sum.

```ts
// frontend/src/three/node/parts.ts
export type Vec3 = readonly [number, number, number]

export type PartId =
  | 'solar' | 'lid' | 'led' | 'antenna' | 'pms5003' | 'mq2' | 'bme280'
  | 'esp32s3' | 'sx1262' | 'cell18650' | 'power' | 'buzzer' | 'button'
  | 'pcb' | 'tray'

export interface Part {
  id: PartId
  /** 1-based number shown on the hotspot chip; 0 = no chip (pcb, tray) */
  index: number
  name: string
  spec: string          // one line of hard numbers for the card
  role: string          // one sentence, plain words, for the card
  cost1k: number        // USD at 1,000 units; 0 for parts counted elsewhere
  costNote?: string     // where the cost is counted when cost1k is 0
  rest: Vec3            // group position at explode = 0
  explode: Vec3         // added to rest at explode = 1 (before easing)
  delay: number         // 0..0.35, cascade: local_t = clamp((t - delay) / (1 - delay), 0, 1)
  hotspot: Vec3         // Html anchor, in the part's local space
  bus?: string          // interface to ESP32, shown as a mono tag on the card
}

export const PART_REGISTRY: readonly Part[] = [
  {
    id: 'solar', index: 1, name: '6 V 2 W solar panel',
    spec: '120 × 70 mm mono cell, 6 V, 2 W peak',
    role: 'Keeps an outdoor node alive indefinitely in Seattle summer and fall. Indoor nodes skip it and run on USB.',
    cost1k: 2.60,
    rest: [0, 5.06, 0], explode: [0, 5.5, 0], delay: 0.05, hotspot: [6.2, 0.2, 0],
  },
  {
    id: 'lid', index: 2, name: 'IP65 lid',
    spec: 'Polycarbonate, 142 × 92 × 10 mm, gasketed, 4 captive screws',
    role: 'Weather seal. The LED dome and the panel sit on it; everything else lives below.',
    cost1k: 2.20, costNote: 'includes tray + wall mount',
    rest: [0, 4.5, 0], explode: [0, 3.8, 0], delay: 0.0, hotspot: [7.3, 0, 0],
  },
  {
    id: 'antenna', index: 3, name: '915 MHz helical antenna',
    spec: 'Spring helical, ~28 mm, 2 dBi, u.FL to the LoRa module',
    role: 'The mesh radio\'s antenna. Vertical inside the lid so the box has no external stub to snap off.',
    cost1k: 0.90, bus: 'RF',
    rest: [-3.0, 0.66, 3.3], explode: [-0.4, 2.6, 0.6], delay: 0.15, hotspot: [0, 3.1, 0],
  },
  {
    id: 'pms5003', index: 4, name: 'PMS5003 particulate sensor',
    spec: 'Laser scattering, PM1 / PM2.5 / PM10, 50 × 38 × 21 mm, 5 V fan',
    role: 'The smoke sensor. Fan runs 30 s every 5 min in normal mode, continuously during an alert.',
    cost1k: 9.00, bus: 'UART2 · GPIO16/17 · SET GPIO4',
    rest: [4.4, 1.71, -1.5], explode: [1.4, 2.0, 0], delay: 0.20, hotspot: [2.0, 1.2, 0],
  },
  {
    id: 'mq2', index: 5, name: 'MQ-2 gas sensor',
    spec: 'Tin-oxide heater, ø 20 × 16 mm, 150 mA when hot, 20 s warm-up',
    role: 'Combustible gas and smoke confirmation. Cheap and unselective; the spec says so. Duty-cycled 10 s per minute.',
    cost1k: 0.60, bus: 'ADC · GPIO34 via 2:1 divider',
    rest: [4.4, 1.46, 3.0], explode: [1.1, 1.6, 0.7], delay: 0.22, hotspot: [1.2, 0.9, 0],
  },
  {
    id: 'bme280', index: 6, name: 'BME280 temp / RH / pressure',
    spec: '2.5 × 2.5 mm LGA on a 10 × 10 mm carrier, I²C 0x76',
    role: 'Heat rise is what separates a fire from smoke rolling in from outside. Read every 60 s.',
    cost1k: 0.90, bus: 'I²C · SDA GPIO21 · SCL GPIO22',
    rest: [2.6, 0.73, 3.3], explode: [0, 1.0, 1.0], delay: 0.24, hotspot: [0, 0.8, 0.6],
  },
  {
    id: 'esp32s3', index: 7, name: 'ESP32-S3-WROOM-1',
    spec: 'Dual-core 240 MHz, WiFi AP + BLE, 8 MB flash, 18 × 25.5 mm',
    role: 'Runs the captive portal, the local alert rules, and the mesh queue. The whole product is this chip.',
    cost1k: 3.20,
    rest: [-3.0, 0.72, -2.3], explode: [-0.8, 1.3, -0.3], delay: 0.18, hotspot: [-1.1, 0.5, -0.6],
  },
  {
    id: 'sx1262', index: 8, name: 'SX1262 LoRa module',
    spec: '915 MHz, +22 dBm, SF9 / BW125, SPI, 12 × 16 mm',
    role: 'Node-to-node relay. 300–600 m through buildings, 1–2 km with line of sight, further by hopping.',
    cost1k: 3.90, bus: 'SPI · NSS 5 · DIO1 26 · RST 14 · BUSY 27',
    rest: [-3.0, 0.72, 1.2], explode: [-0.8, 1.1, 0.4], delay: 0.18, hotspot: [-0.9, 0.5, 0],
  },
  {
    id: 'cell18650', index: 9, name: '18650 Li-ion cell + holder',
    spec: '3400 mAh, 3.6 V nominal, ø 18 × 65 mm',
    role: '3 days in normal mode with no sun; 12–18 h in full disaster mode with the AP and sensors on.',
    cost1k: 2.80,
    rest: [-5.3, 1.56, 0], explode: [-2.0, 1.4, 0], delay: 0.12, hotspot: [-1.2, 0.9, 0],
  },
  {
    id: 'power', index: 10, name: 'Charger + protection + 5 V boost',
    spec: 'TP4056, DW01 + FS8205, MT3608, P-MOSFET rail switch, USB-C in',
    role: 'Solar or USB in, protected battery out, 3.3 V for logic, switched 5 V for the fan and heater.',
    cost1k: 0.80, bus: '5V_EN GPIO33 · VBAT sense GPIO35',
    rest: [-0.6, 0.74, -2.6], explode: [0, 0.9, -1.2], delay: 0.20, hotspot: [0, 0.5, -1.4],
  },
  {
    id: 'buzzer', index: 11, name: 'Piezo buzzer',
    spec: 'ø 12 mm, 85 dB at 10 cm, PWM driven',
    role: 'Local alarm. Fires from the node\'s own rules even with no backend and no neighbours.',
    cost1k: 0.10, bus: 'PWM · GPIO25',
    rest: [-0.6, 0.66, 0.2], explode: [0, 0.8, 0], delay: 0.26, hotspot: [0, 0.6, 0],
  },
  {
    id: 'led', index: 12, name: 'WS2812 status LED + light pipe',
    spec: 'One addressable RGB pixel under a frosted dome',
    role: 'Green, amber, red at a glance. Red plus buzzer is the local alarm.',
    cost1k: 0.10, bus: 'GPIO2',
    rest: [-0.6, 0.74, 3.9], explode: [0, 1.6, 0.4], delay: 0.28, hotspot: [0, 3.6, 0],
  },
  {
    id: 'button', index: 13, name: '"I\'m here" button',
    spec: 'Sealed 16 mm dome, front wall, debounced in firmware',
    role: 'Muster-point check-in and wake-from-sleep. Pressing it also brings the WiFi AP fully up.',
    cost1k: 0.10, bus: 'GPIO0, pull-down',
    rest: [-3.6, 2.2, 4.5], explode: [0, 0, 1.8], delay: 0.10, hotspot: [0, 0, 1.0],
  },
  {
    id: 'pcb', index: 0, name: 'Main PCB',
    spec: '130 × 80 mm, 2-layer, passives, connectors, MOSFETs',
    role: 'Carries everything. Counted as "PCB, passives, connectors" in the BOM.',
    cost1k: 1.10,
    rest: [0, 0.58, 0], explode: [0, 0.5, 0], delay: 0.08, hotspot: [0, 0, 0],
  },
  {
    id: 'tray', index: 0, name: 'IP65 enclosure tray',
    spec: 'Vented sensor chamber on the right, sealed electronics bay on the left',
    role: 'Wall mount. Vent slots feed the PMS5003 intake; a divider keeps the fan out of the radio bay.',
    cost1k: 0, costNote: 'counted with the lid',
    rest: [0, 0, 0], explode: [0, -0.8, 0], delay: 0.0, hotspot: [0, 0, 0],
  },
] as const

export const ASSEMBLY_COST_1K = 2.50
export const BOM_TOTAL_1K = PART_REGISTRY.reduce((s, p) => s + p.cost1k, 0) + ASSEMBLY_COST_1K // 30.80
```

Note on numbering: the chips show 1–13 (button is 13; the BOM lumps button/LED/buzzer so it is honest to show three chips). The page copy says "thirteen parts" then. If a designer wants "twelve", merge the LED and the button into one "indicators" chip; do not change costs.

### 3.1 Per-part geometry, colour, material

Every part is a `<group position={rest + explode*e}>` containing the meshes below. Positions inside the group are local. All box args are `[x, y, z]`. Materials come from `materials.ts` (§4.1) by key.

| Part | Meshes (local) | Material |
|---|---|---|
| **tray** | floor `box [14, 0.3, 9]` at `[0, 0.15, 0]`; front/back walls `box [14, 3.7, 0.2]` at `z = ±4.4, y = 2.15`; left/right walls `box [0.2, 3.7, 8.6]` at `x = ±6.9, y = 2.15`; chamber divider `box [0.2, 3.3, 8.0]` at `[2.0, 2.31, 0]`; **vent slots**: 8 × `box [0.14, 1.2, 0.06]` at `x = 2.6 + i*0.5`, `y = 1.9`, `z = 4.53`; two wall-mount lugs `box [1.2, 0.3, 0.8]` at `[±5.5, 0.15, -4.9]` with a `cylinder r=0.18 h=0.32` hole plug in `vent` colour | `enclosure` on shell, `vent` on slots. Add `<Edges threshold={20} color="#4a4e56">` to the four walls only (floor edge is hidden anyway). |
| **lid** | `RoundedBox args=[14.2, 1.0, 9.2] radius={0.32} smoothness={6}` at `[0, 0, 0]`; gasket lip `box [13.4, 0.12, 8.4]` at `[0, -0.56, 0]` in `vent` colour; LED dome `sphere r=0.36` (top half only, `thetaLength=π/2`) at `[-0.6, 0.5, 3.9]` in `frost`; 4 screw heads `cylinder r=0.16 h=0.05` at `[±6.6, 0.52, ±4.1]` in `steel` | `enclosure` + `<Edges threshold={30} color="#5a5e66">` |
| **solar** | glass `box [12, 0.12, 7]` at origin, `solarGlass`; cell grid drawn into a `CanvasTexture` (6 × 4 cells, 0.06-unit silver gaps, two horizontal busbars per cell) used as `map`; aluminium frame: 4 × `box` strips 0.25 wide, 0.18 tall around the perimeter in `brushed` | `solarGlass` (physical, clearcoat) + `brushed` |
| **pcb** | `box [13, 0.16, 8]` at origin; silkscreen text is NOT rendered (no Text); instead 6 × `box [0.9, 0.01, 0.9]` pale pads at ESP32 / SX1262 / power footprints in `pad`; a mounting hole `cylinder r=0.16 h=0.2` at each corner `[±6.2, 0, ±3.7]` in `vent` | `pcb` (dark green-black, roughness 0.55) with `<Edges threshold={40} color="#1f3d2c">` |
| **esp32s3** | module PCB `box [1.8, 0.12, 2.55]` at `[0, 0, 0]`; shield can `box [1.6, 0.28, 1.75]` at `[0, 0.2, 0.25]` in `steelCan`; antenna keep-out `box [1.8, 0.13, 0.62]` at `[0, 0.005, -0.95]` in `pad`; 2 × 20 castellation stubs: skip (cost/benefit) | `pcbModule` + `steelCan` |
| **sx1262** | module PCB `box [1.2, 0.12, 1.6]`; shield can `box [1.05, 0.24, 1.15]` at `[0, 0.18, 0.1]` in `steelCan`; u.FL stub `cylinder r=0.1 h=0.15` at `[0.4, 0.2, -0.65]` in `brass` | `pcbModule` + `steelCan` + `brass` |
| **antenna** | base `cylinder r=0.16 h=0.4` at `[0, 0.2, 0]` in `brass`; **helix**: `TubeGeometry` on a custom `THREE.Curve` (`getPoint(t) => (r cos(2π·turns·t), h·t, r sin(2π·turns·t))`, `r=0.3`, `h=2.4`, `turns=9`, tubular segments 220, radius 0.045, radial segments 6) at `[0, 0.4, 0]` in `copper`; if time is short, replace with `cylinder r=0.3 h=2.4` plus 9 `torus r=0.3 tube=0.045` rings | `copper` |
| **pms5003** | body `box [3.8, 2.1, 5.0]` at origin in `steelCan`; fan grille `cylinder r=0.95 h=0.03` rotated `x = π/2` at `[0, 0.2, 2.52]` in `vent`; 8 grille spokes as thin `box [0.08, 1.6, 0.03]` rotated in 22.5° steps at the same spot in `steelCan`; exhaust slot `box [2.6, 0.5, 0.03]` at `[0, -0.4, -2.52]` in `vent`; 8-pin JST stub `box [0.9, 0.3, 0.35]` at `[-1.4, -0.9, 2.3]` in `plasticWhite` | `steelCan` |
| **mq2** | can `cylinder r=1.0 h=1.6` at `[0, 0, 0]` in `steelMesh` (roughnessMap = brushed texture, metalness 0.8); base ring `cylinder r=1.05 h=0.25` at `[0, -0.7, 0]` in `plasticBlack`; 6 legs `cylinder r=0.04 h=0.35` at `y = -0.95` on a 0.6-radius circle in `steel` | `steelMesh` |
| **bme280** | carrier `box [1.0, 0.14, 1.0]` at origin in `pcbModule`; sensor `box [0.25, 0.09, 0.25]` at `[0.1, 0.115, 0.1]` in `steelCan`; 4-pin header `box [0.9, 0.2, 0.2]` at `[0, 0.17, -0.4]` in `plasticBlack` | `pcbModule` |
| **cell18650** | cell `cylinder r=0.9 h=6.5` rotated `x = π/2` (axis along Z) at origin in `cellWrap` (teal #0f5c55, roughness 0.45); positive nub `cylinder r=0.35 h=0.12` at `z = 3.31` in `steel`; holder end blocks 2 × `box [2.0, 1.7, 0.4]` at `z = ±3.55, y = -0.1` in `plasticBlack` with a nickel tab `box [0.5, 0.9, 0.05]` in `steel` on the inner face | `cellWrap` |
| **power** | board `box [1.6, 0.16, 2.6]` at origin in `pcbBlue` (#0f2a5c); TP4056 IC `box [0.5, 0.12, 0.6]` at `[0.3, 0.14, 0.6]`; MT3608 inductor `cylinder r=0.35 h=0.4` at `[-0.35, 0.28, 0.2]` in `plasticBlack`; two electrolytics `cylinder r=0.22 h=0.5` at `[0.4, 0.33, -0.3]`, `[0.4, 0.33, -0.85]` in `plasticBlack`; USB-C shell `box [0.9, 0.32, 0.7]` at `[0, 0.24, -1.55]` in `steel`; MOSFET SOT-23 `box [0.3, 0.1, 0.3]` at `[-0.4, 0.13, -0.8]` | `pcbBlue` |
| **buzzer** | disc `cylinder r=0.6 h=0.45` at `[0, 0.225, 0]` in `plasticBlack`; sound hole `cylinder r=0.12 h=0.05` at `[0, 0.47, 0]` in `vent` | `plasticBlack` |
| **led** | SMD `box [0.5, 0.16, 0.5]` at `[0, 0, 0]`, `ledEmissive` (emissive follows the demo's current band colour, default green `#35c76a`, intensity 1.6); light pipe `cylinder r=0.28 h=3.2` at `[0, 1.68, 0]` in `frost` (transparent, opacity 0.5, emissive same colour × 0.35) | `ledEmissive` + `frost` |
| **button** | dome `cylinder r=0.7 h=0.4` rotated `x = π/2` at `[0, 0, 0.2]` in `accent` (amber #f2a33a, roughness 0.35); bezel `torus r=0.78 tube=0.09` rotated `x = π/2` at `[0, 0, 0.02]` in `plasticBlack`; shaft `cylinder r=0.3 h=0.5` at `[0, 0, -0.25]` in `plasticBlack` | `accent` |

Rest-state check: at `t = 0` the lid sits flush on the tray (lid bottom at `y = 4.0` = wall top), the panel sits on the lid (`5.06 - 0.06 = 5.0` = lid top), the light pipe top is at `0.74 + 3.28 = 4.02` just under the dome, the antenna top is at `0.66 + 0.4 + 2.4 = 3.46 < 4.0`, the PMS5003 top is at `1.71 + 1.05 = 2.76 < 4.0`. Nothing pokes through the lid.

---

## 4. Node scene

### 4.1 Materials (`materials.ts`)

All `MeshStandardMaterial` unless noted. Create once, share via a module-level record, never inline `new` in render.

| Key | Colour | roughness / metalness | Notes |
|---|---|---|---|
| `enclosure` | `#34373c` | 0.85 / 0.05 | matte graphite; a hair lighter than the page bg so it reads |
| `vent` | `#0f1113` | 0.9 / 0 | slots, holes, grilles |
| `frost` | `#e8ecf1` | 0.6 / 0, `transparent`, `opacity 0.5`, `depthWrite false` | dome, light pipe |
| `pcb` | `#0b1f16` | 0.55 / 0.1 | main board |
| `pcbModule` | `#0e1a2b` | 0.5 / 0.1 | module carriers |
| `pcbBlue` | `#0f2a5c` | 0.5 / 0.1 | power board |
| `pad` | `#c9b98a` | 0.4 / 0.6 | ENIG-ish pads and antenna keep-out |
| `steelCan` | `#b8bcc2` | 0.35 / 0.75 | shield cans, PMS body |
| `steel` | `#d0d3d8` | 0.3 / 0.9 | screws, tabs, USB shell |
| `steelMesh` | `#9a9ea3` | 0.45 / 0.8, `roughnessMap: brushedTexture` | MQ-2 can |
| `brushed` | `#aeb2b8` | 0.4 / 0.85, `roughnessMap: brushedTexture` | panel frame |
| `brass` | `#c9a24a` | 0.35 / 0.9 | u.FL, antenna base |
| `copper` | `#c8803a` | 0.3 / 0.9 | helix |
| `cellWrap` | `#0f5c55` | 0.45 / 0.05 | 18650 |
| `plasticBlack` | `#17191c` | 0.7 / 0 | |
| `plasticWhite` | `#e6e2d8` | 0.7 / 0 | JST |
| `accent` | `#f2a33a` | 0.35 / 0 | button; the page accent, use once |
| `ledEmissive` | `#ffffff` | 0.4 / 0, `emissive` set per band | |
| `solarGlass` | `MeshPhysicalMaterial`, base `#0b1d3a`, `map: solarTexture`, roughness 0.15, metalness 0.1, `clearcoat 1`, `clearcoatRoughness 0.08` | the one physical material in the scene |

Procedural textures (generated once in a `useMemo` / module singleton, `THREE.CanvasTexture`, `colorSpace = SRGBColorSpace` for `map`, `NoColorSpace` for roughness):

- `brushedTexture`: 256 × 256 canvas, fill `#888`, then 900 horizontal 1-px lines at random y with alpha 0.08–0.25 in white or black. `wrapS/T = RepeatWrapping`, `repeat (3, 1)`.
- `solarTexture`: 512 × 300 canvas, fill `#0b1d3a`; 6 × 4 cell grid with `#7c8590` 4-px gaps; two `#9aa3ad` 2-px busbars per cell; a faint diagonal `rgba(255,255,255,0.05)` gradient for gloss.

Metals without an environment map look flat. Compensate with the rim light in §4.2 and keep `metalness ≤ 0.9`. If there is spare time after 2:30 PM, `<Environment resolution={64}>` with two `<Lightformer>` children (no `preset`, no `files`) builds a PMREM from an in-memory scene and fetches nothing; it is the one drei Environment usage that is offline-safe. Treat it as a polish item, not the plan.

### 4.2 Lights (plain, no HDRI)

```tsx
<ambientLight intensity={0.35} />
<hemisphereLight args={['#3a3f48', '#0a0b0d', 0.6]} />
<directionalLight position={[5, 9, 4]} intensity={2.2} color="#fff4e6" />     // key, warm
<directionalLight position={[-7, 4, -6]} intensity={1.1} color="#9fb4ff" />   // rim, cool
<directionalLight position={[0, -3, 6]} intensity={0.35} color="#f2a33a" />   // accent bounce from below-front
```

No shadow maps. Grounding comes from `<ContactShadows position={[0, -0.85, 0]} opacity={0.55} scale={30} blur={2.4} far={12} resolution={384} color="#000" />`. It re-renders every frame while animating; at rest the demand loop stops anyway.

Background: `<color attach="background" args={['#0a0b0d']} />` or leave the canvas transparent (`gl={{ alpha: true }}`) over the page bg so the section gradient shows through. Use transparent; it is what makes the 3D feel embedded rather than boxed.

### 4.3 Scene graph skeleton

```tsx
// frontend/src/three/node/NodeScene.tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { NodeModel } from './NodeModel'
import { FrameloopController } from '../shared/FrameloopController'
import { SchematicFallback } from '../../components/SchematicFallback'

export function NodeScene({ inView, tier }: { inView: boolean; tier: 'full' | 'static' }) {
  return (
    <Canvas
      dpr={[1, tier === 'full' ? 1.75 : 1]}
      frameloop={tier === 'full' ? 'demand' : 'never'}
      camera={{ fov: 30, near: 0.5, far: 200, position: [16, 11, 18] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<SchematicFallback />}
    >
      <FrameloopController inView={inView} tier={tier} />
      <Lights />
      <NodeModel interactive={tier === 'full'} />
      <ContactShadows position={[0, -0.85, 0]} opacity={0.55} scale={30} blur={2.4} far={12} resolution={384} />
      {tier === 'full' && (
        <OrbitControls makeDefault enablePan={false} minDistance={16} maxDistance={40}
          minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping dampingFactor={0.08} />
      )}
    </Canvas>
  )
}
```

```tsx
// frontend/src/three/node/NodeModel.tsx
import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PART_REGISTRY, type Part } from './parts'
import { PART_MESHES } from './partMeshes'
import { Hotspot } from './Hotspot'
import { useHardwareStore } from '../../stores/hardwareStore'

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const localT = (t: number, delay: number) => THREE.MathUtils.clamp((t - delay) / (1 - delay), 0, 1)

export function NodeModel({ interactive }: { interactive: boolean }) {
  const groups = useRef<Record<string, THREE.Group | null>>({})
  const smooth = useRef(useHardwareStore.getState().explode)
  const controls = useThree(s => s.controls) as { target: THREE.Vector3; update: () => void } | null

  useFrame((state, dt) => {
    const target = useHardwareStore.getState().explode
    const reduced = useHardwareStore.getState().reducedMotion
    const k = reduced ? 1 : 1 - Math.exp(-dt * 9)
    smooth.current += (target - smooth.current) * k
    const t = smooth.current
    for (const p of PART_REGISTRY) {
      const g = groups.current[p.id]; if (!g) continue
      const e = easeOutCubic(localT(t, p.delay))
      g.position.set(p.rest[0] + p.explode[0] * e, p.rest[1] + p.explode[1] * e, p.rest[2] + p.explode[2] * e)
    }
    if (controls) { controls.target.y = 2.2 + 2.6 * t; controls.update() }
    if (Math.abs(target - smooth.current) > 1e-3) state.invalidate()   // keep demand loop alive while settling
  })

  return (
    <group>
      {PART_REGISTRY.map((p) => {
        const Mesh = PART_MESHES[p.id]
        return (
          <group key={p.id} ref={(el) => { groups.current[p.id] = el }} position={p.rest}>
            <Mesh part={p} interactive={interactive} />
            {interactive && p.index > 0 && <Hotspot part={p} />}
          </group>
        )
      })}
    </group>
  )
}
```

```tsx
// frontend/src/three/node/partMeshes/index.ts
export type PartMeshProps = { part: Part; interactive: boolean }
export const PART_MESHES: Record<PartId, React.ComponentType<PartMeshProps>> = {
  tray: Tray, lid: Lid, solar: Solar, pcb: Pcb, esp32s3: Esp32S3, sx1262: Sx1262, antenna: Antenna,
  pms5003: Pms5003, mq2: Mq2, bme280: Bme280, cell18650: Cell18650, power: Power, buzzer: Buzzer, led: Led, button: Button,
}
```

Each part mesh component: meshes as in §3.1, and on the outermost mesh (or a single invisible hit box `box` slightly bigger than the part) attach `onPointerOver / onPointerOut / onClick` that write `hoverPartId` / `selectedPartId` to the store, plus `useCursor(hovered)`. Hover feedback: scale the group `1.0 -> 1.03` via the same `useFrame` lerp, and set `emissive` on the part's primary material to `#f2a33a` at intensity 0.18. Do not clone materials per part on hover; use one shared `hoverMaterialOverlay` mesh (a transparent copy of the hit box with `emissive` accent, `opacity 0.12`) that is toggled `visible`.

### 4.4 Hotspots (`Hotspot.tsx`)

```tsx
import { Html } from '@react-three/drei'
export function Hotspot({ part }: { part: Part }) {
  const explode = useHardwareStore(s => s.explode)
  const selected = useHardwareStore(s => s.selectedPartId === part.id)
  const visible = explode > 0.55 || selected
  return (
    <Html position={part.hotspot} center zIndexRange={[20, 0]} pointerEvents={visible ? 'auto' : 'none'}
          wrapperClass="hotspot-wrap">
      <button
        onClick={() => useHardwareStore.getState().select(part.id)}
        onPointerEnter={() => useHardwareStore.getState().hover(part.id)}
        onPointerLeave={() => useHardwareStore.getState().hover(null)}
        className={clsx('hotspot', visible && 'is-visible', selected && 'is-selected')}
        aria-label={`${part.index}. ${part.name}`}>
        <span className="font-mono text-[11px] tabular-nums">{String(part.index).padStart(2, '0')}</span>
      </button>
    </Html>
  )
}
```

Chip style: 22 px circle, `bg-[#0a0b0d]/85 backdrop-blur border border-white/15 text-white/80`, selected => `border-[#f2a33a] text-[#f2a33a]`. Fade in with `transition: opacity 240ms, transform 240ms` and `translateY(4px) -> 0`. A 1-px leader line from chip to part is not worth it today.

No `occlude`. Occlusion raycasts every chip every frame; with 13 chips and a demand loop it is affordable, but chips hidden behind the lid at `t < 0.55` are already hidden by the visibility rule, and at high explode nothing overlaps. Skip it.

The part card (name, spec, role, bus tag, cost) is **DOM**, not Html: a fixed right rail in `Hardware.tsx` that reads `hoveredPartId ?? selectedPartId ?? 'esp32s3'` from the store. Animate swaps with `motion`'s `AnimatePresence` (`opacity + y 6px`, 180 ms). Below the card: a 13-row list with the same numbers; hovering a row hovers the part (two-way binding through the store), which is the accessible path for keyboard users.

### 4.5 Explode driver (`useExplodeDriver.ts`)

Page structure: the hero section is `h-[320vh]` with a `sticky top-0 h-screen` child holding the Canvas and rails. Scroll progress of that outer section maps to explode.

```ts
const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })
useMotionValueEvent(scrollYProgress, 'change', (v) => {
  if (useHardwareStore.getState().manual) return
  useHardwareStore.getState().setExplode(remap(v))   // remap: 0..0.08 => 0 (hold), 0.08..0.92 => 0..1, 0.92..1 => 1 (hold)
})
```

Slider: `<input type="range" min=0 max=1000>` in the bottom-left of the sticky frame. `onPointerDown` => `manual = true`; `onInput` => `setExplode(v/1000)`. Any `wheel` or `touchmove` on the section with `|deltaY| > 24` => `manual = false` and scroll takes over again. A "Reset view" button sets `explode = 0`, `manual = false`, and calls `controls.reset()` via a store-held ref.

`setExplode` triggers `invalidate()` through `FrameloopController` (subscribes to the store, calls `invalidate()` on change). The smoothing loop in `NodeModel` keeps calling `invalidate()` until settled.

Deep-linking: `?part=pms5003` selects that part and sets `explode = 0.85` on mount. Cheap, and useful for the Devpost screenshots.

---

## 5. Campus mesh scene

### 5.1 Data contract (`shared/campus.json`)

Consumed by the simulator (Python reads the file) and the frontend (Vite JSON import). Coordinates are a 0–100 campus grid, `u` east, `v` south. World mapping: `x = (u - 50) / 5`, `z = (v - 50) / 5`, a 20 × 20 plane. The same file feeds the 2D SVG map elsewhere on the site, so nobody hand-copies node positions.

```json
{
  "nodes": [
    { "id": "hub",      "label": "Founders Hall hub", "u": 50, "v": 52, "gateway": true,  "kind": "indoor" },
    { "id": "gym",      "label": "Gym",               "u": 26, "v": 40, "gateway": false, "kind": "indoor" },
    { "id": "field",    "label": "Upper field",       "u": 18, "v": 70, "gateway": false, "kind": "outdoor" },
    { "id": "library",  "label": "Library",           "u": 62, "v": 30, "gateway": false, "kind": "indoor" },
    { "id": "quad",     "label": "Quad",              "u": 44, "v": 74, "gateway": false, "kind": "outdoor" },
    { "id": "science",  "label": "Science wing",      "u": 78, "v": 48, "gateway": false, "kind": "indoor" },
    { "id": "cafeteria","label": "Cafeteria",         "u": 66, "v": 66, "gateway": false, "kind": "indoor" },
    { "id": "parking",  "label": "North lot",         "u": 84, "v": 20, "gateway": false, "kind": "outdoor" }
  ],
  "links": [
    ["hub","gym"], ["hub","library"], ["hub","quad"], ["hub","cafeteria"], ["hub","science"],
    ["gym","field"], ["field","quad"], ["quad","cafeteria"], ["cafeteria","science"],
    ["science","parking"], ["library","parking"], ["library","science"]
  ],
  "outline": {
    "boundary": [[6,10],[94,10],[94,90],[6,90]],
    "buildings": [
      [[40,44],[60,44],[60,60],[40,60]],
      [[18,32],[34,32],[34,48],[18,48]],
      [[54,22],[70,22],[70,38],[54,38]],
      [[70,40],[88,40],[88,56],[70,56]],
      [[58,58],[74,58],[74,74],[58,74]]
    ],
    "paths": [[[50,60],[50,74],[44,74]],[[34,40],[40,44]],[[60,52],[70,48]]]
  }
}
```

`parking` is deliberately only reachable via `science` or `library`: it is the node that shows multi-hop in the demo. The simulator's drop rate (15 %) makes `dropped: true` events common enough that judges see the red fall within a minute.

### 5.2 Hop event and store

WebSocket `WS /live?tenant=` sends, among other event types:

```ts
type HopEvent = { type: 'hop'; msg_id: string; from_node: string; to_node: string; hop: number; dropped: boolean }
```

`lib/ws.ts` owns the one socket for the whole app (reconnect with backoff 0.5 s → 8 s, jittered). It routes `type === 'hop'` to `useMeshStore.getState().pushHop(evt)` and `type === 'reading'`/`'alert'` to the band map. `pushHop` appends to a ring buffer of 200 for the DOM hop log and bumps a `hopSeq` counter. The 3D scene does **not** re-render on hops; `Pulses.tsx` subscribes imperatively:

```ts
useEffect(() => useMeshStore.subscribe((s, prev) => {
  if (s.hopSeq === prev.hopSeq) return
  spawnPulse(s.lastHop)   // writes into the pool, then invalidate()
}), [])
```

Node band colours (from spec §6.1, used for pillar emissive): Good `#35c76a`, Moderate `#e2c044`, USG `#f2a33a`, Unhealthy `#e5533d`, Very unhealthy `#8b4bd6`, Hazardous `#8a1c2c`. Offline / unknown `#3a3f48`.

### 5.3 Scene graph

```tsx
// frontend/src/three/mesh/MeshScene.tsx
export function MeshScene({ inView, tier }: Props) {
  return (
    <Canvas dpr={[1, 1.5]} frameloop={tier === 'full' ? 'demand' : 'never'}
            camera={{ fov: 32, position: [0, 15, 17], near: 0.5, far: 120 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            fallback={<StaticMapFallback />}>
      <FrameloopController inView={inView} tier={tier} continuous={tier === 'full' && !reducedMotion} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 10, 4]} intensity={1.2} color="#dfe6ff" />
      <Ground />                 {/* plane 26x26, #0d0f12, roughness 1 */}
      <Grid position={[0, 0.005, 0]} args={[26, 26]} cellSize={1} cellThickness={0.5} cellColor="#1a1d22"
            sectionSize={5} sectionThickness={1} sectionColor="#262a31" fadeDistance={40} fadeStrength={1.5} infiniteGrid={false} />
      <CampusOutline />          {/* drei Line polylines, y = 0.02 */}
      <Links />                  {/* dashed Lines, y = 0.35 */}
      <Pillars />                {/* 8 pillars + glow discs + Html labels */}
      <Pulses />                 {/* InstancedMesh pool */}
      <OrbitControls makeDefault enablePan={false} minDistance={12} maxDistance={30}
        minPolarAngle={0.35} maxPolarAngle={1.25} enableDamping dampingFactor={0.08}
        autoRotate={tier === 'full' && !reducedMotion} autoRotateSpeed={0.35} />
    </Canvas>
  )
}
```

**CampusOutline**: `boundary` as a closed `Line` in `#2b3038` lineWidth 1.2; each building as a closed `Line` in `#3a3f48` lineWidth 1; `paths` as `Line dashed dashSize={0.25} gapSize={0.2}` in `#262a31`. All at `y = 0.02` so they sit on the grid. Buildings also get a flat `planeGeometry` fill in `#111418` at `y = 0.01` so the outline reads as a map, not a wireframe.

**Pillars** (per node): `cylinder args=[0.18, 0.22, 1.6, 24]` at `y = 0.8`, `meshStandardMaterial` with `emissive = bandColour`, `emissiveIntensity 1.4`, `color #0a0b0d`; a glow disc `planeGeometry [2.2, 2.2]` rotated flat at `y = 0.015` with a radial-gradient `CanvasTexture` (`bandColour` → transparent), `AdditiveBlending`, `depthWrite false`, opacity 0.55; a thin base ring `torus r=0.34 tube=0.03` in `#3a3f48`. The gateway (`hub`) pillar is taller (2.4) and gets a second thin ring at the top and a slow-pulsing emissive (`0.9 + 0.5 sin(t * 2)`) when `continuous`. Label: `<Html position={[0, 2.0, 0]} center>` with the node label in 11 px mono, `#9aa3ad`, and the current band word in the band colour. A node with no reading in 90 s renders in the offline grey with a "no signal" label.

**Links**: one `Line` per entry in `links`, endpoints at the two pillar positions at `y = 0.35`, `dashed`, `dashSize 0.35`, `gapSize 0.22`, `lineWidth 1.4`, colour `#3a4150`, `transparent`, `opacity 0.9`. In `useFrame`, `material.dashOffset -= dt * 0.6` when `continuous`; static otherwise. When a hop starts on a link, that link's colour lerps to `#f2a33a` over 120 ms and back over 500 ms (write `material.color` directly, keep a per-link `heat` float).

**Pulses**: `InstancedMesh` of 24 spheres `r=0.11`, `meshBasicMaterial` colour white, `toneMapped=false`. Pool entry: `{ from: Vector3, to: Vector3, start: number, dropped: boolean, active: boolean }`. Per frame for each active entry: `p = (now - start) / 450 ms`, position = `lerp(from, to, easeOutQuad(p))` with `y = 0.35 + 0.35 * sin(π p)` (a little arc). Colour `#ffffff` for a good hop; for `dropped`, the pulse travels to `p = 0.6` then over the next 300 ms turns `#e5533d`, falls to `y = 0` and scales to zero. Completed entries free their slot; if the pool is full, the oldest is recycled. Each spawn calls `invalidate()`; the pool keeps calling `invalidate()` while any entry is active, so pulses animate even in `demand` mode (reduced-motion path).

Hop `hop` field (hop count) drives nothing visually today. Show it in the DOM hop log beside the scene: `SN-A1 · gym → hub · hop 2 · 14:03:11` and drops in red with `dropped`.

---

## 6. Performance budget

- `dpr={[1, 1.75]}` on the node scene, `[1, 1.5]` on the mesh scene. Never `window.devicePixelRatio` raw; a 3× phone would render 9× pixels.
- **Frameloop policy** (`FrameloopController`, shared): the Canvas mounts with `frameloop="demand"`. An `IntersectionObserver` on the section (threshold 0.15) sets `inView`. The controller calls `setFrameloop(inView && continuous ? 'always' : 'demand')`. `continuous` is true only for the mesh scene with autorotate and dash animation and `prefers-reduced-motion: no-preference`. The node scene is always `demand`; it renders only while explode settles, controls move, or hover changes. Off-screen scenes render nothing.
- Triangle budget: node model under 60k triangles (the helix tube is the biggest at ~2.6k, PMS grille spokes are negligible; `RoundedBox smoothness 6` is fine). Mesh scene under 15k.
- Draw calls: node scene ≈ 110 (13 parts, ~4–8 meshes each, plus Edges). Acceptable. Do not add per-vent InstancedMesh optimisation; it is not the bottleneck.
- Materials: shared singletons from `materials.ts`; the only per-instance material is the pillar emissive (8) and the link colour (12).
- Two Canvases on one page is fine in R3F 9; each owns a WebGL context. Do not add a third. If `WEBGL_lose_context` warnings appear in dev from HMR, ignore.
- `ContactShadows resolution 384` and `Html` count 13 + 8 are the two costs worth watching; both are well inside budget on the demo laptop (an M-series Mac).
- Remove `<Edges>` from the tray walls first if the node scene drops under 50 fps during explode; `LineSegments2` per wall is the cheapest thing to lose.

### Tiers (`useDeviceTier`)

| Tier | Condition | Behaviour |
|---|---|---|
| `full` | pointer: fine, viewport ≥ 900 px, `navigator.deviceMemory` unset or ≥ 4, WebGL2 available | everything above |
| `static` | otherwise (phones, tablets, low-memory laptops) | Canvas with `frameloop="never"`, `dpr 1`, no OrbitControls, no Html chips, explode pinned at 0.72, one `invalidate()` after mount (and one after fonts load, in case layout shifts). The part list below the canvas carries the numbers. The mesh scene in static tier renders one frame with all links and no pulses; the hop log is DOM. No screenshots, no PNG assets: the "static render" is the same code drawing a single frame. |
| `none` | no WebGL (the `fallback` prop) | the schematic SVG (§9) in place of the node scene; the 2D SVG campus map in place of the mesh scene |

`prefers-reduced-motion: reduce` (`useReducedMotion`, a `matchMedia` hook): smoothing factor 1 (explode snaps to the scroll/slider value, which the user controls, so it is not an animation), no autorotate, static dashes, no idle pulse on the hub, pulses become a 350 ms highlight of the link (amber, then back) with no travelling sphere, and `motion` transitions on the card become `duration: 0`. The chips still fade (opacity only).

---

## 7. What is deliberately not used

- `Float`: an idle bob would fight the scroll transform and keep the loop hot. If someone wants life at rest, do it in `NodeModel`'s `useFrame` as a `y += 0.02 * sin(t)` on the root group only while `inView && !reducedMotion && explode < 0.05`, and switch the node scene to `always` in that state. Optional; not in the 3:30 build.
- `Text`: network fetch; see §0.
- `Environment`: HDRI fetch; see §0 and the Lightformer note in §4.1.
- `Bounds`, `Center`, `Resize`: the model is authored in known units; no auto-fitting. `Bounds` would also animate the camera on mount, which fights the scroll driver.
- Post-processing (`@react-three/postprocessing`): not in the stack list, and bloom on the pillars is tempting but costs a full-screen pass. The additive glow discs give 80 % of the look for 0 % of the cost.
- Shadow maps: ContactShadows only.

---

## 8. Page layout (`Hardware.tsx`) and copy

Sections, top to bottom. Tailwind v4, page bg `#0a0b0d`, ink `#f4f1ea`, muted `#9aa3ad`, accent `#f2a33a` (once per viewport).

1. **Hero / explode** (sticky, 320vh). Left rail (max-w 34ch): kicker `HARDWARE · SENTINEL NODE` in mono, headline in Bricolage Grotesque at `clamp(3rem, 8vw, 7.5rem)` line-height 0.92: `Thirteen parts. Thirty-one dollars. No internet required.` Subline: `Designed today, not fabricated, per organiser guidance. Every sensor and radio on this page is simulated in the demo.` Right rail: part card. Bottom-left: slider + `EXPLODE 00–100` mono readout + Reset. Bottom-right: `drag to orbit · scroll to explode`.
2. **Stat strip** (4 cells, hairline dividers, big mono numbers): `$31` per node at 1k · `3 days` battery, no sun · `1–2 km` LoRa line of sight · `12–18 h` full disaster mode.
3. **How it stays alive** (numbered 01–04, one line each): solar or USB in → protected cell → 3.3 V always-on for MCU and radio → switched 5 V for fan and heater, cut in sleep.
4. **BOM table**: the spec §4.1 table verbatim, three price columns, total row. Rows hover-link to the 3D part (`?part=`).
5. **Schematic**: `schematic.svg` full-bleed with a caption `Block-level schematic. Pin numbers per spec §3.2.` and a download link to the same SVG (it is the Devpost schematic image too).
6. **Mesh**: headline `Eight boxes, one radio channel, no tower.` Left: `MeshScene` (aspect 16:10). Right: live hop log (DOM, last 12 events), drop counter, `15 % simulated packet loss` label, and the honest footer line `Simulated node · schematic in submission`.
7. **Footer strip**: link to `/`, `/admin`, `/responder`, plus the "report safely" style block adapted: `If you are in danger right now, call 911. Sentinel supplements code-required detection; it does not replace it.`

Terminology on this page: product **Sentinel**, device **Sentinel Node**, SSID `SENTINEL-<node_id>`, incident codes `SN-XXXX`. No "Cascadia Node" anywhere.

---

## 9. Schematic SVG plan (`assets/schematic.svg`)

Block-diagram level. An agent hand-draws it as clean SVG: 1600 × 1000 viewBox, dark bg `#0a0b0d`, block fill `#111418`, stroke `#3a3f48` 1.5 px, text `#f4f1ea` in the same self-hosted mono (SVG `font-family: 'JetBrains Mono Variable', ui-monospace`), net labels in `#9aa3ad`, power nets in `#f2a33a`, RF in `#8b4bd6`, data buses in `#5aa9ff`. Rounded rects `rx=6`. Orthogonal wires only, junction dots `r=3`. Title block bottom-right: `SENTINEL NODE · rev A · block schematic · 2026-09-12 · not fabricated`.

**Known inconsistency to handle honestly:** spec §3.2 numbers pins for a classic ESP32 DevKit (GPIO21/22 for I²C, GPIO23/19/18/5 SPI, GPIO34/35 ADC). The ESP32-S3 has no GPIO22–25, and GPIO26–32 are taken by flash/PSRAM. Do not remap silently today; draw the spec's numbers and add a footnote in the title block: `Pin numbers per spec §3.2 (ESP32 DevKit numbering); S3 remap pending.` Judges who know will respect the note more than a silent guess.

### Blocks (left to right, three rows)

Row 1, power (top):
1. `SOLAR 6 V 2 W` (two-pin symbol, `+`/`−`)
2. `USB-C 5 V IN` with `SCHOTTKY OR` diode pair into the same node (`VIN`)
3. `TP4056 CHARGER` (pins: `VIN`, `BAT+`, `BAT−`, `CHRG`, `STDBY`); small `1 A PROG` resistor note
4. `DW01 + FS8205 PROTECTION` (`B+`, `B−`, `P+`, `P−`)
5. `18650 3400 mAh` cell symbol
6. `MT3608 BOOST 5 V` (`VIN`, `VOUT 5 V`, `EN`)
7. `P-MOSFET 5V_SW` (gate from `5V_EN GPIO33`, note `cut in sleep`)
8. `3.3 V REGULATOR` (`VBAT` → `3V3`, note `LDO / buck, 600 mA`)
9. `VBAT SENSE ÷2` divider → `GPIO35`

Row 2, MCU (centre), one large block:
10. `ESP32-S3-WROOM-1` with pin stubs on all four sides: `3V3`, `GND`, `EN`, `GPIO0 BTN`, `GPIO2 LED_DIN`, `GPIO4 PMS_SET`, `GPIO16 U2_RX`, `GPIO17 U2_TX`, `GPIO21 SDA`, `GPIO22 SCL`, `GPIO23 MOSI`, `GPIO19 MISO`, `GPIO18 SCK`, `GPIO5 NSS`, `GPIO26 DIO1`, `GPIO14 RST`, `GPIO27 BUSY`, `GPIO25 BUZ`, `GPIO33 5V_EN`, `GPIO34 MQ2_A`, `GPIO35 VBAT_S`. Inside: `WiFi AP 192.168.4.1 · captive DNS · BLE · mesh queue 256`.

Row 3, peripherals (bottom), left to right:
11. `PMS5003` (`VCC 5V_SW`, `GND`, `TX`, `RX`, `SET`)
12. `BME280` (`VDD 3V3`, `GND`, `SDA`, `SCL`, note `addr 0x76`), with 2 × `4.7 kΩ` pull-ups to `3V3`
13. `MQ-2` (`H+ 5V_SW`, `H−`, `A0`) with `÷2 DIVIDER` block before `GPIO34`, note `20 s warm-up, 150 mA heater`
14. `SX1262 LoRa 915 MHz` (`3V3`, `GND`, `MOSI`, `MISO`, `SCK`, `NSS`, `DIO1`, `RST`, `BUSY`, `ANT`)
15. `HELICAL ANT 915 MHz` (antenna symbol) on `ANT` via `u.FL`, net label `RF`
16. `BUTTON` (tactile to `GPIO0`, `10 kΩ` pull-down, note `debounced in fw`)
17. `WS2812` (`5V_SW`, `GND`, `DIN GPIO2`, note `330 Ω series, 100 nF`); it is on the switched 5 V rail on purpose, so document `LED off in deep sleep`
18. `PIEZO BUZZER` via `NPN DRIVER` (`GPIO25` → `1 kΩ` → base, flyback diode)

### Nets (label every one, once per segment)

Power: `VIN`, `BAT+`/`VBAT`, `BAT−`/`GND`, `5V` (boost out), `5V_SW` (switched), `3V3`, `GND` (ground symbols, not a bus).
Control: `5V_EN`, `PMS_SET`, `BTN`, `LED_DIN`, `BUZ`, `VBAT_SENSE`, `MQ2_A`.
Buses: `UART2 (U2_TX, U2_RX)`, `I2C (SDA, SCL)`, `SPI (MOSI, MISO, SCK, NSS)`, `DIO1`, `RST`, `BUSY`.
RF: `ANT` / `RF`.

### Annotations (small mono text, muted)

- Beside the power row: `Normal ~12 mA avg · disaster 180–250 mA · 3400 mAh ≈ 3 days normal, 12–18 h disaster`
- Beside the MCU: `Local alarm rules run here. No backend needed.`
- Beside SX1262: `+22 dBm · SF9 · BW125 · flooding mesh, TTL 8, de-dup by msg_id`
- Bottom-left legend: colour key for power / data / RF / control, and `Hardware designed, not fabricated (organiser guidance). Demo sensors and radio are simulated.`

Export: keep it a single `.svg` with no `<image>`, no external CSS, no `@import`. Also rasterise once to `docs/schematic.png` at 2× for Devpost (that is outside this page's build and can be done with any browser "save as PNG").

---

## 10. Build order and time boxes (start 10:30 AM)

| # | Work | Agent | Box | Done when |
|---|---|---|---|---|
| 1 | `shared/campus.json`, `stores/*`, `lib/ws.ts`, `lib/motionPrefs.ts`, `FrameloopController` | C | 10:30–11:10 | store unit tests pass, ws reconnects, hop ring buffer fills from a fake socket |
| 2 | `parts.ts`, `materials.ts`, `NodeScene`, `NodeModel`, `Hotspot`, `useExplodeDriver`; part meshes stubbed as boxes | A | 10:30–11:45 | scroll and slider explode 15 grey boxes with numbered chips; offline build has zero network requests |
| 3 | 13 real part meshes per §3.1 (tray, lid, solar, pcb, esp32s3, sx1262, antenna, pms5003, mq2, bme280, cell18650, power, buzzer, led, button) | B | 10:45–12:30 | model looks like the product at rest; nothing pokes through the lid at `t=0` |
| 4 | `MeshScene`, `CampusOutline`, `Links`, `Pillars`, `Pulses` against the real simulator | C | 11:10–12:45 | pulses travel on real hops; drops fall red; 60 fps with autorotate |
| 5 | `Hardware.tsx` layout, copy, stat strip, BOM table, part card, hop log, tiers, reduced motion | A | 11:45–1:15 | Lighthouse a11y ≥ 90; phone tier renders one frame; `?part=` deep link works |
| 6 | `schematic.svg` per §9 | B | 12:30–1:30 | opens in Chrome and Safari offline, text is selectable, PNG exported |
| 7 | Polish pass: hover overlay, dash heat, card transitions, brushed textures, optional Lightformer env | A + B | 1:30–2:30 | |
| 8 | Freeze. Offline hard-reload test, phone hotspot test, screenshots for Devpost | all | 2:30–3:30 | |

Cut list, in order, if behind at 1:15 PM: (1) helix → cylinder with rings; (2) brushed/solar `CanvasTexture`s → flat colours; (3) pulse pool → link colour flash only; (4) autorotate + dash animation → static; (5) mesh scene entirely → reuse the 2D SVG map with the hop log. Never cut: explode, hotspots, part card, schematic. Those are the Best IoT and Execution points.

---

## 11. Acceptance checklist

- [ ] `npm run build` clean; `npm run preview` with DevTools Offline: zero failed requests on `/hardware`.
- [ ] No `Text`, `Environment preset/files`, `useGLTF`, `useTexture(url)` anywhere in `src/three`.
- [ ] `react` and `react-dom` resolve to `19.2.x`; `npm ls @react-three/fiber` shows no peer warnings.
- [ ] At `explode = 0` the node reads as a closed product; at `1` all thirteen chips are visible and none overlap another chip at the default camera.
- [ ] Slider and scroll both drive explode; scrolling after a slider drag hands control back.
- [ ] Hover on a 3D part, a chip, or a list row all highlight the same part and update the card.
- [ ] Mesh scene shows a pulse within 2 s of the simulator starting; a dropped hop is visibly red.
- [ ] Reduced motion: no autorotate, no dash scroll, no travelling pulse; page still fully usable.
- [ ] Phone (tier `static`): one frame renders, no controls, list below; page scrolls normally with no scroll hijack.
- [ ] No WebGL: schematic SVG and 2D map appear in place of both canvases.
- [ ] The word "Cascadia" does not appear on the page; codes are `SN-XXXX`; SSID text is `SENTINEL-<id>`.
