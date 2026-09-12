import { MATERIALS as M } from '../materials'
import { Cyl } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

/** Bakelite base, stainless mesh can. Origin at the underside. */
export function Mq2(props: PartMeshProps) {
  return (
    <group>
      <Cyl r={9} h={5.5} at={[0, 2.75, 0]} mat={M.plastic} segments={40} />
      <Cyl r={9.3} h={1} at={[0, 5.5, 0]} mat={M.aluminium} segments={40} />
      <Cyl r={8.6} h={11} at={[0, 6 + 5.5, 0]} mat={M.steelMesh} segments={40} />
      <PartHit {...props} size={[20, 18, 20]} center={[0, 8.5, 0]} />
    </group>
  )
}
