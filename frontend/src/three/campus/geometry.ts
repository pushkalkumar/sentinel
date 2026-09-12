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

/** Polyline → flat ribbon with mitred joins (capped so acute corners do not spike). */
function ribbon(path: Ring, width: number, positions: number[], indices: number[]): void {
  const half = width / 2
  const n = path.length
  const dirs: [number, number][] = []
  for (let i = 0; i < n - 1; i += 1) {
    const dx = path[i + 1][0] - path[i][0]
    const dz = path[i + 1][1] - path[i][1]
    const len = Math.hypot(dx, dz) || 1
    dirs.push([dx / len, dz / len])
  }
  const base = positions.length / 3
  for (let i = 0; i < n; i += 1) {
    const d0 = dirs[Math.max(0, i - 1)]
    const d1 = dirs[Math.min(n - 2, i)]
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
  for (let i = 0; i < n - 1; i += 1) {
    const a = base + i * 2
    indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
  }
}

export function roadRibbons(roads: readonly Road[]): THREE.BufferGeometry | null {
  if (roads.length === 0) return null
  const positions: number[] = []
  const indices: number[] = []
  for (const r of roads) ribbon(r.path, r.width, positions, indices)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setIndex(indices)
  const normals = new Float32Array(positions.length)
  for (let i = 1; i < normals.length; i += 3) normals[i] = 1
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return g
}

/** Closed ring as a point list for drei Line (repeats the first point). */
export const closedLoop = (r: Ring, y: number): [number, number, number][] => [...r, r[0]].map(([x, z]) => [x, y, z])
