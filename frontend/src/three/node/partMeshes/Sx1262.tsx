import { MATERIALS as M } from '../materials'
import { mm } from '../parts'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

/** 24 × 14 module: shielded can on the left, SMA jack on the right that the helical antenna screws on to. */
export function Sx1262(props: PartMeshProps) {
  return (
    <group>
      <Rbox size={[24, 1, 14]} at={[0, 0.5, 0]} r={0.4} mat={M.module} />
      <Rbox size={[12, 2.6, 12]} at={[-4.5, 1 + 1.3, 0]} r={0.5} mat={M.aluminium} />
      <group position={[mm(8), mm(1), 0]}>
        <Cyl r={4} h={1.6} at={[0, 0.8, 0]} mat={M.aluminium} segments={6} />
        <Cyl r={3.1} h={4.9} at={[0, 1.6 + 2.45, 0]} mat={M.aluminium} segments={32} />
        <Cyl r={0.6} h={1} at={[0, 6.9, 0]} mat={M.copper} segments={12} />
      </group>
      <PartHit {...props} size={[25, 8, 15]} center={[0, 3, 0]} />
    </group>
  )
}
