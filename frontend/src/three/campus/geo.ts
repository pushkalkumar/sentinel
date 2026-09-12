// Real OSM footprints from shared/campus.geojson (docs/MAP_DATA.md). Metres → world: 1 unit = 10 m, x east, z south.
import raw from '@shared/campus.geojson?raw'

export type XZ = readonly [number, number]
export type Ring = readonly XZ[]
export type FeatureKind = 'building' | 'pitch' | 'track' | 'park' | 'playground' | 'parking' | 'road' | 'campus'

interface RawFeature {
  properties: { kind: FeatureKind; name: string | null; on_campus: boolean; highway: string | null; levels: string | null; id: number }
  geometry: { type: 'Polygon'; coordinates: number[][][] } | { type: 'LineString'; coordinates: number[][] }
}

export interface Footprint { id: number; name: string | null; rings: Ring[]; height: number; campus: boolean }
export interface Road { id: number; path: Ring; width: number; major: boolean }

export const METRES_PER_UNIT = 10
/** World height per building level (MAP_DATA §Coordinates). */
const LEVEL_HEIGHT = 0.35
const PORTABLE_HEIGHT = 0.3
/** Unlabelled houses get a deterministic ±12 % variation so the neighbourhood does not read as one flat slab. */
const HOUSE_JITTER = 0.12

/** Ribbon widths in metres by OSM highway class. */
const ROAD_WIDTH_M: Record<string, number> = {
  primary: 9, secondary: 7.5, residential: 5.5, service: 3.2, pedestrian: 2.4, cycleway: 1.6, footway: 1.3, steps: 1.3,
}
const MAJOR = new Set(['primary', 'secondary', 'residential'])

export const toWorld = (x: number, y: number): XZ => [x / METRES_PER_UNIT, y / METRES_PER_UNIT]

const ring = (coords: number[][]): Ring => {
  const pts = coords.map(([x, y]) => toWorld(x, y))
  // GeoJSON rings repeat the first vertex; Shape closes itself.
  const last = pts[pts.length - 1]
  const first = pts[0]
  return last && first && last[0] === first[0] && last[1] === first[1] ? pts.slice(0, -1) : pts
}

const hash01 = (n: number) => {
  let h = (n ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0
  return ((h ^ (h >>> 16)) >>> 0) / 0xffffffff
}

const buildingHeight = (f: RawFeature['properties']): number => {
  if (f.name?.startsWith('Portable')) return PORTABLE_HEIGHT
  const levels = f.levels ? Number(f.levels) : NaN
  if (Number.isFinite(levels) && levels > 0) return levels * LEVEL_HEIGHT
  return f.on_campus ? LEVEL_HEIGHT : LEVEL_HEIGHT * (1 + (hash01(f.id) * 2 - 1) * HOUSE_JITTER)
}

const data = JSON.parse(raw) as { features: RawFeature[]; attribution: string }
export const ATTRIBUTION = data.attribution

const polys = (kind: FeatureKind) => data.features.filter((f) => f.properties.kind === kind && f.geometry.type === 'Polygon')

const footprints: Footprint[] = polys('building').map((f) => ({
  id: f.properties.id,
  name: f.properties.name,
  rings: (f.geometry.coordinates as number[][][]).map(ring),
  height: buildingHeight(f.properties),
  campus: f.properties.on_campus,
}))

export const CAMPUS_BUILDINGS: readonly Footprint[] = footprints.filter((b) => b.campus)
export const NEIGHBOURHOOD_BUILDINGS: readonly Footprint[] = footprints.filter((b) => !b.campus)

const outerRings = (kind: FeatureKind): Ring[] => polys(kind).map((f) => ring((f.geometry.coordinates as number[][][])[0]))

export const PITCH: Ring | null = outerRings('pitch')[0] ?? null
export const PARKING: readonly Ring[] = outerRings('parking')
export const PARCEL: Ring | null = outerRings('campus')[0] ?? null
/** Everything the data calls green space (none in this export, kept for the future). */
export const GREENS: readonly Ring[] = [...outerRings('park'), ...outerRings('playground')]

export const ROADS: readonly Road[] = data.features
  .filter((f) => f.properties.kind === 'road' && f.geometry.type === 'LineString' && f.properties.highway !== 'platform')
  .map((f) => {
    const cls = f.properties.highway ?? 'service'
    return {
      id: f.properties.id,
      path: (f.geometry.coordinates as number[][]).map(([x, y]) => toWorld(x, y)),
      width: (ROAD_WIDTH_M[cls] ?? 3) / METRES_PER_UNIT,
      major: MAJOR.has(cls),
    }
  })
  .filter((r) => r.path.length >= 2)

/** Scene extent, for the ground plane, fog and the shadow frustum. */
export const EXTENT = (() => {
  let r = 0
  for (const b of footprints) for (const p of b.rings[0]) r = Math.max(r, Math.abs(p[0]), Math.abs(p[1]))
  return Math.ceil(r)
})()

/** Ray-casting point-in-polygon on the outer ring. */
export function pointInRing(p: XZ, poly: Ring): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i]
    const [xj, zj] = poly[j]
    const crosses = zi > p[1] !== zj > p[1] && p[0] < ((xj - xi) * (p[1] - zi)) / (zj - zi) + xi
    if (crosses) inside = !inside
  }
  return inside
}

/** Roof height under a world point, or 0 on open ground. Checks campus buildings first. */
export function roofHeightAt(p: XZ): number {
  for (const b of CAMPUS_BUILDINGS) if (pointInRing(p, b.rings[0])) return b.height
  for (const b of NEIGHBOURHOOD_BUILDINGS) if (pointInRing(p, b.rings[0])) return b.height
  return 0
}
