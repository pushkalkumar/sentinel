// Procedural CanvasTextures for the node model (DESIGN_V2 §5 materials). Built once per module load; null when there is no DOM.
import * as THREE from 'three'

type Ctx = CanvasRenderingContext2D

function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  return ctx ? [c, ctx] : null
}

function finish(c: HTMLCanvasElement, srgb = true): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  return t
}

/** Deterministic PRNG so the trace layout is identical on every load. */
function mulberry(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const PCB_BASE = '#151716'
const TRACE = '#2A3330'
const PAD = '#8F8A7C'
const SILK = 'rgba(217, 207, 192, 0.6)'

/** Module footprints in board mm (x right, z down the canvas = toward the front wall). Board is 130 × 80, origin centre. */
const FOOTPRINTS: { x: number; z: number; w: number; d: number; ref: string }[] = [
  { x: -45, z: -22, w: 18, d: 25.5, ref: 'U1' },
  { x: -45, z: 12, w: 24, d: 14, ref: 'U2' },
  { x: -6, z: -24, w: 22, d: 28, ref: 'U3' },
  { x: 2, z: 6, w: 12, d: 12, ref: 'BZ1' },
  { x: -6, z: 32, w: 8, d: 8, ref: 'D1' },
  { x: 20, z: 31, w: 10, d: 12, ref: 'U4' },
  { x: 47, z: -12, w: 38, d: 50, ref: 'J1' },
  { x: 47, z: 28, w: 18, d: 18, ref: 'Q1' },
]

/** 130 × 80 mm board top: traces, pads, silkscreen. 8 px per mm. */
function makePcbTexture(): THREE.Texture | null {
  const px = 8
  const W = 130 * px
  const H = 80 * px
  const r = canvas(W, H)
  if (!r) return null
  const [c, ctx] = r
  const X = (x: number) => (x + 65) * px
  const Z = (z: number) => (z + 40) * px
  const rnd = mulberry(7)

  ctx.fillStyle = PCB_BASE
  ctx.fillRect(0, 0, W, H)

  // Ground pour hatching: faint, so the board is not a flat colour.
  ctx.strokeStyle = 'rgba(42, 51, 48, 0.35)'
  ctx.lineWidth = 1
  for (let i = -H; i < W; i += 14) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + H, H)
    ctx.stroke()
  }

  // Traces: Manhattan routes with 45° corners between footprint edges.
  ctx.strokeStyle = TRACE
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  const pins: [number, number][] = []
  for (const f of FOOTPRINTS) {
    const n = Math.max(3, Math.round(f.d / 4))
    for (let i = 0; i < n; i++) {
      const z = f.z - f.d / 2 + ((i + 0.5) * f.d) / n
      pins.push([f.x - f.w / 2 - 1.5, z])
      pins.push([f.x + f.w / 2 + 1.5, z])
    }
  }
  for (let i = 0; i < 70; i++) {
    const a = pins[Math.floor(rnd() * pins.length)]
    const b = pins[Math.floor(rnd() * pins.length)]
    if (!a || !b || a === b) continue
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const diag = Math.min(Math.abs(dx), Math.abs(dz)) * (0.3 + rnd() * 0.5)
    const sx = Math.sign(dx)
    const sz = Math.sign(dz)
    ctx.beginPath()
    ctx.moveTo(X(a[0]), Z(a[1]))
    if (rnd() < 0.5) {
      ctx.lineTo(X(a[0] + (Math.abs(dx) - diag) * sx), Z(a[1]))
      ctx.lineTo(X(b[0]), Z(a[1] + diag * sz))
    } else {
      ctx.lineTo(X(a[0]), Z(a[1] + (Math.abs(dz) - diag) * sz))
      ctx.lineTo(X(a[0] + diag * sx), Z(b[1]))
    }
    ctx.lineTo(X(b[0]), Z(b[1]))
    ctx.stroke()
  }

  // Pads and vias.
  ctx.fillStyle = PAD
  for (const [x, z] of pins) {
    ctx.beginPath()
    ctx.arc(X(x), Z(z), 1.1 * px, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 140; i++) {
    ctx.beginPath()
    ctx.arc(rnd() * W, rnd() * H, 0.45 * px, 0, Math.PI * 2)
    ctx.fill()
  }
  // Passives: small 0603 outlines with two pads.
  for (let i = 0; i < 46; i++) {
    const x = rnd() * 124 - 62
    const z = rnd() * 74 - 37
    const horiz = rnd() < 0.5
    ctx.fillStyle = PAD
    ctx.fillRect(X(x) - (horiz ? 1.2 : 0.5) * px, Z(z) - (horiz ? 0.5 : 1.2) * px, (horiz ? 0.7 : 1) * px, (horiz ? 1 : 0.7) * px)
    ctx.fillRect(X(x) + (horiz ? 0.5 : -0.5) * px, Z(z) + (horiz ? -0.5 : 0.5) * px, (horiz ? 0.7 : 1) * px, (horiz ? 1 : 0.7) * px)
    ctx.fillStyle = '#26282a'
    ctx.fillRect(X(x) - (horiz ? 0.5 : 0.35) * px, Z(z) - (horiz ? 0.35 : 0.5) * px, (horiz ? 1 : 0.7) * px, (horiz ? 0.7 : 1) * px)
  }

  // Silkscreen: footprint outlines, reference designators, the board name, mounting hole rings.
  ctx.strokeStyle = SILK
  ctx.fillStyle = SILK
  ctx.lineWidth = 1.5
  ctx.font = `500 ${2.6 * px}px "IBM Plex Mono", ui-monospace, monospace`
  for (const f of FOOTPRINTS) {
    ctx.strokeRect(X(f.x - f.w / 2), Z(f.z - f.d / 2), f.w * px, f.d * px)
    ctx.fillText(f.ref, X(f.x - f.w / 2), Z(f.z - f.d / 2) - 0.8 * px)
  }
  ctx.font = `500 ${3.4 * px}px "Archivo Variable", "Archivo", ui-sans-serif, sans-serif`
  ctx.fillText('SENTINEL NODE  REV A', X(-62), Z(37.5))
  ctx.font = `400 ${2.4 * px}px "IBM Plex Mono", ui-monospace, monospace`
  ctx.textAlign = 'right'
  ctx.fillText('2026-09  915 MHz', X(62), Z(37.5))
  ctx.textAlign = 'left'
  for (const [x, z] of [[-61, -36], [61, -36], [-61, 36], [61, 36]]) {
    ctx.beginPath()
    ctx.arc(X(x), Z(z), 2.6 * px, 0, Math.PI * 2)
    ctx.stroke()
  }
  // Board outline chamfer hint at the sensor chamber divider.
  ctx.setLineDash([6, 6])
  ctx.beginPath()
  ctx.moveTo(X(27), Z(-38))
  ctx.lineTo(X(27), Z(38))
  ctx.stroke()
  ctx.setLineDash([])
  return finish(c)
}

/** ESP32-S3-WROOM substrate: meander antenna at one end, castellations along the long edges. 18 × 25.5 mm at 16 px/mm. */
function makeEspTexture(): THREE.Texture | null {
  const px = 16
  const W = 18 * px
  const H = 25.5 * px
  const r = canvas(W, H)
  if (!r) return null
  const [c, ctx] = r
  ctx.fillStyle = '#121513'
  ctx.fillRect(0, 0, W, H)
  // Meander antenna in the top 6 mm.
  ctx.strokeStyle = PAD
  ctx.lineWidth = 0.9 * px
  ctx.lineCap = 'square'
  ctx.beginPath()
  let x = 2 * px
  const top = 1.2 * px
  const bot = 5.2 * px
  ctx.moveTo(x, bot)
  for (let i = 0; i < 6; i++) {
    ctx.lineTo(x, i % 2 === 0 ? top : bot)
    x += 2.3 * px
    ctx.lineTo(x, i % 2 === 0 ? top : bot)
  }
  ctx.stroke()
  // Castellated pads.
  ctx.fillStyle = PAD
  for (let i = 0; i < 12; i++) {
    const y = (7 + i * 1.5) * px
    ctx.fillRect(0, y, 1.1 * px, 0.8 * px)
    ctx.fillRect(W - 1.1 * px, y, 1.1 * px, 0.8 * px)
  }
  for (let i = 0; i < 8; i++) {
    const xx = (2 + i * 1.9) * px
    ctx.fillRect(xx, H - 1.1 * px, 0.8 * px, 1.1 * px)
  }
  return finish(c)
}

/** Shrink-wrap for the 18650: u runs around the cell, v along its length. */
function makeCellTexture(): THREE.Texture | null {
  const r = canvas(1024, 1024)
  if (!r) return null
  const [c, ctx] = r
  ctx.fillStyle = '#2D4C6D'
  ctx.fillRect(0, 0, 1024, 1024)
  // A pale stripe at the positive end and a hairline near the negative end.
  ctx.fillStyle = '#D9CFC0'
  ctx.fillRect(0, 56, 1024, 22)
  ctx.fillStyle = 'rgba(217, 207, 192, 0.35)'
  ctx.fillRect(0, 960, 1024, 4)
  // Label text runs along the length.
  ctx.save()
  ctx.translate(0, 1024)
  ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = 'rgba(237, 232, 224, 0.85)'
  ctx.font = '500 58px "Archivo Variable", "Archivo", ui-sans-serif, sans-serif'
  ctx.fillText('18650  3400 mAh', 140, 300)
  ctx.font = '400 40px "IBM Plex Mono", ui-monospace, monospace'
  ctx.fillStyle = 'rgba(237, 232, 224, 0.6)'
  ctx.fillText('3.6 V  Li-ion  protected', 140, 360)
  ctx.fillText('+', 900, 300)
  ctx.restore()
  const t = finish(c)
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Solar glass: 6 × 4 mono cells with fine fingers, baked at full colour (material colour stays white). */
function makeSolarTexture(): THREE.Texture | null {
  const W = 1200
  const H = 700
  const r = canvas(W, H)
  if (!r) return null
  const [c, ctx] = r
  ctx.fillStyle = '#1A2E4A'
  ctx.fillRect(0, 0, W, H)
  const cols = 6
  const rows = 4
  const cw = W / cols
  const ch = H / rows
  const gap = 7
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = i * cw + gap
      const y = j * ch + gap
      const w = cw - gap * 2
      const h = ch - gap * 2
      const g = ctx.createLinearGradient(x, y, x + w, y + h)
      g.addColorStop(0, '#10203A')
      g.addColorStop(0.5, '#0E1A2E')
      g.addColorStop(1, '#0F1E36')
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      ctx.fillStyle = '#26395A'
      for (const f of [0.33, 0.66]) ctx.fillRect(x + Math.round(w * f) - 2, y, 4, h)
      ctx.fillStyle = 'rgba(58, 78, 110, 0.7)'
      for (let k = 1; k < 14; k++) ctx.fillRect(x, y + Math.round((h * k) / 14), w, 1)
    }
  }
  return finish(c)
}

/** Woven stainless mesh for the MQ-2 can, used as a bump map. */
function makeMeshBump(): THREE.Texture | null {
  const r = canvas(256, 256)
  if (!r) return null
  const [c, ctx] = r
  ctx.fillStyle = '#808080'
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 2
  for (let i = 0; i < 256; i += 8) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke()
  }
  const t = finish(c, false)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 2)
  return t
}

/** Soft radial pool under the model: surface colour at the centre fading to canvas. */
function makeGroundTexture(): THREE.Texture | null {
  const r = canvas(512, 512)
  if (!r) return null
  const [c, ctx] = r
  const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256)
  g.addColorStop(0, '#171514')
  g.addColorStop(0.45, '#121010')
  g.addColorStop(1, '#0B0A09')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 512, 512)
  return finish(c)
}

export const pcbTexture = makePcbTexture()
export const espTexture = makeEspTexture()
export const cellTexture = makeCellTexture()
export const solarTexture = makeSolarTexture()
export const meshBump = makeMeshBump()
export const groundTexture = makeGroundTexture()
