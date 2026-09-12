import { MATERIALS as M } from '../materials'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

/** WS2812 on an 8 mm carrier under a short frosted cap; the light pipe itself hangs from the lid dome. Origin at the underside. */
export function Led(props: PartMeshProps) {
  return (
    <group>
      <Rbox size={[8, 1, 8]} at={[0, 0.5, 0]} r={0.4} mat={M.module} />
      <Rbox size={[5, 1.6, 5]} at={[0, 1.8, 0]} r={0.3} mat={M.ledDie} />
      <Cyl r={2.4} h={3} at={[0, 2.6 + 1.5, 0]} mat={M.frosted} segments={32} />
      <PartHit {...props} size={[9, 7, 9]} center={[0, 3, 0]} />
    </group>
  )
}
