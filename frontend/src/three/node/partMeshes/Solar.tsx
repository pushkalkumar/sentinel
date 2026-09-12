import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Solar(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.solarGlass}><boxGeometry args={[12, 0.12, 7]} /></mesh>
      <mesh position={[0, 0.03, 3.5]} material={M.brushed}><boxGeometry args={[12.5, 0.18, 0.25]} /></mesh>
      <mesh position={[0, 0.03, -3.5]} material={M.brushed}><boxGeometry args={[12.5, 0.18, 0.25]} /></mesh>
      <mesh position={[6.125, 0.03, 0]} material={M.brushed}><boxGeometry args={[0.25, 0.18, 7]} /></mesh>
      <mesh position={[-6.125, 0.03, 0]} material={M.brushed}><boxGeometry args={[0.25, 0.18, 7]} /></mesh>
      <PartHit {...props} size={[12.6, 0.4, 7.4]} />
    </group>
  )
}
