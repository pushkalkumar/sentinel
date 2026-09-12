import { MATERIALS as M } from '../materials'
import { Cyl } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

/** 12 mm piezo puck with a sound hole. Origin at the underside. */
export function Buzzer(props: PartMeshProps) {
  return (
    <group>
      <Cyl r={6} h={6.5} at={[0, 3.25, 0]} mat={M.plastic} segments={40} />
      <Cyl r={5.6} h={0.5} at={[0, 6.6, 0]} rTop={5.2} mat={M.plastic} segments={40} />
      <Cyl r={1.2} h={0.6} at={[0, 6.8, 0]} mat={M.cavity} segments={16} />
      <PartHit {...props} size={[13, 8, 13]} center={[0, 3.5, 0]} />
    </group>
  )
}
