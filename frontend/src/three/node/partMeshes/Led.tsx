import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Led(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.ledEmissive}><boxGeometry args={[0.5, 0.16, 0.5]} /></mesh>
      <mesh position={[0, 1.68, 0]} material={M.ledPipe}><cylinderGeometry args={[0.28, 0.28, 3.2, 20]} /></mesh>
      <PartHit {...props} size={[0.8, 3.5, 0.8]} center={[0, 1.6, 0]} />
    </group>
  )
}
