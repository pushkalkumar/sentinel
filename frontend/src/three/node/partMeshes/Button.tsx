import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Button(props: PartMeshProps) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.2]} material={M.accent}><cylinderGeometry args={[0.7, 0.7, 0.4, 32]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.02]} material={M.plasticBlack}><torusGeometry args={[0.78, 0.09, 10, 32]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.25]} material={M.plasticBlack}><cylinderGeometry args={[0.3, 0.3, 0.5, 16]} /></mesh>
      <PartHit {...props} size={[1.8, 1.8, 1.0]} center={[0, 0, 0.1]} />
    </group>
  )
}
