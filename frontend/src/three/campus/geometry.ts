// Turns MAP_DATA footprints and roads into merged BufferGeometries: one draw call per material.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Footprint, Ring, Road } from './geo'

/** Shape space is (x, -z) so that rotateX(-π/2) lands the extrusion upright on the XZ plane with z = south. */
function shapeFromRings(rings: Ring[]): THREE.Shape {
  const shape = new THREE.Shape(rings[0].map(([x, z]) => new THREE.Vector2(x, -z)))
  for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))))
  return shape
}

export function extrudeFootprints(buildings: readonly Footprint[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  for (const b of buildings) {
    if (b.rings[0].length < 3) continue
    const g = new THREE.ExtrudeGeometry(shapeFromRings(b.rings), { depth: b.height, bevelEnabled: false, curveSegments: 1 })
    g.rotateX(-Math.PI / 2)
    g.deleteAttribute('uv')
    parts.push(g)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

export function flatPolygons(rings: readonly Ring[]): THREE.BufferGeometry | null {
  const parts: THREE.BufferGeometry[] = []
  for (const r of rings) {
    if (r.length < 3) continue
    const g = new THREE.ShapeGeometry(shapeFromRings([r]), 1)
    g.rotateX(-Math.PI / 2)
    g.deleteAttribute('uv')
    parts.push(g)
  }
  if (parts.length === 0) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  return merged
}

/** Polyline → flat ribbon with mitred joins (capped so acute corners do not spike). `closed` wraps the last vertex back to the first. */
function ribbon(path: Ring, width: number, positions: number[], indices: number[], closed = false): void {
  const half = width / 2
  const n = path.length
  const segs = closed ? n : n - 1
  if (segs < 1) return
  const dirs: [number, number][] = []
  for (let i = 0; i < segs; i += 1) {
    const a = path[i]
    const b = path[(i + 1) % n]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const len = Math.hypot(dx, dz) || 1
    dirs.push([dx / len, dz / len])
  }
  const base = positions.length / 3
  for (let i = 0; i < n; i += 1) {
    const d0 = closed ? dirs[(i - 1 + segs) % segs] : dirs[Math.max(0, i - 1)]
    const d1 = closed ? dirs[i % segs] : dirs[Math.min(segs - 1, i)]
    let tx = d0[0] + d1[0]
    let tz = d0[1] + d1[1]
    const tl = Math.hypot(tx, tz)
    if (tl < 1e-6) { tx = d1[0]; tz = d1[1] } else { tx /= tl; tz /= tl }
    // normal of the averaged tangent, scaled by the mitre length (1 / cos(θ/2)), capped at 2.
    const nx = -tz
    const nz = tx
    const cosHalf = Math.max(0.5, nx * -d1[1] + nz * d1[0])
    const m = half / cosHalf
    positions.push(path[i][0] + nx * m, 0, path[i][1] + nz * m, path[i][0] - nx * m, 0, path[i][1] - nz * m)
  }
  for (let i = 0; i < segs; i += 1) {
    const a = base + i * 2
    const c = base + ((i + 1) % n) * 2
    indices.push(a, c, a + 1, a + 1, c, c + 1)
  }
}

function ribbonGeometry(positions: number[], indices: number[]): THREE.BufferGeometry | null {
  if (indices.length === 0) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return g
}

export function roadRibbons(roads: readonly Road[]): THREE.BufferGeometry | null {
  if (roads.length === 0) return null
  const positions: number[] = []
  const indices: number[] = []
  for (const r of roads) ribbon(r.path, r.width, positions, indices)
  return ribbonGeometry(positions, indices)
}

/**
 * Closed outlines as flat mitred ribbons. A rasterised strip stays continuous at any angle,
 * where a hairline screen-space line breaks into dots along a grazing edge (DESIGN_V2: solid strokes only).
 */
export function outlineRibbons(rings: readonly Ring[], width: number): THREE.BufferGeometry | null {
  const positions: number[] = []
  const indices: number[] = []
  for (const r of rings) {
    if (r.length < 3) continue
    ribbon(r, width, positions, indices, true)
  }
  return ribbonGeometry(positions, indices)
}
