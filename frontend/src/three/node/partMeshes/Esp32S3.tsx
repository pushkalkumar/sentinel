import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Esp32S3(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.pcbModule}><boxGeometry args={[1.8, 0.12, 2.55]} /></mesh>
      <mesh position={[0, 0.2, 0.25]} material={M.steelCan}><boxGeometry args={[1.6, 0.28, 1.75]} /></mesh>
      <mesh position={[0, 0.005, -0.95]} material={M.pad}><boxGeometry args={[1.8, 0.13, 0.62]} /></mesh>
      <PartHit {...props} size={[2.0, 0.5, 2.8]} center={[0, 0.15, 0]} />
    </group>
  )
}
