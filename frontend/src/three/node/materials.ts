// Shared materials and procedural textures (HARDWARE_3D §4.1, DESIGN tokens for the accent).
// Module singletons: never `new` a material inside render.
import * as THREE from 'three'

/** DESIGN §3.1 signal cyan; the LED default and the rim light. */
export const SIGNAL = '#46D2E4'
/** DESIGN §3.2 ok green: LED at rest. */
export const LED_DEFAULT = '#5AD46E'

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
  const W = 512
  const H = 300
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#0b1d3a'
  ctx.fillRect(0, 0, W, H)
  const cols = 6
  const rows = 4
  const cw = W / cols
  const ch = H / rows
  ctx.fillStyle = '#7c8590'
  for (let i = 1; i < cols; i++) ctx.fillRect(Math.round(i * cw) - 2, 0, 4, H)
  for (let j = 1; j < rows; j++) ctx.fillRect(0, Math.round(j * ch) - 2, W, 4)
  ctx.fillStyle = '#9aa3ad'
  for (let j = 0; j < rows; j++) {
    for (const f of [0.33, 0.66]) ctx.fillRect(0, Math.round(j * ch + ch * f) - 1, W, 2)
  }
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, 'rgba(255,255,255,0.05)')
  g.addColorStop(0.5, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,0.05)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export const brushedTexture = makeBrushedTexture()
export const solarTexture = makeSolarTexture()

const std = (color: string, roughness: number, metalness: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })

export const MATERIALS = {
  enclosure: std('#34373c', 0.85, 0.05),
  vent: std('#0f1113', 0.9, 0),
  frost: std('#e8ecf1', 0.6, 0, { transparent: true, opacity: 0.5, depthWrite: false }),
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
  /** Button dome stays neutral so the one accent on the page is the LED and rim light (BUILD_PLAN §2.10). */
  accent: std('#B8B6B0', 0.35, 0),
  ledEmissive: std('#ffffff', 0.4, 0, { emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 1.6 }),
  ledPipe: std('#e8ecf1', 0.6, 0, {
    transparent: true, opacity: 0.5, depthWrite: false,
    emissive: new THREE.Color(LED_DEFAULT), emissiveIntensity: 0.35,
  }),
  solarGlass: new THREE.MeshPhysicalMaterial({
    color: '#0b1d3a', map: solarTexture ?? undefined, roughness: 0.15, metalness: 0.1,
    clearcoat: 1, clearcoatRoughness: 0.08,
  }),
  /** Transparent hover overlay, toggled visible per part; DESIGN accent, never amber. */
  hoverOverlay: new THREE.MeshBasicMaterial({ color: SIGNAL, transparent: true, opacity: 0.12, depthWrite: false }),
} as const

export type MaterialKey = keyof typeof MATERIALS

/** Set the LED colour from the demo's current band (hex). */
export function setLedColor(hex: string) {
  MATERIALS.ledEmissive.emissive.set(hex)
  MATERIALS.ledPipe.emissive.set(hex)
}
