import { MATERIALS as M } from '../materials'
import { mm } from '../parts'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const R = 9
const LEN = 65
const AXIS_Y = 2 + R

/** Shrink-wrapped cell in a moulded holder with spring contacts at both ends. Cell runs along x, positive end at +x. */
export function Cell18650(props: PartMeshProps) {
  return (
    <group>
      <Rbox size={[LEN + 8, 2, 22]} at={[0, 1, 0]} r={1} mat={M.plastic} />
      {[-1, 1].map((s) => (
        <group key={s} position={[mm(s * (LEN / 2 + 2.5)), 0, 0]}>
          <Rbox size={[3, 19, 22]} at={[0, 9.5, 0]} r={1} mat={M.plastic} />
          <Rbox size={[0.6, 9, 6]} at={[-s * 1.8, AXIS_Y, 0]} r={0.25} mat={M.aluminium} />
        </group>
      ))}
      <Cyl r={R} h={LEN - 1.5} at={[0, AXIS_Y, 0]} axis="x" mat={M.cellWrap} segments={48} />
      <Cyl r={8.4} h={0.4} at={[-(LEN / 2 - 0.55), AXIS_Y, 0]} axis="x" mat={M.aluminium} segments={40} />
      <Cyl r={3.2} h={1.6} at={[LEN / 2 - 0.2, AXIS_Y, 0]} axis="x" mat={M.aluminium} segments={24} />
      <PartHit {...props} size={[LEN + 10, 22, 24]} center={[0, 10, 0]} />
    </group>
  )
}
