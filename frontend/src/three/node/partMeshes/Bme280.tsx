import { MATERIALS as M } from '../materials'
import { mm } from '../parts'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const PINS = [-3.8, -1.3, 1.3, 3.8]

/** 10 × 12 breakout with the 2.5 mm LGA sensor and a four-pin header. Origin at the underside. */
export function Bme280(props: PartMeshProps) {
  return (
    <group>
      <Rbox size={[10, 1, 12]} at={[0, 0.5, 0]} r={0.4} mat={M.module} />
      <Rbox size={[2.5, 0.9, 2.5]} at={[1, 1.45, 1.5]} r={0.2} mat={M.aluminium} />
      <Rbox size={[1.6, 0.6, 3]} at={[-2.5, 1.3, 1.5]} r={0.15} mat={M.plastic} />
      <group position={[0, mm(1), mm(-4.3)]}>
        <Rbox size={[10, 2.5, 2.5]} at={[0, 1.25, 0]} r={0.3} mat={M.nylon} />
        {PINS.map((x) => <Cyl key={x} r={0.3} h={2.5} at={[x, 3.6, 0]} mat={M.aluminium} segments={6} />)}
      </group>
      <PartHit {...props} size={[11, 6, 13]} center={[0, 2.5, 0]} />
    </group>
  )
}
