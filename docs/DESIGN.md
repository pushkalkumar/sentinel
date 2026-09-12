# Sentinel design system

Design brief for the Sentinel web app: landing, `/admin/*`, `/responder/*`, phone `/m/*`, and the `/hardware` 3D page. Six agents build these in parallel today. This document is the single source of truth for how anything looks and moves. If a question is not answered here, pick the quieter option and match the nearest example in this file. Do not invent new colors, fonts, radii, or easings.

Product name is **Sentinel**. The device is the **Sentinel Node**. Incident codes are `SN-XXXX`. If you see "Cascadia Node" or `CN-` anywhere in the spec, treat it as Sentinel Node / `SN-`.

---

## 0. Read this first (the 12 rules)

1. Two grounds, on purpose. **Command surfaces are dark** (landing, admin, responder desktop, hardware). **Field surfaces are light** (every `/m/*` phone page). A dark phone screen is unreadable at a sunlit muster point; a light desktop console is wrong for a room with the lights down. Do not mix them.
2. One brand accent: **signal cyan `#46D2E4`**. It means "live telemetry / this is Sentinel talking". It is never used for state. Budget: under 5 percent of any screen.
3. All warm hues (green, yellow, orange, red, purple, maroon) are reserved for **state**: AQI bands, alert priorities, roll-call status. That is why the brand accent is cool. An amber button next to a Moderate pill would read as the same thing.
4. Surfaces are separated by **hairlines, not shadows**. Shadows exist only for things that float (menus, toasts, the phone sheet).
5. Type: **Archivo Variable** for display and signage labels (use its width axis), **IBM Plex Sans Variable** for body and UI, **IBM Plex Mono** for data. Phone pages use the system stack on purpose (section 4.5).
6. Monospace means **data**: readings, codes, timestamps, node IDs, hop logs, trust math. Never as decoration on a heading or a paragraph.
7. Radius hierarchy: 2 / 4 / 8 / 14. Pills are fully round. Nothing else is.
8. No emoji. Icons are Lucide at 1.5px stroke, 16px in dense UI, 20px in buttons, never larger than 24px, never centered above a heading.
9. Motion signals state or carries information (a hop traveling, a band flipping, a roll call arriving). Nothing fades in for decoration. Every animation has a `prefers-reduced-motion` fallback.
10. Every simulated thing carries exactly one **SIM tag** (section 6.13) per view, not per widget.
11. Copy is plain and specific. Banned words: elevate, unlock, supercharge, seamless, empower, streamline, leverage, all-in-one, beacon, journey, "not just X, it's Y". No em dashes in UI copy. Sentence case everywhere except signage labels.
12. Render it and look at it. A blank `#root` is a failed page regardless of how the code reads.

---

## 1. Brief

- **User (command):** a school office administrator at 7:40 AM deciding whether recess is outdoors; a warehouse ops lead; a county responder watching a queue during a smoke event. Desktop, often a second monitor, room lights low during an incident.
- **User (field):** a teacher at a muster point with 28 kids; a stranger who just joined a box's WiFi with 8 percent battery and shaking hands. Phone, outdoors, bright, possibly smoky.
- **Core job:** turn sensor readings into one unambiguous decision, and turn a tap into a verified incident a responder can close.
- **Tone:** calm authority. An instrument panel, not a dashboard. The interface is never louder than the event it is reporting.
- **Real constraint:** no runtime network except our own backend. No tiles, no CDN, no remote fonts, no hosted icons, no HDR environment maps. Everything ships in the bundle.
- **Stance:** technical-precise, dark. Reference ancestors are a hospital telemetry monitor and an air traffic strip board, not a SaaS marketing site.
- **Signature element:** the **hop**. A short bright dash of signal cyan traveling node to node across a black campus, with a log line appearing as it lands. It is in the landing hero, on `/admin`, on `/responder`, and in the 3D page's LoRa hotspot. If a judge remembers one picture, it is that dash crossing a dark map.

---

## 2. Research notes (what we took, what we left)

Sources read this morning: Vercel and Raycast token sheets (refero.design), the Studio Maydit essay on the Linear/Vercel/Raycast look, Palantir Blueprint and Foundry Workshop layout guidance, Mosaic (the light editorial reference), plus memory of Linear, Mercury, Resend, Cursor, Runway.

Concrete techniques adopted:

| Technique | Where it came from | How Sentinel uses it |
|---|---|---|
| Luminance ladder instead of color for hierarchy: canvas, surface, raised, each only a few points lighter | Raycast (`#040506` → `#07080a` → `#111214`), Linear | Three surfaces within 8 luminance points of each other (section 3.1) |
| Hairlines as white-alpha strokes, not gray hex, so they read the same on every surface | Vercel `0 0 0 1px rgba(0,0,0,.08)`, Raycast | `--line` `rgba(255,255,255,0.08)` on dark |
| Inset top highlight on pressed controls ("keyboard key") | Raycast | Primary and secondary buttons get a 1px inset top highlight at 6 percent white |
| Monospace eyebrows and metadata at 11 to 13px | Vercel (Geist Mono), Linear | Plex Mono only on real data; signage labels are Archivo wide, not mono |
| One accent on a near-greyscale base, accent under 5 percent of surface | all five | Signal cyan |
| Glow used once, behind the hero object, at very low alpha | Raycast `rgba(215,201,175,.05) 0 0 20px 5px` | One radial of signal at 6 percent behind the landing hero card; nowhere else |
| Restrained display size (56 to 64px at 400 to 600 weight), not 96px | Raycast 56/400, Vercel 64 | Hero is 80px at 1440 wide, condensed, weight 600; sections 40px |
| Dense tables with 32px rows, right-aligned tabular numbers, no zebra stripes, hairline row dividers | Blueprint, Linear issue list | Section 6.4 |
| F-pattern scan: primary object top-left, large; support right and below; under ten components per view | Palantir Workshop guidance | Every console page has one dominant pane (section 8) |
| Product card as hero, 4-stat strip, numbered how-it-works, safety footer | Mosaic | Landing structure, inverted to dark, with a live card instead of a static one |
| Film grain on the canvas to kill flat-black banding | Linear, Runway | SVG `feTurbulence` at 4 percent opacity, fixed, pointer-events none, dark pages only |

Mobbin-style command-center patterns we use: split pane (queue left, detail right) with a draggable hairline; status pills with a 6px dot plus label; incident timeline as a vertical hairline with mono timestamps; sticky table header; "since 3:10 PM" relative-plus-absolute time everywhere; a thin top banner for site-wide alert state.

Left behind on purpose: Linear lavender, Raycast coral, Vercel rainbow gradient, glassmorphism headers, 16 to 20px card radii, Inter, 4-up KPI band, colored left-border strips, donut charts.

---

## 3. Color

### 3.1 Dark command palette

Base is a **warm near-black** ("soot"). Warm because the product is about smoke and heat, and because a warm ground makes the cool signal accent read as light, not as paint. Hairlines are white-alpha so they stay neutral on the warm ground.

| Token | Hex | Use |
|---|---|---|
| `--color-canvas` | `#0A0908` | Page background |
| `--color-surface` | `#121110` | Panels, table bodies, cards |
| `--color-raised` | `#1A1816` | Hover rows, inputs, secondary buttons, popovers |
| `--color-overlay` | `#221F1C` | Menus, tooltips, toasts (the only surface allowed a shadow) |
| `--color-line` | `rgba(255,255,255,0.08)` | Default hairline |
| `--color-line-strong` | `rgba(255,255,255,0.14)` | Focused/active hairline, table header rule |
| `--color-line-faint` | `rgba(255,255,255,0.045)` | Grid lines on map, chart gridlines |
| `--color-ink` | `#F2EEE8` | Primary text (bone, not pure white) |
| `--color-ink-2` | `#A9A39A` | Secondary text, labels |
| `--color-ink-3` | `#6F6A62` | Tertiary, timestamps, placeholders |
| `--color-ink-4` | `#46423D` | Disabled, decorative rules on text |
| `--color-signal` | `#46D2E4` | Brand accent. Live dot, hop dash, primary button fill, links, focus ring |
| `--color-signal-ink` | `#06272D` | Text on a signal-filled button |
| `--color-signal-dim` | `rgba(70,210,228,0.12)` | Tinted fills behind live elements, selected row |
| `--color-signal-line` | `rgba(70,210,228,0.40)` | Hairline on a selected/live card |

Contrast check against canvas: ink 16.9:1, ink-2 7.5:1, ink-3 3.4:1 (only at 13px+ or for non-essential text), signal 10.6:1.

### 3.2 State colors (shared by dark and light)

These are semantic and may never be used for branding or decoration.

| Token | Hex | Meaning |
|---|---|---|
| `--color-alarm` | `#FF4A3D` | LOCAL_FIRE (priority 1), Unhealthy band, missing students, false-report flags, destructive actions |
| `--color-warn` | `#FFB224` | LOCAL_SMOKE_SUSPECT (priority 3), roll call submitted with missing, battery under 20 percent |
| `--color-ok` | `#5AD46E` | Good band, roll call complete, node online, incident resolved |
| `--color-info` | `#46D2E4` | Same value as signal. ACTIVITY_ADVISORY (priority 4) uses it so advisories read as "information", not danger |

Priority 2 (HAZARDOUS_SMOKE) uses the Hazardous band color below, not alarm. Fire is red; the sky is maroon. That distinction is the product thesis and the colors must carry it.

### 3.3 AQI band ramp (tuned for dark)

EPA hues, lifted so they hold on `#0A0908`. Each band has a solid, a 14 percent fill, and a 45 percent line. Hazardous and Very unhealthy are too dark as text; always render them as a filled pill with `--color-ink` text, never as colored text on canvas.

| Band | PM2.5 µg/m³ | `--color-band-*` | Fill (14%) | Text on fill |
|---|---|---|---|---|
| Good | 0 to 9.0 | `good` `#5AD46E` | `rgba(90,212,110,0.14)` | `#0A0908` on solid, `#5AD46E` on fill |
| Moderate | 9.1 to 35.4 | `moderate` `#F2D94E` | `rgba(242,217,78,0.14)` | `#0A0908` / `#F2D94E` |
| Unhealthy for sensitive groups | 35.5 to 55.4 | `usg` `#FF9A3C` | `rgba(255,154,60,0.14)` | `#0A0908` / `#FF9A3C` |
| Unhealthy | 55.5 to 125.4 | `unhealthy` `#FF4A3D` | `rgba(255,74,61,0.14)` | `#F2EEE8` / `#FF4A3D` |
| Very unhealthy | 125.5 to 225.4 | `veryunhealthy` `#B98BF0` | `rgba(185,139,240,0.14)` | `#0A0908` / `#B98BF0` |
| Hazardous | 225.5 and up | `hazardous` `#D94A62` | `rgba(217,74,98,0.16)` | `#F2EEE8` / `#F2EEE8` (never colored text) |

Band name shown to users: "Good", "Moderate", "Sensitive groups", "Unhealthy", "Very unhealthy", "Hazardous". The full EPA name goes in a tooltip.

### 3.4 Light field palette (`/m/*` only)

| Token | Hex | Use |
|---|---|---|
| `--color-f-canvas` | `#F7F6F3` | Page |
| `--color-f-surface` | `#FFFFFF` | Cards, sheet |
| `--color-f-line` | `rgba(10,9,8,0.12)` | Hairline |
| `--color-f-line-strong` | `rgba(10,9,8,0.28)` | Outlined buttons |
| `--color-f-ink` | `#0A0908` | Text, filled buttons |
| `--color-f-ink-2` | `#57534C` | Secondary |
| `--color-f-signal` | `#0E7C8C` | The one accent on light. Same hue family as signal, darkened to 5.2:1 on white. Primary action only |
| `--color-f-alarm` | `#D7261A` | Alerts on light |

Band colors on light use the same hues at full saturation as solid fills with `#0A0908` text (Unhealthy and Hazardous take `#FFFFFF` text). Do not use tinted 14 percent fills on light; they wash out in sun.

---

## 4. Typography

### 4.1 Faces

| Role | Family | Package | Import |
|---|---|---|---|
| Display and signage labels | Archivo Variable (wght 100 to 900, **wdth 62 to 125**) | `@fontsource-variable/archivo` 5.3.0 | `@import "@fontsource-variable/archivo/wdth.css";` (the default `index.css` has no width axis; you must import `wdth.css`) |
| Body and UI | IBM Plex Sans Variable (wght 100 to 700) | `@fontsource-variable/ibm-plex-sans` 5.3.0 | `@import "@fontsource-variable/ibm-plex-sans";` |
| Data | IBM Plex Mono (static) | `@fontsource/ibm-plex-mono` 5.3.0 | `@import "@fontsource/ibm-plex-mono/400.css"; @import "@fontsource/ibm-plex-mono/500.css"; @import "@fontsource/ibm-plex-mono/600.css";` |

All three verified on npm at 5.3.0 this morning. Fontsource fetches nothing at runtime; the woff2 files land in the Vite bundle. Import only the `latin` subset if bundle size matters: use `@fontsource-variable/archivo/wdth.css` as is (it ships per-subset `@font-face` with `unicode-range`, so browsers only download latin anyway).

Why Archivo: it is a grotesque built for headlines with a real width axis, so one family gives us a condensed 80px hero and a wide 11px signage label that look like they came from the same sign shop. Why Plex Sans and Mono together: they share numeral design, so a table that mixes body text and mono data keeps one rhythm. Why not Inter, Geist, Space Grotesk: they are the default and read as no decision.

### 4.2 Width axis recipes (Archivo only)

```css
.display-hero   { font-family: var(--font-display); font-stretch: 78%;  font-weight: 620; letter-spacing: -0.025em; line-height: 0.96; }
.display-h1     { font-family: var(--font-display); font-stretch: 90%;  font-weight: 560; letter-spacing: -0.02em;  line-height: 1.04; }
.display-h2     { font-family: var(--font-display); font-stretch: 100%; font-weight: 520; letter-spacing: -0.012em; line-height: 1.12; }
.label-signage  { font-family: var(--font-display); font-stretch: 112%; font-weight: 600; font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--color-ink-2); }
```

`font-stretch` works because the fontsource face declares `font-stretch: 62% 125%`. `font-variation-settings: "wdth" 78` is an acceptable alternative but do not mix the two on one element.

`label-signage` is the only uppercase text in the product. Use it for section eyebrows, table column headers, and the tag on a status pill. Not on buttons, not on body copy.

### 4.3 Scale

Base 15px for desktop UI (not 16; dense consoles need it). Ratio roughly 1.2 at the small end, widening at the top.

| Token | px | Line height | Use |
|---|---|---|---|
| `--text-2xs` | 11 | 16 | signage labels, mono metadata |
| `--text-xs` | 12 | 16 | table cells (mono), timestamps |
| `--text-sm` | 13 | 18 | dense table text, captions |
| `--text-base` | 15 | 22 | body, inputs, buttons |
| `--text-md` | 17 | 24 | lead paragraphs, card titles |
| `--text-lg` | 20 | 26 | h3, decision card subtitle |
| `--text-xl` | 28 | 32 | h2 |
| `--text-2xl` | 40 | 42 | h1, landing section titles |
| `--text-3xl` | 56 | 56 | decision card headline, big readings |
| `--text-4xl` | 80 | 76 | landing hero at 1280+ |
| `--text-5xl` | 112 | 104 | incident code on desktop detail page |

Hero is the only place `clamp()` is allowed: `font-size: clamp(44px, 6.2vw, 80px)`.

Numbers: every number in the UI gets `font-variant-numeric: tabular-nums`. Readings use Plex Mono; stat-strip numbers on the landing use Archivo at `font-stretch: 85%` with `tabular-nums`.

### 4.4 Body rules

- Paragraph measure: 60 to 68 characters on the landing, unlimited in tables.
- Body weight 400 on dark, 450 on light (Plex Sans Variable supports it; thin strokes vanish in sun).
- Links: ink with a 1px underline in `--color-line-strong`, underline turns signal on hover. Never signal-colored text as a link in body copy.
- `-webkit-font-smoothing: antialiased` on dark pages only.

### 4.5 Phone exception

`/m/*` pages use `--font-field: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` and `ui-monospace, "SF Mono", Menlo, Consolas, monospace` for the code. In production this page is served from a node's flash in under 60 KB and cannot carry font files. The demo mirrors that constraint so the page we show is the page that ships. Say so in the SIM tag on `/m`.

Phone base size is 18px. Nothing on a field page is smaller than 14px.

---

## 5. Space, shape, depth

### 5.1 Spacing

8px grid: 4, 8, 12, 16, 24, 32, 48, 64, 96. Tailwind v4 default `--spacing: 0.25rem` already matches; use `p-2 p-3 p-4 p-6 p-8 p-12 p-16 p-24`.

Padding signals importance. Decision card: 32px. Standard panel: 20px (`p-5`). Table cell: 8px vertical, 12px horizontal. Status pill: 2px 8px. Toolbar: 8px.

### 5.2 Radius

| Token | px | Use |
|---|---|---|
| `--radius-xs` | 2 | Table cell selection, tags inside tables, chart bars |
| `--radius-sm` | 4 | Inputs, buttons, pills that carry a code (square-ish, like a label printer) |
| `--radius-md` | 8 | Panels, cards, popovers |
| `--radius-lg` | 14 | Landing hero card, phone bottom sheet, the decision card |
| `--radius-full` | 9999 | Status pills with a dot, the live indicator, node dots |

Never 16 or more on anything with text in it except the three `lg` cases above.

### 5.3 Hairline, not shadow

```css
.hairline        { border: 1px solid var(--color-line); }
.hairline-strong { border: 1px solid var(--color-line-strong); }
.hairline-inset  { box-shadow: inset 0 0 0 1px var(--color-line); }  /* when border would shift layout */
```

Shadow is allowed on exactly four things: menus, tooltips, toasts, the phone bottom sheet.

```css
--shadow-overlay: 0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
--shadow-sheet:   0 -8px 32px rgba(10,9,8,0.18);   /* light phone sheet */
```

A card never has both a hairline and a drop shadow.

### 5.4 Grain

Dark pages get one fixed grain layer to stop flat-black banding on cheap projectors:

```html
<div aria-hidden class="grain"></div>
```
```css
.grain {
  position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
}
```

Not on `/m/*`. Not inside the 3D canvas (it has its own stage treatment).

### 5.5 Glow

One glow in the entire product: a radial behind the landing hero card, `radial-gradient(60% 50% at 50% 40%, rgba(70,210,228,0.06), transparent 70%)`. Node alarm rings use opacity pulses, not blur. No `filter: blur` anywhere except the hero radial.

---

## 6. Component language

All components live in `src/components/ui/` and are the only way to render these things. Agents do not restyle locally.

### 6.1 Buttons

Height 36px desktop, 64px phone. Radius `sm`. Font Plex Sans 500, 15px (phone: system 600, 20px). Horizontal padding 14px. Icon 16px, gap 8px, icon leads.

| Variant | Fill | Text | Border | Hover | Active |
|---|---|---|---|---|---|
| `primary` | `--color-signal` | `--color-signal-ink` | none, plus `inset 0 1px 0 rgba(255,255,255,0.25)` | fill `#5FDBEB` | fill `#3BC2D4`, translateY(0.5px) |
| `secondary` | `--color-raised` | `--color-ink` | `--color-line-strong`, plus `inset 0 1px 0 rgba(255,255,255,0.06)` | fill `--color-overlay` | fill `--color-raised`, border `--color-line` |
| `ghost` | transparent | `--color-ink-2` | none | text `--color-ink`, fill `rgba(255,255,255,0.04)` | fill 0.06 |
| `danger` | transparent | `--color-alarm` | `rgba(255,74,61,0.4)` | fill `rgba(255,74,61,0.10)` | fill 0.16 |
| `resolve` (responder only) | `--color-ok` | `#0A0908` | none | `#6FE082` | `#4CC860` |

One primary per view. "Resolve" is the only green button in the product and appears only on `/responder/incident/:code` and `/m/responder`. Destructive confirmations are `danger` and always need a note field (resolution note, false-flag reason).

Focus: `outline: 2px solid var(--color-signal); outline-offset: 2px;` on every interactive element, keyboard only (`:focus-visible`).

Transitions: `transition: background-color 120ms var(--ease-exit), border-color 120ms, transform 80ms;`. Never `transition: all`.

### 6.2 Status pills

Pill = 6px dot + label, 22px tall, radius `full`, padding 2px 8px 2px 6px, font Plex Sans 500 12px. Background is the 14 percent tint, text is the solid, dot is the solid.

```
 (●) Verified     (●) Likely     (○) Unverified
 (●) Good  (●) Moderate  (●) Sensitive groups  [● Unhealthy]  [● Very unhealthy]  [● Hazardous]
 (●) Online   (○) Offline   (●) Alerting
 (●) Received → (●) Acknowledged → (●) En route → (●) Resolved
```

- Trust: Verified = ok, Likely = warn, Unverified = ink-3 with hollow dot.
- Band pills Unhealthy and up render as solid fill (not tint) with the text color from 3.3.
- Incident status: Received = ink-2 hollow dot, Acknowledged = signal, En route = warn, Resolved = ok.
- Node: Online = ok dot on no fill (just dot + text), Offline = hollow ink-4 dot, Alerting = alarm dot pulsing (section 7).
- A pill that carries a code (`SN-7K3F`, `node-04`) uses radius `sm` and Plex Mono 12px instead.

### 6.3 Cards and panels

A panel is `bg-surface hairline rounded-md`. Header row inside: 40px tall, `label-signage` title on the left, optional mono metadata on the right, hairline below. Body `p-5`. No card-inside-card. If you need grouping inside a panel, use a hairline divider, not another box.

Selected or live panel: border `--color-signal-line`, background stays `--color-surface`. No tint wash across the whole card.

### 6.4 Data tables

- Row height 32px. Header row 28px, `label-signage`, sticky, hairline-strong below.
- Cell text: Plex Sans 13px for names and text; Plex Mono 12px for numbers, codes, times. Numbers right-aligned with `tabular-nums`.
- Dividers: hairline between rows. No zebra. Hover: `--color-raised`. Selected: `--color-signal-dim` with a 2px signal bar on the **left edge of the row** (this is a selection indicator on a row, not a colored card strip; it is the one place a left bar is allowed).
- Sort indicator: 12px chevron in ink-3, not an arrow pair.
- Empty state inside a table: a single row, 96px tall, ink-3 text, one sentence, one ghost button. "No open incidents. New reports appear here the moment they arrive."
- Loading: three rows of 12px-tall `--color-raised` bars at 60, 40, 70 percent width, opacity 0.6, no shimmer animation.
- Time columns show relative first, absolute on hover via `title`: "4 min ago" and `title="15:12:08 PDT"`.

### 6.5 Map (campus) and node dots

The map is a static inline SVG of the UW campus block grid: `--color-line-faint` building footprints as 1px outlines on canvas, no fills, no labels except the eight node labels. It is **not** a tile map and must not look like one. Aspect 16:10, `viewBox="0 0 1600 1000"`.

Node dot is a 12px circle. States:

| State | Render |
|---|---|
| Online, any band | Filled with the band solid, 1px ring `rgba(255,255,255,0.2)` |
| Offline | 12px hollow ring, 1.5px stroke `--color-ink-4`, no fill, label dimmed |
| Alerting (priority 3 or 4) | Band fill, plus one 24px ring in the band color at 40 percent opacity pulsing 1.6s |
| LOCAL_FIRE (priority 1) | `--color-alarm` fill, two rings (24px and 36px) pulsing out of phase, label turns alarm |
| Gateway / hub node | 12px **square** (radius 2px), same fill rules. Squares are the uplink; circles are the mesh. Legend says so |
| Selected | Additional 1px signal ring at 20px |

Label: Plex Mono 11px ink-2, 8px to the right of the dot, reading `gym`, `field`, `lib`, `hub`. PM2.5 value appears under the label as mono 11px in the band color when the map is in "air" mode.

Neighbor links: hairline (`--color-line`) between nodes within radio range, dashed `2 4`. These are the rails the hop travels on.

### 6.6 Hop animation (the signature)

A "hop" is a message moving one link. Render as a 24px dash of `--color-signal`, 2px wide, round caps, moving along the link path with `stroke-dasharray` / `stroke-dashoffset` or with a motion `<circle>` plus a 24px trail at 50 percent opacity.

- Duration per hop: **220ms**, easing `--ease-hop` `cubic-bezier(0.3, 0, 0.2, 1)`. A 3-hop path takes 660ms plus 60ms pauses at each node.
- Landing: the receiving node's ring flashes `--color-signal` at 60 percent opacity for 160ms.
- Dropped packet (the simulator's 15 percent drop): dash travels to 60 percent of the link, then dissolves over 160ms (opacity to 0, scaleX to 0.3). A 3px `×` tick in ink-3 appears at the drop point for 800ms.
- Retry: same path, 1.2s later in demo time, identical animation. Retries are not colored differently; the log tells the story.
- Priority 1 messages (fire, incident) use the signal dash. Telemetry hops use the dash at 35 percent opacity. That way the map is calm until something matters.
- Hop log panel (mono 12px) appends one line per hop, newest at the bottom, auto-scroll, 200-line cap:

```
15:12:08.412  inc SN-7K3F  gym → lib          hop 1/8   ok
15:12:08.641  inc SN-7K3F  lib → quad         hop 2/8   DROP
15:12:09.850  inc SN-7K3F  lib → quad         hop 2/8   retry ok
15:12:10.074  inc SN-7K3F  quad → hub ■       hop 3/8   delivered
```

Reduced motion: no traveling dash; the receiving node flashes and the log line appears. The log is the accessible version of the animation.

### 6.7 Decision card

The single most important object on `/admin`. Radius `lg`, `p-8`, spans the full width of the primary column.

```
┌─────────────────────────────────────────────────────────────────────┐
│ OUTDOOR ACTIVITY · FIELD NODE                    since 3:10 PM  ○ LIVE │  label-signage + mono
│                                                                     │
│ Cancel outdoor practice                              71             │  display-h1 40px  |  Plex Mono 56px, band color
│ PE indoors. Recess indoors.                       PM2.5 µg/m³ 10-min │  text-lg ink-2   |  2xs mono ink-3
│                                                   [● Unhealthy]     │  band pill (solid)
│ ─────────────────────────────────────────────────────────────────── │  hairline
│ Rule: band worsened Moderate → Unhealthy at 15:10:04 (ACTIVITY_ADVISORY)   mono 12px ink-3
└─────────────────────────────────────────────────────────────────────┘
```

- Headline text is one of exactly six strings mapped to bands: "Outdoor practice: OK" / "Outdoor practice: OK, watch sensitive students" / "Sensitive groups indoors" / "Cancel outdoor practice" / "All outdoor activity cancelled" / "Shelter indoors". Do not paraphrase.
- The reading number is the only large colored text on the page. Background stays `--color-surface`. No tinted wash, no colored border, no left strip.
- When the band changes, the number counts to the new value over 600ms (`--ease-enter`), the pill cross-fades 200ms, the headline swaps with a 12px upward slide 240ms. Reduced motion: instant swap.
- Hazardous adds a second line under the rule: "SMS sent to 214 registered phones in zone Field" in `--color-ink-2` with a link to the outbox.

### 6.8 Trust score meter

Horizontal track 100 percent wide, 6px tall, radius `xs`, background `--color-line`. Fill is `--color-ink` (bone), **not** a traffic-light color; the pill next to it carries the verdict color. Tick marks at 30 and 60 as 1px `--color-ink-4` lines 10px tall, labeled under the track in 2xs mono: `30 likely` and `60 verified`. Score value in mono 17px to the right.

Breakdown list under the meter, mono 12px, two columns:

```
Proximity proof      node gym, on-node WiFi        +40
Sensor corroboration PM2.5 rise 48, temp +4.1 °C   +30
Crowd corroboration  1 other device, 6 min         +20
GPS consistency      no GPS shared                  0
Device history       no prior flags                 0
                                           score   90  ● Verified
```

Negatives render in `--color-alarm`. Zero renders in ink-3. Cap notes ("internet-only, capped at Likely") appear as a final ink-3 row.

Fill animates width over 600ms `--ease-enter` on first render only.

### 6.9 Incident code display ("written on a hand")

The code `SN-7K3F` exists to be copied onto skin with a pen. Render it so a person could do that from three feet away.

Phone (`/m/report` success, `/m/status`):

```
┌──────────────────────────────────────┐
│  Your code                            │  18px ink-2
│                                       │
│   ┌───┐┌───┐   ┌───┐┌───┐┌───┐┌───┐   │
│   │ S ││ N │ - │ 7 ││ K ││ 3 ││ F │   │  each cell 56×72, ink hairline-strong,
│   └───┘└───┘   └───┘└───┘└───┘└───┘   │  ui-monospace 48px 700, ink on white
│                                       │
│  Write it on your hand. Check status  │  16px ink-2
│  any time at this page.               │
│  [ Copy code ]   [ Check status ]     │  secondary (outline) buttons, 64px
└──────────────────────────────────────┘
```

- `SN` cells at 50 percent opacity so the eye lands on the four that matter. The hyphen is plain text, not a cell.
- The alphabet has no 0/O/1/I, so say so under the code in 14px ink-2: "No zero, no letter O." This stops the most common transcription error.
- Desktop `/responder/incident/:code`: same cells at 64×88 in Plex Mono 56px 600 on `--color-surface`, hairline cells, `SN` dimmed. Code is also the page `<h1>` as plain text for screen readers and copying.
- Anywhere else (tables, pills, log lines) the code is plain Plex Mono, never cells.

### 6.10 Incident timeline

Vertical hairline at x=11px; each event a 6px dot on the line (color by status, section 6.2), mono 12px timestamp left of the text in ink-3, event text in Plex Sans 13px ink, actor in ink-2. Newest at bottom on the detail page, newest at top in the responder queue preview. Messages to the reporter render as indented blocks with a `--color-raised` background, radius `sm`.

```
15:12:10  Received           via node gym · device a3f1
15:12:41  Acknowledged       J. Ortiz (King County)
15:13:02  ┆ "Stay where you are. Crew is 4 minutes out."
15:17:55  En route           J. Ortiz
15:26:14  Resolved           J. Ortiz · "Two occupants walked out, no injuries."
```

### 6.11 Roll call grid (`/admin/drill`)

Each class is a 4-radius tile, 120×88, `--color-surface`, hairline. Class name in Plex Sans 15px 500, counts in mono 13px. State shown by the hairline and a 6px dot, **not** by flooding the tile with color:

- Not submitted: hairline `--color-line`, dot hollow ink-4, mono elapsed timer `01:42` ticking in ink-3.
- Submitted, count matches: hairline `rgba(90,212,110,0.5)`, ok dot, `28 / 28`.
- Submitted with missing: hairline `rgba(255,178,36,0.6)`, warn dot, `26 / 28`, plus `2 missing` in warn.

Tiles arrive with a 240ms fade + 6px slide when a submission lands, staggered 40ms if several arrive together.

### 6.12 Banners and toasts

- Site alert banner: 36px strip at the top of the console, full width, below the nav. Background is the band or priority 14 percent fill, text is the solid, mono timestamp on the right. One banner at a time, highest priority wins. LOCAL_FIRE banner uses solid `--color-alarm` with `--color-ink` text and does not dismiss.
- Toast: `--color-overlay`, `--shadow-overlay`, radius `md`, 320px wide, bottom-right, 4s, slides up 8px over 200ms. Used for "Incident SN-7K3F resolved", "Drill started", "Copied".
- Responder new-incident ping: toast plus a 2-note tone (two short sine beeps at 880 and 1175 Hz, 90ms each, generated with WebAudio; no audio file). Sound only on `/responder*` and only after a user gesture has unlocked audio.

### 6.13 SIM tag

One per view. Dashed hairline pill, radius `sm`, Plex Mono 11px ink-3, 6px horizontal padding:

```
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐
  SIM  8 virtual nodes · schematic in submission
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘
```

Exact strings:
- Map / node panels: `SIM  8 virtual nodes · schematic in submission`
- SMS outbox: `SIM  SMS provider disabled in demo`
- Phone `/m`: `SIM  in production this page is served by the node itself`
- Mesh hop log: `SIM  mesh over local UDP, 15% drop · dedup and retry are real`

Place it in the panel header's right slot. Never as a full-width banner, never repeated on child widgets.

### 6.14 SMS outbox

A table (6.4) with columns `time`, `zone`, `recipients`, `message`. Message cell wraps, Plex Sans 13px. Status column always reads `queued (demo)` in ink-3 mono. SIM tag in the header.

### 6.15 Inputs

Height 36px (phone 64px), `--color-raised`, hairline, radius `sm`, Plex Sans 15px, placeholder ink-3. Focus: border `--color-signal-line` plus focus ring. Error: border `rgba(255,74,61,0.6)`, message 13px alarm under the field, one sentence telling the fix: "Codes are 4 characters after SN. No zero, no letter O."

### 6.16 Live indicator

A 6px `--color-signal` dot with the word `LIVE` in `label-signage`. The dot pulses opacity 1 → 0.45 → 1 over 2s, linear, forever. If the WebSocket drops, the dot turns `--color-ink-4`, stops pulsing, and the label reads `RECONNECTING`. This is the only perpetual animation on a console page.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--dur-fast` | 120ms | hover fills, pill swaps |
| `--dur-base` | 200ms | toasts, cross-fades, row selection |
| `--dur-slow` | 320ms | panel enter, sheet slide |
| `--dur-count` | 600ms | number count-up, meter fill |
| `--ease-enter` | `cubic-bezier(0.2, 0, 0, 1)` | things arriving |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | things leaving, hover out |
| `--ease-hop` | `cubic-bezier(0.3, 0, 0.2, 1)` | the hop dash |

What animates:
- State changes: pill color, band number, decision headline, node ring.
- Arrivals: new incident row slides down 6px into the queue (200ms); new roll-call tile (240ms); toast (200ms).
- Attention: alarm ring pulse 1.2s on LOCAL_FIRE, band ring pulse 1.6s, LIVE dot 2s.
- The hop (section 6.6).
- Landing: on first load the hero headline's three lines rise 16px and fade in, 60ms stagger, 480ms `--ease-enter`. The hero card starts its simulated loop 600ms after mount. That is the only page-load choreography in the product.
- 3D page: scroll-driven explode (section 8.8), hotspot label fade 200ms on hover.

What never animates: layout width, font size, shadows, colors on body text, backgrounds of whole pages. No parallax. No scroll-triggered reveals anywhere except the hero. No skeleton shimmer.

Use `motion` (framer-motion) for React-driven enters and the count-up; use CSS keyframes for the perpetual pulses; use SVG `<animateMotion>` or `motion.circle` for hops. Wrap the app in `<MotionConfig reducedMotion="user">` so framer respects the OS setting automatically, and add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
  .hop-dash { display: none; }
}
```

Alarm states must still be perceivable without motion: the LOCAL_FIRE node is red with double static rings, the banner is solid red, the label says FIRE.

---

## 8. Pages

Console shell (all dark desktop pages): 56px top bar, no sidebar. Left: wordmark `Sentinel` in Archivo `font-stretch: 90%` 600 at 17px, then the site name in ink-2. Center: route tabs as ghost buttons, active tab gets a 2px signal underline (not a pill). Right: LIVE indicator, clock in mono (`15:12 PDT`), user chip. Below the bar: the alert banner slot (section 6.12), then content with 24px gutters, max width 1600px. No sidebar because every page here is a single focused view and the spec has at most five routes per role.

### 8.1 Landing `/`

Dark. Structure follows Mosaic's skeleton (hero with product card, stat strip, numbered steps, safety footer) but every section is weighted, not mirrored.

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Sentinel                          How it works   Hardware   Business      [Open console] │ 56px bar, hairline below
├────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                    │
│  SENTINEL NODE · SEATTLE · 2026                         (label-signage, ink-3)      │
│                                                                                    │
│  The smoke alarm that                                                              │  display-hero 80px, condensed,
│  keeps talking when                                                                │  3 lines, ink, max-width 11ch
│  the internet dies.                                                                │
│                                                                                    │
│  A $31 box that measures smoke, heat and gas, relays over                          │  text-md ink-2, 60ch
│  long-range radio, and lets any phone nearby report danger                         │
│  with a verified location. Schools use it every month for                          │
│  drills. That is why it works on the worst day.                                    │
│                                                                                    │
│  [Open the console]  [See the hardware]                                            │  primary + secondary
│                                                                                    │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │  HERO CARD radius-lg, hairline,
│  │ UW CAMPUS · 8 NODES                 15:12:08 PDT   ○ LIVE   ┆SIM 8 virtual…┆ │  │  one radial glow behind it
│  │ ┌────────────────────────────────────────┐ ┌───────────────────────────────┐ │  │
│  │ │    ○lib            ■hub                │ │ Cancel outdoor practice   71  │ │  │  left 62%: campus SVG map
│  │ │         ○quad   ·  ·  ·  ●gym          │ │ PM2.5 µg/m³     [● Unhealthy] │ │  │  right 38%: mini decision card
│  │ │  ○field      ○ath       ○eng   ○dorm   │ ├───────────────────────────────┤ │  │  + 4-line incident feed
│  │ │                 ─ ─ ─ hop dash ─ ─ ─ → │ │ 15:12:10  SN-7K3F  Trapped ·2 │ │  │
│  │ │                                        │ │           gym → hub  ● Verified│ │  │
│  │ └────────────────────────────────────────┘ │ 15:11:02  LOCAL_FIRE  gym      │ │  │
│  │                                            │ 15:10:04  band → Unhealthy     │ │  │
│  │                                            └───────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                    │
├────────────────────────────────────────────────────────────────────────────────────┤  hairline
│  $31              8                 0                 3 days                       │  STAT STRIP: Archivo 56px wdth 85
│  per node at      hops, 1 to 2 km   internet          on one 18650, no sun         │  labels text-sm ink-2
│  1,000 units      each              required                                       │  4 columns, hairlines between,
├────────────────────────────────────────────────────────────────────────────────────┤  numbers NOT equal width
│                                                                                    │
│  How a report gets out                                                             │  text-2xl
│                                                                                    │
│  1  A phone joins the box's own WiFi.      ┌──────────────────────────────┐        │  numbered because it IS a
│     No internet, no app. The sign-in       │  small SVG / still of that   │        │  sequence; numbers in Archivo
│     screen pops up like hotel WiFi.        │  step (phone join, hop, map) │        │  wdth 78 at 40px, ink-4
│                                            └──────────────────────────────┘        │
│  2  The report hops box to box over 915 MHz radio.                                 │  steps stack, alternating text/
│  3  A gateway or the school's own edge server catches it.                          │  visual sides by weight not
│  4  A responder sees it on a map, scored for trust, and is the only one who can    │  strict mirror
│     close it.                                                                      │
│                                                                                    │
├────────────────────────────────────────────────────────────────────────────────────┤
│  One node spiking while its neighbours are flat is a fire in that aisle.           │  pull statement, display-h1,
│  Every node climbing together is the sky.                                          │  two lines, second in ink-2
│  [small inline chart: 8 PM2.5 lines, one spikes]                                   │
├────────────────────────────────────────────────────────────────────────────────────┤
│  Who pays and why            Schools · Warehouses · Agencies   (three short        │  asymmetric: schools column 2x
│                                                                 columns, hairline   │  wider (distribution story)
│                                                                 rules, no cards)    │
├────────────────────────────────────────────────────────────────────────────────────┤
│  Need help right now? Call 911. Sentinel does not replace 911 or code-required     │  SAFETY FOOTER, text-base ink,
│  smoke detection.                                                                  │  on --color-surface
│  Hardware designed, not fabricated, per organizer guidance. Sensors, mesh radio    │  text-sm ink-3
│  and SMS are simulated in this demo. All logic is real.                            │
│  Frontier Cascadia · Sept 12 2026 · Repo · Devpost                                 │
└────────────────────────────────────────────────────────────────────────────────────┘
```

Hero card behavior: runs a 24-second scripted loop from the same data shape the simulator uses (calm → smoke → gym fire → incident hop → resolved), no backend needed so the landing works even if the API is down. Reduced motion: static frame at the "fire" moment with the log visible.

Under 900px: hero card moves below the copy at full width; stat strip becomes 2×2; steps stack single column.

### 8.2 `/admin`

```
┌─ bar ───────────────────────────────────────────────────────────────────────────────┐
│ Sentinel  Lincoln High        Overview  Drill  Air  Alerts  Nodes        ○ LIVE 15:12 │
├─ banner slot ───────────────────────────────────────────────────────────────────────┤
│ [● Unhealthy] Outdoor activity cancelled at 15:10                       since 2 min   │
├────────────────────────────────────────────────────────────────┬────────────────────┤
│  DECISION CARD (6.7) full width of this column                 │ NODES      ┆SIM┆    │
│                                                                │ ● gym    71  fire  │  node list, 8 rows,
│                                                                │ ● field  68        │  mono readings,
├────────────────────────────────────────────────────────────────┤ ● quad   64        │  battery bar 24×3px
│ CAMPUS                                      air │ mesh   ┆SIM┆│ ● lib    61        │
│                                                                │ ○ dorm   --  offline│
│   [campus SVG map with dots, links, hop dashes]                │ ...                │
│                                                                ├────────────────────┤
│                                                                │ OPEN INCIDENTS  3   │  read-only, no actions
│                                                                │ SN-7K3F Trapped ·2  │
│                                                                │   gym · ● Verified  │
│                                                                │   Acknowledged 2m   │
│                                                                ├────────────────────┤
│                                                                │ MESH LOG            │
│                                                                │ 15:12:08 gym→lib ok │  mono 12px, 8 lines
├────────────────────────────────────────────────────────────────┴────────────────────┤
```

Left column 68 percent, right 32 percent. Right column is one continuous panel with hairline dividers, not three cards. The map toggle `air | mesh` is a segmented control (two ghost buttons in a hairline box, active gets `--color-raised`).

### 8.3 `/admin/drill`

```
┌─ bar ─────────────────────────────────────────────────────────────────────────────┐
├───────────────────────────────────────────────────────────────────────────────────┤
│  FIRE DRILL · STARTED 10:02:14                 04:18 elapsed      [End drill]      │  label-signage, mono 40px timer,
│  14 of 22 classes in · 3 missing                                                  │  text-xl ink; End = danger
├───────────────────────────────────────────────────────────┬───────────────────────┤
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐          │ MISSING          3    │
│  │ 3B   ││ 3C   ││ 4A   ││ 4B   ││ 5A   ││ 5B   │          │ A. Nguyen    3B  gym │  mono timestamps,
│  │26/28 ││30/30 ││ --   ││28/28 ││ --   ││22/24 │          │ R. Okafor    3B  gym │  warn dot, class,
│  │2 miss││  ok  ││01:42 ││  ok  ││02:10 ││2 miss│          │ D. Patel     5B  fld │  muster node
│  └──────┘└──────┘└──────┘└──────┘└──────┘└──────┘          ├───────────────────────┤
│  ... (22 tiles, wrap, 12px gap)                             │ BY MUSTER POINT       │
│                                                            │ gym    9 classes      │
│                                                            │ field  5 classes      │
│                                                            ├───────────────────────┤
│                                                            │ [Export report (PDF)] │  secondary; no print styles
│                                                            │                       │  needed today, button opens
│                                                            │                       │  window.print()
└───────────────────────────────────────────────────────────┴───────────────────────┘
```

Before a drill starts: the tile grid area shows one empty state, "No drill running. Start one and every teacher's phone switches to roll call." with a single primary `[Start fire drill]` and a `ghost` dropdown for kind (fire / lockdown / earthquake).

### 8.4 `/admin/air`

```
┌─ bar ─────────────────────────────────────────────────────────────────────────────┐
├───────────────────────────────────────────────────────────────────────────────────┤
│  AIR · TODAY                                   [10 min ▾]  [All nodes ▾]   ┆SIM┆   │
├───────────────────────────────────────────────────────────────────────────────────┤
│  PM2.5 µg/m³                                                                      │  chart panel: 8 lines, ink-2 at
│  225 ┤ · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·        │  70% except selected node in
│  125 ┤                                                              gym ╭─╮        │  ink; band thresholds as
│   55 ┤                                                      ╭───────╯  ╰─         │  horizontal dashed line-faint
│   35 ┤                                          ╭───────────╯ others             │  rules labelled on the left in
│    9 ┤─────────────────────────────────────────╯                                   │  mono 11px band color; x axis
│    0 ┴──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬────         │  mono times. No area fills,
│      07:00  08:00  09:00  10:00  11:00  12:00  13:00  14:00  15:00              │  no gradients, no tooltip
│                                                                                   │  cards: crosshair + mono readout
├──────────────────────────────────────┬────────────────────────────────────────────┤
│  BAND HISTORY                        │ DECISION LOG                               │
│  ████████████░░░░▒▒▒▒▓▓▓             │ 15:10  Cancel outdoor practice   71  field │  mono table, newest first
│  good  moderate  usg  unhealthy      │ 14:20  Sensitive groups indoors  41  field │
│  (one 12px bar per node, 8 rows,     │ 12:05  Outdoor practice: OK      18  field │
│   segments by band, hairline gaps)   │                                            │
└──────────────────────────────────────┴────────────────────────────────────────────┘
```

Chart is hand-rolled SVG (no chart library needed; 8 polylines on a 10-minute grid). Lines are 1.5px. The selected node line is 2px ink; hover a node in the legend to select.

### 8.5 `/responder`

Split pane. Queue left 40 percent, map right 60 percent, draggable hairline between (min 360px left).

```
┌─ bar ─────────────────────────────────────────────────────────────────────────────┐
│ Sentinel  King County · Zone 4       Queue  Audit           🔈on   ○ LIVE  15:12    │  (speaker toggle is a Lucide
├─────────────────────────────────────┬─────────────────────────────────────────────┤   icon, not emoji)
│ INCIDENTS 3 open     sort: priority │                                             │
│ ┌─────────────────────────────────┐ │        ○lib          ■hub                   │
│ │ ▌SN-7K3F  Trapped · 2 people    │ │                                             │  selected row: signal-dim bg +
│ │  gym · Lincoln High  ● Verified │ │           ○quad   · · ·  ◉gym  ← SN-7K3F    │  2px left bar; map pans/pulses
│ │  15:12:10 · Acknowledged · you  │ │                                             │  the matching node
│ ├─────────────────────────────────┤ │   ○field      ○ath      ○eng    ○dorm       │
│ │  SN-2M8Q  Need medical · 1      │ │                                             │  unselected rows plain
│ │  quad     ● Likely              │ │                                             │
│ │  15:09:44 · Received            │ │   [legend: ● mesh node  ■ gateway  ◉ alert] │
│ ├─────────────────────────────────┤ │                                             │
│ │  SN-9PQ2  Fire · ?              │ │                                             │
│ │  internet only  ○ Unverified    │ │                                             │
│ │  15:08:01 · Received            │ │                                             │
│ └─────────────────────────────────┘ ├─────────────────────────────────────────────┤
│                                     │ SENSORS AT GYM     PM2.5 71 ↑48  temp 31.2 ↑4.1 │  mono strip under map
│                                     │ MQ-2 612 ↑        LOCAL_FIRE since 15:11:02   │
└─────────────────────────────────────┴─────────────────────────────────────────────┘
```

Rows are 72px, three lines. Priority is conveyed by order and by the type word, not by coloring the row. Priority 1 rows get a 6px alarm dot before the code. Clicking a row selects it (does not navigate); pressing Enter or the chevron opens `/responder/incident/:code`. New incident: row slides in at its sorted position, toast, tone.

### 8.6 `/responder/incident/:code`

```
┌─ bar ─────────────────────────────────────────────────────────────────────────────┐
│ ← Queue                                                                          │
├────────────────────────────────────────────────┬──────────────────────────────────┤
│  ┌───┐┌───┐  ┌───┐┌───┐┌───┐┌───┐              │  [Acknowledge]  [En route]        │  actions rail, secondary;
│  │ S ││ N │ -│ 7 ││ K ││ 3 ││ F │              │  [Resolve]                        │  Resolve = green, disabled until
│  └───┘└───┘  └───┘└───┘└───┘└───┘              │   note: [______________________]  │  note has text
│  Trapped · 2 people       ● Verified  90        │  [Flag false]  [Merge]  [Draft WEA]│  danger / ghost / ghost
│  "Second floor, smoke in the hall"  (13px ink)  ├──────────────────────────────────┤
│  via node gym · Lincoln High · 15:12:10         │  TRUST                           │
│                                                 │  ▐██████████████████░░  90       │  meter (6.8)
├────────────────────────────────────────────────┤  Proximity proof     +40          │
│  TIMELINE (6.10)                                │  Sensor corroboration +30         │
│  15:12:10 Received via node gym                 │  Crowd corroboration  +20         │
│  15:12:41 Acknowledged  J. Ortiz                │  ...                              │
│  ...                                            ├──────────────────────────────────┤
│  [Message reporter ______________] [Send]       │  WHERE                           │
│                                                 │  small map crop, gym dot,         │
│                                                 │  GPS dot if shared, 100 m ring    │
│                                                 ├──────────────────────────────────┤
│                                                 │  NODE GYM NOW                    │
│                                                 │  PM2.5 71  temp 31.2  MQ-2 612   │
└────────────────────────────────────────────────┴──────────────────────────────────┘
```

Left 58 percent, right 42 percent. Resolve opens no modal; the note field is inline and the button enables when the note is non-empty. After resolve: timeline appends, code pill turns ok, actions rail collapses to "Resolved by you at 15:26. This cannot be undone." in ink-2.

### 8.7 Phone `/m/*` (light)

Viewport 390 wide assumed. 20px side gutter. Base 18px. Buttons 64px. Band banner 44px at top, always present. SIM tag once, bottom of `/m`.

```
/m (role picker)                      /m/report                           /m/report → success
┌──────────────────────────┐          ┌──────────────────────────┐         ┌──────────────────────────┐
│ ● Unhealthy · PM2.5 71   │ banner   │ ● Unhealthy · PM2.5 71   │         │ ● Unhealthy · PM2.5 71   │
│ node gym · 15:12         │ (solid   │ ← back                   │         │                          │
├──────────────────────────┤  band    │                          │         │ Report received          │ 28px 700
│                          │  fill)   │ What is happening?       │ 24px    │                          │
│ Sentinel                 │ 28px 700 │ ┌──────────┐┌──────────┐ │         │ Your code                │
│ Lincoln High · gym       │ 16 ink-2 │ │ Safe     ││Need water│ │ 2×3     │ ┌─┐┌─┐  ┌─┐┌─┐┌─┐┌─┐     │
│                          │          │ ├──────────┤├──────────┤ │ tiles   │ │S││N│- │7││K││3││F│     │ cells (6.9)
│ ┌──────────────────────┐ │          │ │Need      ││ Trapped  │ │ 96px    │ └─┘└─┘  └─┘└─┘└─┘└─┘     │
│ │ I need help          │ │ 72px     │ │medical   ││          │ │ tall    │ No zero, no letter O.    │
│ └──────────────────────┘ │ ink fill │ ├──────────┤├──────────┤ │ outline │                          │
│ ┌──────────────────────┐ │ white txt│ │ Fire     ││ Other    │ │ ink;    │ Write it on your hand.   │
│ │ I'm staff            │ │ outline  │ └──────────┘└──────────┘ │ selected│ Responders have it.      │
│ └──────────────────────┘ │          │                          │ = ink   │                          │
│ ┌──────────────────────┐ │          │ How many people?  [ 2 ]  │ stepper │ [ Copy code ]            │
│ │ I'm a responder      │ │ outline  │ Anything else?  [______] │ 64px    │ [ Check status ]         │
│ └──────────────────────┘ │          │ [ ] Share my location    │ 28px box│                          │
│                          │          │                          │         │ Status: Received         │
│ Have a code? [SN-____]   │          │ ┌──────────────────────┐ │         │                          │
│                          │          │ │ Send report          │ │ 64px    │ ┆SIM in production this  │
│ ┆SIM in production this  │          │ └──────────────────────┘ │ f-signal│  page is served by the   │
│  page is served by the   │          │                          │ fill    │  node itself┆            │
│  node itself┆            │          │                          │         │                          │
└──────────────────────────┘          └──────────────────────────┘         └──────────────────────────┘

/m/status?code=                       /m/staff (roll call)                 /m/responder (field list)
┌──────────────────────────┐          ┌──────────────────────────┐         ┌──────────────────────────┐
│ ● Unhealthy · PM2.5 71   │          │ ● Unhealthy · PM2.5 71   │         │ ● Unhealthy · PM2.5 71   │
│                          │          │ FIRE DRILL · 04:18       │ mono    │ 3 open · Zone 4          │
│ SN-7K3F                  │ mono 40  │                          │         │                          │
│                          │          │ Class 3B                 │ 28 700  │ ┌──────────────────────┐ │
│ ○ Received     15:12     │ vertical │ Present                  │         │ │ SN-7K3F Trapped · 2  │ │ 3-line row,
│ ● Acknowledged 15:12     │ timeline │ [ - ]   28   [ + ]       │ 64px    │ │ gym · Verified       │ │ 88px,
│ ● En route     15:17     │ current  │                          │ stepper │ │ [Acknowledge][Resolve]│ │ two 56px
│ ○ Resolved               │ = f-sig  │ Missing (tap names)      │         │ └──────────────────────┘ │ buttons
│                          │          │ [A. Nguyen ✓][R. Okafor ✓]│ chips   │ ┌──────────────────────┐ │
│ "Stay where you are.     │ message  │ [B. Lee][C. Diaz][...]   │ 48px    │ │ SN-2M8Q ...          │ │
│  Crew is 4 minutes out." │ block    │                          │         │ └──────────────────────┘ │
│  J. Ortiz · 15:13        │          │ ┌──────────────────────┐ │         │                          │
│                          │          │ │ Submit roll call     │ │ 64px    │                          │
│ [ Refresh ]              │          │ └──────────────────────┘ │ f-signal│                          │
└──────────────────────────┘          └──────────────────────────┘         └──────────────────────────┘
```

Phone rules:
- Exactly one `--color-f-signal` filled button per screen (Send report, Submit roll call, Resolve on the responder card). Everything else is ink outline or ink fill.
- Type tiles: 2×3 grid, 96px tall, 12px gap, 1.5px `--color-f-line-strong` outline, radius `md`, system 20px 600. Selected: `--color-f-ink` fill, white text. No icons in tiles; the words are the icons.
- Band banner: solid band color, 18px 600 text (ink or white per 3.3), mono-ish time. Hazardous or an active LOCAL_FIRE turns the banner into the alert: `FIRE REPORTED AT GYM · LEAVE THE BUILDING` in `--color-f-alarm` fill, white text, 20px 700.
- Text inputs: 64px, 20px text, `--color-f-line-strong` border, radius `sm`.
- Tap targets never under 48×48. Hit areas extend beyond the visible chip if the chip is smaller.
- No grain, no glow, no pulses except the status page's current-step dot (2s).
- Works with CSS only; no framer-motion on `/m/*` (keep it light, and nothing here needs to move).

### 8.8 `/hardware` (3D)

Dark. Full-viewport R3F canvas as the stage with a right-hand spec rail. Scroll drives the explode factor from 0 (assembled) to 1 (fully exploded) over 3 viewport heights; the canvas is sticky.

```
┌─ bar ─────────────────────────────────────────────────────────────────────────────┐
├──────────────────────────────────────────────────────────────┬────────────────────┤
│  SENTINEL NODE · REV A · DESIGNED, NOT FABRICATED             │ SPEC                │  rail 320px, --color-surface,
│                                                              │ MCU    ESP32-S3     │  hairline left, sticky,
│            ┌─────────────┐  ← IP65 lid (translucent graphite) │ PM     PMS5003      │  mono 12px two-column,
│            │             │                                    │ T/RH   BME280       │  label-signage headers
│        ┌───┴─────────────┴───┐  ← vented sensor chamber       │ Gas    MQ-2         │
│        │  ▭ PMS5003          │                                │ Radio  SX1262 915 MHz│
│        │  ▪ BME280  ▪ MQ-2   │                                │ LoRa   +22 dBm SF9  │
│        └───┬─────────────┬───┘                                │ Range  1 to 2 km    │
│            │ ▬▬▬ PCB ▬▬▬ │  ← ESP32-S3 + SX1262 + antenna     │ Power  18650 3400mAh│
│            │ ● LED  ▢ btn│                                    │ Solar  6 V 2 W      │
│            └─────────────┘                                    │ Normal ~12 mA       │
│            ▭▭▭▭▭▭▭▭▭▭▭▭▭  ← 18650 + TP4056 + MT3608            │ Disaster 180–250 mA │
│            ▭▭▭▭▭▭▭▭▭▭▭▭▭  ← 6 V 2 W solar panel (lid-mounted) │ Runtime 3 d / 12–18 h│
│                                                              ├────────────────────┤
│   [hotspot ○ with hairline leader to label]                  │ BOM @1000  $31      │
│   labels: Plex Mono 12px ink on --color-surface chip          │ @100      $42      │
│                                                              │ @1        $60      │
│   (scroll: assembled → exploded; drag: orbit ±30°)           ├────────────────────┤
│                                                              │ PIN MAP  ▸          │  collapsible, mono table
│                                                              │ [Download schematic]│  secondary (PNG in repo)
└──────────────────────────────────────────────────────────────┴────────────────────┘
```

Stage rules:
- Background `--color-canvas`. A 1px `--color-line-faint` ground grid (drei `<Grid>` with `cellColor`/`sectionColor` set to our hex, fade distance 18) so the object sits on something.
- Lighting: one `directionalLight` key at intensity 2.2 from upper left, one `directionalLight` rim at intensity 0.8 from back right colored `#46D2E4` (this is the one place the accent touches the 3D), `ambientLight` 0.25. No `<Environment>` preset (it fetches an HDR from a CDN, which is banned). Use `<ContactShadows opacity={0.5} blur={2.4} />` for grounding.
- Geometry is primitives, no GLTF: enclosure `RoundedBox` 1.6×1.0×0.5 radius 0.06; lid same footprint 0.08 thick; PCB `boxGeometry` 1.3×0.7×0.04; sensors as small boxes/cylinders; battery a cylinder 0.18 radius × 0.65; panel a thin box.
- Materials (`meshStandardMaterial`): enclosure `#2A2926` roughness 0.55; lid `#3A3835` roughness 0.35 opacity 0.85 transparent; PCB `#163A2E` roughness 0.6; modules `#B8B6B0` metalness 0.4 roughness 0.3; battery `#2C4A73`; panel `#0F1F3A` with `#1B3560` grid lines via a tiny canvas texture or just metalness 0.6. Five materials, no more.
- Explode: each part has a rest position and an exploded offset along Y (lid +0.9, panel +1.2, PCB −0.1, sensors +0.45, battery −0.8). Position = rest + offset × factor, factor eased with `--ease-enter` curve via `useScroll` from drei or a plain scroll listener. Parts also get a 1px hairline leader line (`<Line>` from drei) to their hotspot when factor > 0.5.
- Hotspots: 10px `--color-ink` dot with a 1px `--color-line-strong` ring; hover or tap opens a `Html` chip: Plex Mono 12px, `--color-surface`, hairline, radius `sm`, 8px padding, two lines (part, one fact). Chips never overlap the rail.
- Orbit: `OrbitControls` with `enableZoom={false}`, `minPolarAngle`/`maxPolarAngle` pinned to ±30° around the start, `enablePan={false}`, damping 0.08. Auto-rotate off.
- Reduced motion: explode factor jumps to 1, no damping.
- Below the canvas (after the 3 viewport heights): a BOM table (6.4) and the block diagram from the spec rendered as pre-formatted mono in a panel. Then the safety footer from the landing.

---

## 9. Tailwind v4 theme

Put this in `src/styles/app.css`. Import it once in `main.tsx`. Do not create a second theme file. The `--color-*: initial` line deletes Tailwind's default palette so nobody can type `bg-indigo-500` by accident; every color class you write must come from the list below.

```css
@import "tailwindcss";

/* fonts: bundled at build time via fontsource, nothing fetched at runtime */
@import "@fontsource-variable/archivo/wdth.css";
@import "@fontsource-variable/ibm-plex-sans";
@import "@fontsource/ibm-plex-mono/400.css";
@import "@fontsource/ibm-plex-mono/500.css";
@import "@fontsource/ibm-plex-mono/600.css";

@theme {
  /* wipe defaults */
  --color-*: initial;
  --font-*: initial;
  --radius-*: initial;
  --shadow-*: initial;
  --ease-*: initial;
  --text-*: initial;

  /* dark command ground */
  --color-canvas:       #0A0908;
  --color-surface:      #121110;
  --color-raised:       #1A1816;
  --color-overlay:      #221F1C;
  --color-line:         rgba(255, 255, 255, 0.08);
  --color-line-strong:  rgba(255, 255, 255, 0.14);
  --color-line-faint:   rgba(255, 255, 255, 0.045);
  --color-ink:          #F2EEE8;
  --color-ink-2:        #A9A39A;
  --color-ink-3:        #6F6A62;
  --color-ink-4:        #46423D;

  /* brand accent */
  --color-signal:       #46D2E4;
  --color-signal-ink:   #06272D;
  --color-signal-dim:   rgba(70, 210, 228, 0.12);
  --color-signal-line:  rgba(70, 210, 228, 0.40);

  /* state */
  --color-alarm:        #FF4A3D;
  --color-alarm-dim:    rgba(255, 74, 61, 0.14);
  --color-warn:         #FFB224;
  --color-warn-dim:     rgba(255, 178, 36, 0.14);
  --color-ok:           #5AD46E;
  --color-ok-dim:       rgba(90, 212, 110, 0.14);

  /* AQI bands */
  --color-band-good:               #5AD46E;
  --color-band-good-dim:           rgba(90, 212, 110, 0.14);
  --color-band-moderate:           #F2D94E;
  --color-band-moderate-dim:       rgba(242, 217, 78, 0.14);
  --color-band-usg:                #FF9A3C;
  --color-band-usg-dim:            rgba(255, 154, 60, 0.14);
  --color-band-unhealthy:          #FF4A3D;
  --color-band-unhealthy-dim:      rgba(255, 74, 61, 0.14);
  --color-band-veryunhealthy:      #B98BF0;
  --color-band-veryunhealthy-dim:  rgba(185, 139, 240, 0.14);
  --color-band-hazardous:          #D94A62;
  --color-band-hazardous-dim:      rgba(217, 74, 98, 0.16);

  /* light field ground (/m/*) */
  --color-f-canvas:       #F7F6F3;
  --color-f-surface:      #FFFFFF;
  --color-f-line:         rgba(10, 9, 8, 0.12);
  --color-f-line-strong:  rgba(10, 9, 8, 0.28);
  --color-f-ink:          #0A0908;
  --color-f-ink-2:        #57534C;
  --color-f-signal:       #0E7C8C;
  --color-f-alarm:        #D7261A;

  --color-white: #FFFFFF;
  --color-black: #000000;

  /* type */
  --font-display: "Archivo Variable", "Archivo", ui-sans-serif, sans-serif;
  --font-sans:    "IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono:    "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-field:   -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-field-mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;

  --text-2xs: 0.6875rem;  --text-2xs--line-height: 1rem;
  --text-xs:  0.75rem;    --text-xs--line-height: 1rem;
  --text-sm:  0.8125rem;  --text-sm--line-height: 1.125rem;
  --text-base: 0.9375rem; --text-base--line-height: 1.375rem;
  --text-md:  1.0625rem;  --text-md--line-height: 1.5rem;
  --text-lg:  1.25rem;    --text-lg--line-height: 1.625rem;
  --text-xl:  1.75rem;    --text-xl--line-height: 2rem;
  --text-2xl: 2.5rem;     --text-2xl--line-height: 2.625rem;
  --text-3xl: 3.5rem;     --text-3xl--line-height: 3.5rem;
  --text-4xl: 5rem;       --text-4xl--line-height: 4.75rem;
  --text-5xl: 7rem;       --text-5xl--line-height: 6.5rem;

  /* shape */
  --radius-xs:   2px;
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   14px;
  --radius-full: 9999px;

  /* depth (only menus, tooltips, toasts, phone sheet) */
  --shadow-overlay: 0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 32px -8px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06);
  --shadow-sheet:   0 -8px 32px rgba(10,9,8,0.18);

  /* motion */
  --ease-enter: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit:  cubic-bezier(0.4, 0, 1, 1);
  --ease-hop:   cubic-bezier(0.3, 0, 0.2, 1);
  --dur-fast:  120ms;
  --dur-base:  200ms;
  --dur-slow:  320ms;
  --dur-count: 600ms;

  /* layout */
  --container-console: 1600px;
  --container-prose: 68ch;
}

@layer base {
  html { background: var(--color-canvas); color: var(--color-ink); }
  body {
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--text-base--line-height);
    font-variant-numeric: tabular-nums;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  :focus-visible { outline: 2px solid var(--color-signal); outline-offset: 2px; }
  ::selection { background: var(--color-signal-dim); color: var(--color-ink); }
  button, input, select, textarea { font: inherit; color: inherit; }
  svg { display: block; }

  /* field (phone) pages flip the ground */
  [data-ground="field"] {
    background: var(--color-f-canvas);
    color: var(--color-f-ink);
    font-family: var(--font-field);
    font-size: 1.125rem;
    line-height: 1.5rem;
    -webkit-font-smoothing: auto;
  }
  [data-ground="field"] :focus-visible { outline-color: var(--color-f-signal); }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
    .hop-dash { display: none; }
  }
}

/* utilities every agent may use */
@utility hairline        { border: 1px solid var(--color-line); }
@utility hairline-strong { border: 1px solid var(--color-line-strong); }
@utility hairline-inset  { box-shadow: inset 0 0 0 1px var(--color-line); }

@utility label-signage {
  font-family: var(--font-display);
  font-stretch: 112%;
  font-weight: 600;
  font-size: var(--text-2xs);
  line-height: var(--text-2xs--line-height);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-ink-2);
}
@utility display-hero { font-family: var(--font-display); font-stretch: 78%;  font-weight: 620; letter-spacing: -0.025em; line-height: 0.96; }
@utility display-h1   { font-family: var(--font-display); font-stretch: 90%;  font-weight: 560; letter-spacing: -0.02em;  line-height: 1.04; }
@utility display-h2   { font-family: var(--font-display); font-stretch: 100%; font-weight: 520; letter-spacing: -0.012em; line-height: 1.12; }
@utility stat-number  { font-family: var(--font-display); font-stretch: 85%;  font-weight: 600; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }

@utility grain {
  position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 160px 160px;
}

@keyframes pulse-live  { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
@keyframes pulse-ring  { 0% { transform: scale(.6); opacity: .6 } 100% { transform: scale(1.4); opacity: 0 } }
@utility pulse-live { animation: pulse-live 2s linear infinite; }
@utility pulse-ring { animation: pulse-ring 1.6s var(--ease-exit) infinite; transform-origin: center; }
@utility pulse-ring-alarm { animation: pulse-ring 1.2s var(--ease-exit) infinite; transform-origin: center; }
```

Usage examples so six agents type the same thing:

```tsx
<div className="bg-surface hairline rounded-md p-5">           // panel
<span className="label-signage">Outdoor activity</span>         // eyebrow
<td className="font-mono text-xs text-ink-2 text-right">71</td> // data cell
<button className="bg-signal text-signal-ink rounded-sm h-9 px-3.5 font-medium"> // primary
<span className="inline-flex items-center gap-1.5 rounded-full bg-ok-dim text-ok text-xs font-medium px-2 py-0.5">
  <i className="size-1.5 rounded-full bg-ok" /> Verified
</span>
<main data-ground="field" className="min-h-dvh px-5">           // phone page root
```

Icons: `lucide-react`, always `size={16} strokeWidth={1.5}` in dense UI, `size={20}` in buttons. Import named icons only.

---

## 10. Copy

- Sentence case. Buttons say what happens: "Send report", "Start fire drill", "End drill", "Resolve", "Flag as false". Not "Submit", not "OK".
- Relative time plus absolute: "4 min ago" with the absolute in `title`. Console clock in mono 24-hour with zone: `15:12 PDT`.
- Units always shown once per panel in the label, not on every number: `PM2.5 µg/m³` in the header, bare `71` in the cell.
- Errors say what to do: "Could not reach the server. Readings will catch up when it is back." Never "Error 500".
- Empty states invite one action: "No open incidents." plus the context line. Never a sad illustration.
- Simulation honesty lives in the SIM tag and the footer, not in every caption.
- Avoid: elevate, unlock, supercharge, seamless, empower, streamline, leverage, all-in-one, beacon, journey, robust, comprehensive, "not just X, it's Y", exclamation marks, em dashes.
- Landing copy is from the spec's own lines. Use them verbatim where they exist: "Disaster hardware fails because it sits unused. This box earns its wall every month." "Only a responder can close an incident. Only a phone standing next to the box can open a verified one."

---

## 11. Pre-ship checklist for every agent

Before you call a page done, open it at 1440 and 390 wide and check:

- [ ] `#root` renders content; console has zero errors.
- [ ] No color class outside section 9. `grep -rn "indigo\|violet\|purple\|slate\|gray-\|zinc" src/` returns nothing.
- [ ] No `Inter`, no `transition: all`, no `rounded-2xl`, no `shadow-lg` on a card. `grep -rn "transition-all\|rounded-2xl\|rounded-xl\|shadow-lg\|shadow-xl" src/` returns nothing (except the four overlay cases).
- [ ] Mono appears only on data. Signage labels appear only on eyebrows and table headers.
- [ ] One primary button per view. Green only on Resolve. Red only on state and destructive actions.
- [ ] Exactly one SIM tag on the view, with the exact string from 6.13.
- [ ] Empty, loading, and error states exist for every list and every fetch.
- [ ] Keyboard: tab order makes sense, focus ring visible, Enter activates the selected queue row.
- [ ] `prefers-reduced-motion` tested with the OS toggle; alarms still obvious.
- [ ] Phone pages: nothing under 14px, every target at least 48px, one accent fill, light ground.
- [ ] `grep -rniE "elevate|unlock|supercharge|seamless|empower|streamline|leverage|all-in-one|beacon|journey" src/` returns nothing.
- [ ] A hop dash is visible somewhere on `/`, `/admin`, and `/responder`.
