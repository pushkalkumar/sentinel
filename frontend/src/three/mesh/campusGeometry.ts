// Site 1 nodes from shared/topology.json mapped to world units (BUILD_PLAN §2.10): x=(map_x-500)/50, z=(map_y-350)/50.
import topology from '@shared/topology.json'
import type { NodeId } from '@/lib/types'

interface TopoNode { id: string; label: string; map_x: number; map_y: number; indoor: boolean; is_gateway: boolean; neighbours: string[] }
interface TopoZone { name: string; map_poly: number[][] }
interface TopoSite { id: number; nodes: TopoNode[]; zones: TopoZone[] }

export interface CampusNode { id: NodeId; label: string; x: number; z: number; indoor: boolean; gateway: boolean }
export type XZ = readonly [number, number]

const SITE_ID = 1
const CX = 500
const CZ = 350
const SCALE = 50
/** Building footprint drawn around each indoor node (world units). */
const BUILDING_W = 2.4
const BUILDING_D = 1.8

const site = (topology as unknown as { sites: TopoSite[] }).sites.find((s) => s.id === SITE_ID)
if (!site) throw new Error('topology.json has no site 1')

export const toWorld = (mapX: number, mapY: number): XZ => [(mapX - CX) / SCALE, (mapY - CZ) / SCALE]

export const CAMPUS_NODES: readonly CampusNode[] = site.nodes.map((n) => {
  const [x, z] = toWorld(n.map_x, n.map_y)
  return { id: n.id, label: n.label, x, z, indoor: n.indoor, gateway: n.is_gateway }
})

export const NODE_POS: Record<NodeId, XZ> = Object.fromEntries(CAMPUS_NODES.map((n) => [n.id, [n.x, n.z] as XZ]))

/** Undirected, de-duplicated neighbour pairs. */
export const CAMPUS_LINKS: readonly [NodeId, NodeId][] = (() => {
  const seen = new Set<string>()
  const out: [NodeId, NodeId][] = []
  for (const n of site.nodes) {
    for (const m of n.neighbours) {
      if (!(m in NODE_POS)) continue
      const key = [n.id, m].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push([n.id, m])
    }
  }
  return out
})()

export const linkKey = (a: NodeId, b: NodeId) => [a, b].sort().join('|')

/** Campus boundary: the union of zone polygons' bounding box. */
export const BOUNDARY: readonly XZ[] = (() => {
  const pts = site.zones.flatMap((z) => z.map_poly)
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const [minX, maxX] = [Math.min(...xs), Math.max(...xs)]
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)]
  return [toWorld(minX, minY), toWorld(maxX, minY), toWorld(maxX, maxY), toWorld(minX, maxY)]
})()

/** Zone divider lines, drawn as dashed paths. */
export const PATHS: readonly (readonly XZ[])[] = site.zones.map((z) => z.map_poly.map((p) => toWorld(p[0], p[1])))

/** Rectangles around indoor nodes so the outline reads as a map, not a wireframe. */
export const BUILDINGS: readonly { id: NodeId; center: XZ; size: XZ }[] = CAMPUS_NODES
  .filter((n) => n.indoor)
  .map((n) => ({ id: n.id, center: [n.x, n.z] as XZ, size: [BUILDING_W, BUILDING_D] as XZ }))
