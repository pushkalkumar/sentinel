// Shared materials and procedural textures (HARDWARE_3D §4.1, DESIGN tokens for the accent).
// Module singletons: never `new` a material inside render.
import * as THREE from 'three'

/** DESIGN §3.1 signal cyan; the LED default and the rim light. */
export const SIGNAL = '#46D2E4'
/** LED at rest glows the signal cyan; setLedColor swaps it for a band colour. */
export const LED_DEFAULT = SIGNAL

function makeBrushedTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#888'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 900; i++) {
    const y = Math.floor(Math.random() * 256)
    const a = 0.08 + Math.random() * 0.17
    ctx.fillStyle = Math.random() < 0.5 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
    ctx.fillRect(0, y, 256, 1)
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.RepeatWrapping
  t.repeat.set(3, 1)
  t.colorSpace = THREE.NoColorSpace
  return t
}

function makeSolarTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null
  const W = 1024
  const H = 600
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null
  const cols = 6
  const rows = 4
  const cw = W / cols
  const ch = H / rows
  const gap = 5
  const busbar = 3
  // Frame between cells: a light gray-blue backing that shows through the gaps.
  ctx.fillStyle = '#8e9aa8'
  ctx.fillRect(0, 0, W, H)
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = Math.round(i * cw) + gap
      const y = Math.round(j * ch) + gap
      const w = Math.round(cw) - gap * 2
      const h = Math.round(ch) - gap * 2
      // Each cell: dark navy with a faint diagonal sheen so the grid reads at a glance.
      const g = ctx.createLinearGradient(x, y, x + w, y + h)
      g.addColorStop(0, '#16284f')
      g.addColorStop(0.5, '#0e1c3b')
      g.addColorStop(1, '#152647')
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      // Two vertical busbars per cell plus fine horizontal fingers.
      ctx.fillStyle = '#c4ccd6'
      for (const f of [0.33, 0.66]) ctx.fillRect(x + Math.round(w * f) - 1, y, busbar, h)
      ctx.fillStyle = 'rgba(190,200,215,0.55)'
      for (let k = 1; k < 10; k++) ctx.fillRect(x, y + Math.round((h * k) / 10), w, 1)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export const brushedTexture = makeBrushedTexture()
export const solarTexture = makeSolarTexture()

const std = (color: string, roughness: number, metalness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

export const MATERIALS = {
  enclosure: std('#34373c', 0.85, 0.05),
  /** Lid is a lighter matte gray so it separates from the tray when closed. */
  lid: std('#4d5055', 0.92, 0),
  vent: std('#0f1113', 0.9, 0),
  pcb: std('#0b1f16', 0.55, 0.1),
  pcbModule: std('#0e1a2b', 0.5, 0.1),
  pcbBlue: std('#0f2a5c', 0.5, 0.1),
  pad: std('#c9b98a', 0.4, 0.6),
  steelCan: std('#b8bcc2', 0.35, 0.75),
  steel: std('#d0d3d8', 0.3, 0.9),
  steelMesh: std('#9a9ea3', 0.45, 0.8, { roughnessMap: brushedTexture ?? undefined }),
  brushed: std('#aeb2b8', 0.4, 0.85, { roughnessMap: brushedTexture ?? undefined }),
  brass: std('#c9a24a', 0.35, 0.9),
  copper: std('#c8803a', 0.3, 0.9),
  cellWrap: std('#0f5c55', 0.45, 0.05),
  plasticBlack: std('#17191c', 0.7, 0),
  plasticWhite: std('#e6e2d8', 0.7, 0),
  /** Button cap stays neutral so the one accent on the page is the LED and rim light (BUILD_PLAN §2.10). */
  accent: std('#9a9c9f', 0.6, 0.05),
  ledEmissive: std('#ffffff', 0.4, 0, { emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 1.6 }),
  ledPipe: std('#e8ecf1', 0.6, 0, {
    transparent: true, opacity: 0.5, depthWrite: false,
    emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 0.35,
  }),
  /** Frosted LED dome on the lid: soft cyan glow, mostly opaque so it reads as a part, not a ghost. */
  ledDome: std('#dfe7ee', 0.5, 0, {
    transparent: true, opacity: 0.85, depthWrite: false,
    emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 0.9,
  }),
  /** Colour stays white so the cell texture is not multiplied down to black. */
  solarGlass: new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: solarTexture ?? undefined, roughness: 0.3, metalness: 0.15,
    clearcoat: 0.6, clearcoatRoughness: 0.2,
  }),
  /** Transparent hover overlay, toggled visible per part; DESIGN accent, never amber. */
  hoverOverlay: new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.12, depthWrite: false }),
} as const

export type MaterialKey = keyof typeof MATERIALS

/** Set the LED colour from the demo's current band (hex). */
export function setLedColor(hex: string) {
  MATERIALS.ledEmissive.emissive.set(hex)
  MATERIALS.ledPipe.emissive.set(hex)
  MATERIALS.ledDome.emissive.set(hex)
}
