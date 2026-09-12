// Bakes shared/campus.geojson (OSM, local metres) into SVG path strings.
//   node frontend/scripts/build-campus-map.mjs
// Writes src/components/map/campusPaths.ts (consumed by CampusGround) and
// public/maps/campus.svg (static render for Devpost). Both use the MAP_DATA.md
// mapping: sx = 500 + x * 2.5, sy = 350 + y * 2.5, viewBox 0 0 1000 700.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '../..')
const geo = JSON.parse(readFileSync(resolve(root, 'shared/campus.geojson'), 'utf8'))
const topology = JSON.parse(readFileSync(resolve(root, 'shared/topology.json'), 'utf8'))

const VIEW = { w: 1000, h: 700 }
const SCALE = 2.5
const TOLERANCE_M = 1          // neighbourhood simplification, metres
const MARGIN = 24              // keep features that overhang the viewBox a little

const toSvg = ([x, y]) => [500 + x * SCALE, 350 + y * SCALE]
const r1 = (n) => Math.round(n * 10) / 10

function bbox(points) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  return { x0, y0, x1, y1 }
}
const inView = (points) => {
  const b = bbox(points)
  return b.x1 >= -MARGIN && b.x0 <= VIEW.w + MARGIN && b.y1 >= -MARGIN && b.y0 <= VIEW.h + MARGIN
}

// Douglas-Peucker on an open polyline.
function simplify(points, tol) {
  if (points.length <= 2) return points
  const sq = tol * tol
  const keep = new Array(points.length).fill(false)
  keep[0] = keep[points.length - 1] = true
  const stack = [[0, points.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [ax, ay] = points[a], [bx, by] = points[b]
    const dx = bx - ax, dy = by - ay
    const len2 = dx * dx + dy * dy || 1
    let best = -1, bestD = sq
    for (let i = a + 1; i < b; i += 1) {
      const [px, py] = points[i]
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
      const ex = ax + t * dx - px, ey = ay + t * dy - py
      const d = ex * ex + ey * ey
      if (d > bestD) { bestD = d; best = i }
    }
    if (best >= 0) { keep[best] = true; stack.push([a, best], [best, b]) }
  }
  return points.filter((_, i) => keep[i])
}

function simplifyRing(ring, tol) {
  // Ring is closed (first == last). Simplify as open, then re-close.
  const open = ring.slice(0, -1)
  if (open.length <= 4) return ring
  const s = simplify([...open, open[0]], tol)
  return s.length >= 4 ? s : ring
}

const pathFromRings = (rings) => rings
  .map((ring) => ring.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`).join('') + 'Z')
  .join('')
const pathFromLine = (pts) => pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${r1(x)} ${r1(y)}`).join('')

const out = {
  parcel: '', campusBuildings: '', portables: '', neighbourhood: '', field: '', fieldLines: '',
  campusParking: '', parking: '', roads: { major: '', minor: '', service: '', foot: '' },
}
const ROAD_CLASS = {
  primary: 'major', secondary: 'major', tertiary: 'major',
  residential: 'minor', unclassified: 'minor', living_street: 'minor',
  service: 'service',
}
const tolSvg = TOLERANCE_M * SCALE
const counts = {}
const bump = (k) => { counts[k] = (counts[k] ?? 0) + 1 }

for (const f of geo.features) {
  const { kind, on_campus, highway, name } = f.properties
  const g = f.geometry
  if (g.type === 'LineString') {
    const pts = g.coordinates.map(toSvg)
    if (!inView(pts)) continue
    const cls = ROAD_CLASS[highway] ?? 'foot'
    out.roads[cls] += pathFromLine(simplify(pts, tolSvg * 0.4))
    bump(`road:${cls}`)
    continue
  }
  if (g.type !== 'Polygon') continue
  const rings = g.coordinates.map((ring) => ring.map(toSvg))
  if (!inView(rings[0])) continue
  if (kind === 'campus') { out.parcel = pathFromRings(rings); bump('parcel'); continue }
  if (kind === 'pitch') {
    out.field = pathFromRings(rings)
    const c = rings[0].slice(0, -1)
    if (c.length === 4) {
      // Longest edge is the sideline; yard lines every 10 yd across a 120 yd field (11 lines incl. goal lines).
      const e01 = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1])
      const e12 = Math.hypot(c[2][0] - c[1][0], c[2][1] - c[1][1])
      const [p, q, s] = e01 >= e12 ? [c[0], c[1], c[3]] : [c[1], c[2], c[0]]
      const u = [q[0] - p[0], q[1] - p[1]]
      const v = [s[0] - p[0], s[1] - p[1]]
      const lines = []
      for (let k = 1; k <= 11; k += 1) {
        const t = k / 12
        const ax = p[0] + u[0] * t, ay = p[1] + u[1] * t
        lines.push(pathFromLine([[ax, ay], [ax + v[0], ay + v[1]]]))
      }
      out.fieldLines = lines.join('')
    }
    bump('pitch')
    continue
  }
  if (kind === 'parking') {
    if (on_campus) out.campusParking += pathFromRings(rings)
    else out.parking += pathFromRings(rings.map((r) => simplifyRing(r, tolSvg)))
    bump(on_campus ? 'parking:campus' : 'parking')
    continue
  }
  if (kind === 'building') {
    if (on_campus) {
      if (/portable/i.test(name ?? '')) out.portables += pathFromRings(rings)
      else out.campusBuildings += pathFromRings(rings)
      bump('building:campus')
    } else {
      out.neighbourhood += pathFromRings(rings.map((r) => simplifyRing(r, tolSvg)))
      bump('building:neighbourhood')
    }
  }
}

// ---- TypeScript module ------------------------------------------------------
const ts = `// GENERATED by frontend/scripts/build-campus-map.mjs from shared/campus.geojson. Do not edit.
// OpenStreetMap data (ODbL). Attribution is rendered by CampusGround.
// viewBox 0 0 1000 700; sx = 500 + x * 2.5, sy = 350 + y * 2.5 (MAP_DATA.md).
export const CAMPUS_PATHS = ${JSON.stringify(out, null, 2)} as const
`
writeFileSync(resolve(here, '../src/components/map/campusPaths.ts'), ts)

// ---- Static SVG for Devpost ---------------------------------------------------
const site = topology.sites.find((s) => s.kind === 'campus')
const nodeById = new Map(site.nodes.map((n) => [n.id, n]))
const links = []
const seen = new Set()
for (const n of site.nodes) for (const m of n.neighbours) {
  const key = [n.id, m].sort().join('|')
  if (seen.has(key)) continue
  seen.add(key); links.push([n.id, m])
}
const OK = '#6DB87A'
const roads = (d, w, a) => `<path d="${d}" stroke="rgba(255,255,255,${a})" stroke-width="${w}"/>`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" width="1000" height="700" font-family="'IBM Plex Sans', system-ui, sans-serif">
  <rect width="1000" height="700" fill="#0B0A09"/>
  <g fill="rgba(255,255,255,0.028)" fill-rule="evenodd">
    <path d="${out.neighbourhood}"/>
  </g>
  <path d="${out.parking}" fill="rgba(255,255,255,0.018)" fill-rule="evenodd"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${roads(out.roads.foot, 1, 0.03)}
    ${roads(out.roads.service, 2, 0.05)}
    ${roads(out.roads.minor, 4, 0.06)}
    ${roads(out.roads.major, 7, 0.07)}
  </g>
  <path d="${out.parcel}" fill="rgba(255,255,255,0.012)" stroke="rgba(255,255,255,0.10)" stroke-width="1" stroke-linejoin="round"/>
  <path d="${out.campusParking}" fill="rgba(255,255,255,0.035)" fill-rule="evenodd"/>
  <path d="${out.field}" fill="rgba(118,140,120,0.16)" stroke="rgba(160,178,160,0.22)" stroke-width="1"/>
  <path d="${out.fieldLines}" fill="none" stroke="rgba(160,178,160,0.10)" stroke-width="1"/>
  <path d="${out.portables}" fill="#1A1816" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
  <path d="${out.campusBuildings}" fill="#1C1917" stroke="rgba(255,255,255,0.11)" stroke-width="1" stroke-linejoin="round"/>
  <g stroke="#7F9FA0" stroke-opacity="0.22" stroke-width="1">
    ${links.map(([a, b]) => { const na = nodeById.get(a), nb = nodeById.get(b); return `<line x1="${na.map_x}" y1="${na.map_y}" x2="${nb.map_x}" y2="${nb.map_y}"/>` }).join('\n    ')}
  </g>
  <g fill="${OK}" stroke="rgba(11,10,9,0.7)" stroke-width="1">
    ${site.nodes.map((n) => n.is_gateway
      ? `<rect x="${n.map_x - 6}" y="${n.map_y - 6}" width="12" height="12" rx="2"/>`
      : `<circle cx="${n.map_x}" cy="${n.map_y}" r="6"/>`).join('\n    ')}
  </g>
  ${site.nodes.filter((n) => n.is_gateway).map((n) => `<text x="${n.map_x}" y="${n.map_y + 22}" font-size="12" text-anchor="middle" fill="#A29C93">${n.label}</text>`).join('\n  ')}
  <text x="990" y="691" font-size="10" text-anchor="end" fill="#EDE8E0" fill-opacity="0.35">Map data © OpenStreetMap contributors</text>
</svg>
`
writeFileSync(resolve(here, '../public/maps/campus.svg'), svg)
console.log(counts, `ts ${ts.length} B, svg ${svg.length} B`)
