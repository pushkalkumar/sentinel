# Sentinel design, revision 2

Supersedes DESIGN.md §3, §5, §6 and the per-page density rules. Everything not mentioned here stays as DESIGN.md says (two grounds, Lucide only, mono means data, no emoji, hop is the signature).

Why: the founder's read of the current build is "AI slop, cluttered, cheap 3D, neon blue". The fixes are the same fix. Fewer things on screen, one quiet highlight instead of a glowing accent, whitespace instead of borders, and a 3D scene lit like a product photo instead of a game engine default.

Tokens in this file are live in `frontend/src/styles/app.css` and the shared `components/ui/*`. Page agents only need to delete and re-space.

---

## 1. Palette

Ground stays warm near-black. The accent changes from signal cyan to a two-part system: **bone** is the highlight, **dusty teal** is telemetry only.

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#0B0A09` | page |
| `surface` | `#141211` | panels, tables |
| `raised` | `#1C1917` | inputs, segmented track, code pills, hover rows |
| `overlay` | `#252220` | menus, toasts, active segment |
| `line` / `line-strong` / `line-faint` | white at 7% / 12% / 4% | the only borders allowed |
| `ink` | `#EDE8E0` | primary text |
| `ink-2` | `#A29C93` | body on landing, secondary |
| `ink-3` | `#6B665F` | labels, table headers, timestamps |
| `ink-4` | `#45413C` | honesty line, disabled |
| **`accent`** | **`#D9CFC0`** | primary button fill, focus ring, selected row bar, prose links |
| `accent-ink` | `#141210` | text on a bone button |
| `accent-dim` | `rgba(217,207,192,0.10)` | selected row, selection highlight |
| `accent-line` | `rgba(217,207,192,0.28)` | hairline on the active card |
| **`signal`** | **`#7F9FA0`** | live dot, hop dash, mesh links, "delivered". Nothing else. Under 2% of any screen |
| `signal-ink` | `#0E1817` | never needed for a fill; kept for the LoRa hotspot label |
| `signal-dim` / `signal-line` | teal at 12% / 36% | live card tint |

State, desaturated by roughly a third, still separable at a glance:

| Token | Hex | Was |
|---|---|---|
| `alarm` | `#E0574B` | `#FF4A3D` |
| `warn` | `#D9A441` | `#FFB224` |
| `ok` | `#6DB87A` | `#5AD46E` |
| `band-good` | `#6DB87A` | |
| `band-moderate` | `#D9C45A` | `#F2D94E` |
| `band-usg` | `#E29A52` | `#FF9A3C` |
| `band-unhealthy` | `#E0574B` | `#FF4A3D` |
| `band-veryunhealthy` | `#A88BD1` | `#B98BF0` |
| `band-hazardous` | `#B8475A` | `#D94A62` |

Rules: the alert banner is `alarm-dim` background with `alarm` text, not a solid red bar. Big readings (the 160) are `ink`, with the band pill carrying the colour. Coloured text on canvas only for the pill and the map dot.

Light field palette (`/m/*`): `f-signal` becomes `#2F6B6C`, `f-alarm` `#C2372B`. Otherwise unchanged.

## 2. Declutter rules

1. **Max 5 top-level elements per desktop viewport.** Header, one primary object, one supporting object, one action row, one honesty line. If a sixth thing wants in, it goes below the fold or gets merged.
2. **One mono signage label per panel**, never per row and never per stat. Rows use sans `ink-3` for secondary text.
3. **No eyebrow / kicker** on a section unless the section is a real step in a real sequence. `PageHeader eyebrow` stays in the API but pages stop passing it. Landing hero loses "SENTINEL NODE · SEATTLE · 2026".
4. **No SIM tag in a panel header.** Exactly one honesty line per page, footer level, `ink-4`, 12px, sentence case: "Simulated: 8 virtual nodes, schematic in submission". `SimTag` now renders as plain text for this purpose.
5. **Whitespace scale:** `--spacing-section` 128px desktop, 80px mobile; `--spacing-stack` 40px between groups; `--spacing-panel` 24px inside a panel. Tailwind: `py-section`, `gap-stack`, `p-panel`.
6. **Fewer hairlines.** Group by whitespace. A panel has no border and no header rule. A table has hairline rows only, no header rule stronger than a row. StatStrip has no cell borders. Cards never nest inside cards.
7. **One bordered thing per view at most**, and only when it is interactive (the active incident card, a selected row).
8. **Radius:** panels 14px, buttons and inputs 8px, chips 4px, pills full. Outer radius = inner radius + padding when nested.
9. Copy: sentence case, plain, no middots as separators in running text. Meta strings like "sort: priority, then trust" are deleted, not restyled.

## 3. Typography

- Display stays Archivo Variable, but weight is now 480 to 540 (was 520 to 620) and width 84% to 100%. Headlines no longer shout. `display-hero`, `display-h1`, `display-h2`, `stat-number` utilities already carry this.
- Body is IBM Plex Sans at **17px / 1.7 on landing** (`prose-landing` utility, `ink-2`, max 64ch) and 15px / 1.6 in consoles.
- Mono only for numbers, codes, timestamps, node IDs. Never for descriptive sentences, spec descriptions, or button labels. The hardware rail's part description moves to sans.
- `label-signage` is 11px, weight 500, tracking 0.10em, `ink-3`. One per panel.
- Headings use `text-wrap: balance`, body `text-wrap: pretty` (set in base).

## 4. Per-page declutter

**Landing `/`**
- Delete the hero eyebrow and the "Scripted 24 s loop on the right" caption; the single honesty line at the footer covers it.
- Hero card: drop the header row (school name, clock, LIVE, SIM). Keep the map, the decision card and the last two log lines. Decision card shows headline, reading, band pill; delete the duplicate guidance sentence and the "Rule:" line.
- Two buttons: primary bone "Open the console", ghost "See the hardware". No icons in hero buttons.
- StatStrip sits alone on canvas with 128px above and below. Labels become sentence case: "per node at 1,000 units".
- Merge "How it works" steps into one column of three short paragraphs with a hairline between none of them; delete numbered chips.
- Pull quote, pricing, honesty: pricing becomes a single line of three figures, honesty becomes the footer line.

**`/hardware`**
- Header bar: drop "SENTINEL NODE · REV A · DESIGNED, NOT FABRICATED". Nav stays.
- Left column: the four-line headline at 540 weight, one sentence under it. Delete the eyebrow.
- Rail: 320px, no left hairline, no PART / SPEC signage rules. Part list rows lose their 01..13 numbers (labels on the model carry identity). Price column right, mono.
- Explode slider: thin bone track, no numeric readout beside it. "Reset view" becomes a ghost button. Delete the "drag to orbit · scroll to explode" hint; show it once as a 3 s toast on first interaction.
- Spec block moves below the part list with 40px gap, mono values only, sans keys.

**`/admin` overview**
- Alert banner: `alarm-dim` tint, sentence case, one line, no clock.
- Decision card and campus map merge into one panel: map fills, decision card sits as an overlay chip top-left, no border. Delete "since 14:41", "Rule:" line, and the duplicate guidance sentence.
- Right rail: Nodes list loses the dash sparklines and "watch" words; reading in `ink`, band as a 6px dot. Open incidents and mesh log keep only the last 3 lines each.
- Remove the air / mesh segmented toggle from the panel header; it becomes a ghost button pair under the map.
- No SIM tag; footer honesty line.

**`/responder`**
- Fire banner: tinted, not solid. Keep the text; drop the clock.
- Queue column: remove "sort: priority, then trust" and the chevron. Card has code, headline, place, trust pill, time. Four lines maximum.
- Map header: keep school name and incident code, delete SIM tag and "Tone off" into the nav's right group.
- Sensor strip: five values, no arrows; deltas shown on hover only.
- LOCAL_FIRE mono line moves into the banner.

**`/admin/drill`**
- Roll call grid: tiles with no border; status by a 3px bottom bar in `ok` / `warn` / `alarm`.
- One header with class count and elapsed time; delete per-tile timestamps.
- Actions: one primary bone "Close drill", one ghost "Export".
- SMS outbox collapses to a count with a disclosure.

**Phone `/m/*`**
- Keep the light ground and system font. Drop every hairline card; sections separated by 32px.
- One primary button per screen, full width, bone on light becomes `f-ink` solid.
- Remove the "in production this page is served by the node" tag from headers; footer line only.
- Code display: bigger cells, no borders between them.

## 5. 3D spec (for the fe-3d agent)

Goal: a product photograph, not a viewport. Reference: Teenage Engineering and Apple exploded views. Everything ships in the bundle; no HDR files, no presets.

**Lighting.** `<Environment resolution={256} frames={1}>` with no `files` and no `preset`, containing drei `<Lightformer>`s: key `form="rect"` intensity 3 at [3, 4, 2] pointing at origin, scale [4, 3]; fill `form="rect"` intensity 0.8 at [-4, 2, 1] scale [6, 4] colour `#EDE8E0`; rim `form="ring"` intensity 2 at [0, 3, -5] colour `#7F9FA0` (the only teal in the scene). Plus one `directionalLight` intensity 1.2 with `castShadow` and 2048 shadow map from the key position, and `ambientLight` 0.15. Canvas: `gl={{ toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: SRGBColorSpace }}`, `shadows="soft"`.

**Materials.** Five, no more.
- Enclosure and lid: `MeshPhysicalMaterial` `#242220`, roughness 0.42, clearcoat 0.6, clearcoatRoughness 0.25. Lid transmission 0 (no glass). Every box is drei `RoundedBox` with radius 0.04 to 0.08 and `smoothness={6}`. No sharp boxes anywhere.
- Brushed aluminium (ESP32 can, SMA, cell terminals): `MeshPhysicalMaterial` `#B9B7B2`, metalness 1, roughness 0.35, anisotropy 0.6, anisotropyRotation π/2.
- PCB: `MeshStandardMaterial` `#151716`, roughness 0.7, with a 512px `CanvasTexture` map of traces (1px `#2A3330` lines, a few pads `#8F8A7C`, silkscreen text "SENTINEL REV A" in `#D9CFC0` at 60% alpha) tiled once.
- Battery wrap: `MeshStandardMaterial` `#2D4C6D`, roughness 0.5, with a CanvasTexture label ("18650 3400 mAh", a stripe) on the cylinder.
- Solar panel: `#0E1A2E` metalness 0.5 roughness 0.3 with a CanvasTexture cell grid (`#1A2E4A` lines), plus a thin clearcoat.

**Parts, real proportions (mm, scene units = mm / 40).**
- PMS5003 50×38×21: box with a 22 mm round fan grille recess on top (ring of 8 slots via `Shape` extrude) and an 8-pin JST header on the side.
- ESP32-S3-WROOM 18×25.5×3.1: aluminium can on a green-black substrate, 2 mm meander antenna trace drawn in the PCB texture at one end.
- 18650: 18 mm dia × 65 mm cylinder, shrink-wrap label, nickel nub on positive end, flat negative end, sits in a holder with two spring contacts.
- SX1262 LoRa 24×14: small board with a 3 mm shielded can, an SMA jack (aluminium cylinder + hex flange) and a 915 MHz helical antenna: `TubeGeometry` along a 6-turn `CatmullRomCurve3`, copper `#B87333` metalness 1 roughness 0.3, 28 mm tall.
- BME280 2.5×2.5 on a 10×12 breakout; MQ-2 18 mm dia × 17 mm stainless mesh can (aluminium mat, roughness 0.6).
- Piezo 12 mm disc, WS2812 5 mm with a frosted light pipe (`MeshPhysicalMaterial` transmission 0.8, roughness 0.5), tactile button 6 mm.

**Exploded layout.** A calm vertical stack, not a burst. Parts translate only on Y (lid +1.1, panel +1.5, chamber sensors +0.5, PCB 0, battery −0.7) with no rotation. Explode factor eased with `--ease-enter`. Labels: at factor > 0.6 each part gets a 1px `line-strong` leader (drei `Line`, `lineWidth={1}`) from its edge to a `Html` label at the left or right margin, alternating sides, sorted by Y so leaders never cross. Label is sans 13px `ink` with the price in mono `ink-3` under it. Delete the numbered chips.

**Ground.** `ContactShadows opacity={0.55} blur={2.8} far={2} resolution={1024}` plus a radial gradient plane (`#141211` to canvas, 6 units) so the object sits in a soft pool. No grid.

**Post.** `EffectComposer multisampling={4}` with `<N8AO aoRadius={0.4} intensity={1.2} />` (fall back to `SSAO` if N8AO is unavailable in this build), `<Bloom intensity={0.2} luminanceThreshold={0.9} mipmapBlur />`, `<Vignette eskil={false} offset={0.25} darkness={0.55} />`.

**Camera and motion.** PerspectiveCamera fov 28 at [3.2, 2.1, 3.6] looking at [0, 0.2, 0]. OrbitControls: no zoom, no pan, polar ±20°, azimuth ±35°, damping 0.06. Idle: a 0.04 rad/s slow drift that stops on first pointer interaction and never resumes. Reduced motion: no drift, explode snaps.

## 6. Shared component notes

- **Button:** `primary` solid bone with `accent-ink` text; `secondary` outline `line-strong`, transparent; `ghost` text only; `danger` and `resolve` are outlines that tint on hover, never solid. Height 40px, radius 8px, icon 18px, `active:scale-[0.98]`.
- **Pill:** 24px, weight 400, `${color}1F` tint with coloured text; unhealthy and up stay solid per DESIGN §6.2 but now muted. `code` pill is a `raised` chip with no border.
- **Panel:** `surface` background, radius 14px, no border, no header rule, 24px padding. `live` shows a small teal dot before the title instead of a teal border. Keep `right` for controls only.
- **Segmented:** `raised` track, no border, active segment `overlay`.
- **StatStrip:** no borders. Figures at 56 to 76px weight 480, labels 13px `ink-3` sentence case, 40px column gap.
- **DataTable:** hairline rows only, last row unruled, header 12px `ink-3` sans, selected row `accent-dim` with a 2px bone bar.
- **PageHeader:** 40px top, 32px bottom, h1 at 40px. Eyebrow optional and discouraged.
- **SimTag:** plain `ink-4` 12px text. One per page, at the bottom.
- **Banner:** tint background (`alarm-dim`, `warn-dim`, `signal-dim`), coloured text, no solid fills. Update next.
