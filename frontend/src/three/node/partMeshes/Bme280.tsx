import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Bme280(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.pcbModule}><boxGeometry args={[1.0, 0.14, 1.0]} /></mesh>
      <mesh position={[0.1, 0.115, 0.1]} material={M.steelCan}><boxGeometry args={[0.25, 0.09, 0.25]} /></mesh>
      <mesh position={[0, 0.17, -0.4]} material={M.plasticBlack}><boxGeometry args={[0.9, 0.2, 0.2]} /></mesh>
      <PartHit {...props} size={[1.2, 0.5, 1.2]} center={[0, 0.1, 0]} />
    </group>
  )
}
