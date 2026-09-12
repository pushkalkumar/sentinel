import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Buzzer(props: PartMeshProps) {
  return (
    <group>
      <mesh position={[0, 0.225, 0]} material={M.plasticBlack}><cylinderGeometry args={[0.6, 0.6, 0.45, 24]} /></mesh>
      <mesh position={[0, 0.47, 0]} material={M.vent}><cylinderGeometry args={[0.12, 0.12, 0.05, 12]} /></mesh>
      <PartHit {...props} size={[1.4, 0.7, 1.4]} center={[0, 0.25, 0]} />
    </group>
  )
}
