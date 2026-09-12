import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Sx1262(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.pcbModule}><boxGeometry args={[1.2, 0.12, 1.6]} /></mesh>
      <mesh position={[0, 0.18, 0.1]} material={M.steelCan}><boxGeometry args={[1.05, 0.24, 1.15]} /></mesh>
      <mesh position={[0.4, 0.2, -0.65]} material={M.brass}><cylinderGeometry args={[0.1, 0.1, 0.15, 12]} /></mesh>
      <PartHit {...props} size={[1.4, 0.45, 1.8]} center={[0, 0.12, 0]} />
    </group>
  )
}
