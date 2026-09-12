import { MATERIALS as M } from '../materials'
import { mm } from '../parts'
import { Cyl } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

/** Sealed 16 mm dome on the front wall. Local z = 0 is the wall's outer face; the switch body sits behind it. */
export function Button(props: PartMeshProps) {
  return (
    <group>
      <Cyl r={9.6} h={0.8} at={[0, 0, 0.4]} axis="z" mat={M.aluminium} segments={40} />
      <Cyl r={8.6} h={1.6} at={[0, 0, 1.2]} axis="z" mat={M.plastic} segments={40} />
      <mesh position={[0, 0, mm(2)]} scale={[1, 1, 0.42]} material={M.buttonCap} castShadow>
        <sphereGeometry args={[mm(7.2), 40, 20]} />
      </mesh>
      <Cyl r={5} h={12} at={[0, 0, -6]} axis="z" mat={M.plastic} segments={24} />
      <PartHit {...props} size={[20, 20, 8]} center={[0, 0, 2]} />
    </group>
  )
}
