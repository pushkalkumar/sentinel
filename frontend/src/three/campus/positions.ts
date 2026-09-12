// Node world positions: topology map_x/map_y (SVG 1000×700) → metres → world, with roof height from the footprints.
import type { Node, NodeId } from '@/lib/types'
import { METRES_PER_UNIT, roofHeightAt, type XZ } from './geo'

const SVG_CX = 500
const SVG_CY = 350
const SVG_PER_METRE = 2.5
/** Discs and link ends float this far above the roof or the ground. */
export const LIFT = 0.06

export interface NodeAnchor { id: NodeId; x: number; y: number; z: number; onRoof: boolean }

export const svgToWorld = (mapX: number, mapY: number): XZ => [
  (mapX - SVG_CX) / SVG_PER_METRE / METRES_PER_UNIT,
  (mapY - SVG_CY) / SVG_PER_METRE / METRES_PER_UNIT,
]

export function anchorFor(n: Pick<Node, 'id' | 'map_x' | 'map_y'>): NodeAnchor {
  const [x, z] = svgToWorld(n.map_x, n.map_y)
  const roof = roofHeightAt([x, z])
  return { id: n.id, x, y: roof + LIFT, z, onRoof: roof > 0 }
}

export function anchorMap(nodes: readonly Pick<Node, 'id' | 'map_x' | 'map_y'>[]): Map<NodeId, NodeAnchor> {
  return new Map(nodes.map((n) => [n.id, anchorFor(n)]))
}
