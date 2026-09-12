import { MATERIALS as M } from '../materials'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

/** Charger, protection and boost on a 22 × 28 daughterboard; USB-C faces the back wall. Origin at the underside. */
export function Power(props: PartMeshProps) {
  return (
    <group>
      <Rbox size={[22, 1, 28]} at={[0, 0.5, 0]} r={0.4} mat={M.module} />
      <Rbox size={[9, 3.2, 7.4]} at={[0, 1 + 1.6, -10.4]} r={1.4} mat={M.aluminium} />
      <Rbox size={[5, 1.2, 4]} at={[-5, 1.6, -1]} r={0.2} mat={M.plastic} />
      <Rbox size={[3, 1.1, 3]} at={[5.5, 1.55, -2]} r={0.2} mat={M.plastic} />
      <Cyl r={3.2} h={3.2} at={[4, 1 + 1.6, 6]} mat={M.plastic} segments={32} />
      <Rbox size={[2.8, 1, 1.6]} at={[-5, 1.5, 7]} r={0.15} mat={M.plastic} />
      <Rbox size={[2.8, 1, 1.6]} at={[-5, 1.5, 10]} r={0.15} mat={M.plastic} />
      <Cyl r={2} h={5} at={[-3, 1 + 2.5, 3.5]} mat={M.plastic} segments={24} />
      <PartHit {...props} size={[23, 8, 29]} center={[0, 3.5, 0]} />
    </group>
  )
}
