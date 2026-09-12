// Baked ambient-occlusion plane: every footprint drawn black onto a 2D canvas and blurred, laid flat just above the ground.
import * as THREE from 'three'
import { CAMPUS_BUILDINGS, EXTENT, NEIGHBOURHOOD_BUILDINGS, type Footprint } from './geo'

const SIZE = 2048
const BLUR_PX = 9
const HOUSE_ALPHA = 0.55
const CAMPUS_ALPHA = 0.75

export const AO_WORLD = EXTENT * 2 + 4

function paint(ctx: CanvasRenderingContext2D, buildings: readonly Footprint[], alpha: number, scale: number): void {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`
  for (const b of buildings) {
    const r = b.rings[0]
    if (r.length < 3) continue
    ctx.beginPath()
    r.forEach(([x, z], i) => {
      const px = (x + AO_WORLD / 2) * scale
      const py = (z + AO_WORLD / 2) * scale
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    })
    ctx.closePath()
    ctx.fill()
  }
}

/** Null where there is no 2D canvas (tests, SSR). */
export function bakeAOTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const scale = SIZE / AO_WORLD
  ctx.filter = `blur(${BLUR_PX}px)`
  paint(ctx, NEIGHBOURHOOD_BUILDINGS, HOUSE_ALPHA, scale)
  paint(ctx, CAMPUS_BUILDINGS, CAMPUS_ALPHA, scale)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.NoColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}
