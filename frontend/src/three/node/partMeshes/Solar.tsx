import { MATERIALS as M } from '../materials'
import { PlateBox, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const W = 120
const D = 70
const T = 3
const FRAME = 2.4
const GLASS = [M.aluminium, M.aluminium, M.solar, M.aluminium, M.aluminium, M.aluminium]

/** Glass laminate in a thin aluminium frame. Local origin at the underside. */
export function Solar(props: PartMeshProps) {
  return (
    <group>
      <PlateBox size={[W - 1, T - 0.6, D - 1]} at={[0, T / 2, 0]} mat={GLASS} />
      <Rbox size={[W, T, FRAME]} at={[0, T / 2, D / 2 - FRAME / 2]} r={0.7} mat={M.aluminium} />
      <Rbox size={[W, T, FRAME]} at={[0, T / 2, -D / 2 + FRAME / 2]} r={0.7} mat={M.aluminium} />
      <Rbox size={[FRAME, T, D]} at={[W / 2 - FRAME / 2, T / 2, 0]} r={0.7} mat={M.aluminium} />
      <Rbox size={[FRAME, T, D]} at={[-W / 2 + FRAME / 2, T / 2, 0]} r={0.7} mat={M.aluminium} />
      <PartHit {...props} size={[W + 2, T + 2, D + 2]} center={[0, T / 2, 0]} />
    </group>
  )
}
