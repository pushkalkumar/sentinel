import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Power(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.pcbBlue}><boxGeometry args={[1.6, 0.16, 2.6]} /></mesh>
      <mesh position={[0.3, 0.14, 0.6]} material={M.plasticBlack}><boxGeometry args={[0.5, 0.12, 0.6]} /></mesh>
      <mesh position={[-0.35, 0.28, 0.2]} material={M.plasticBlack}><cylinderGeometry args={[0.35, 0.35, 0.4, 20]} /></mesh>
      <mesh position={[0.4, 0.33, -0.3]} material={M.plasticBlack}><cylinderGeometry args={[0.22, 0.22, 0.5, 16]} /></mesh>
      <mesh position={[0.4, 0.33, -0.85]} material={M.plasticBlack}><cylinderGeometry args={[0.22, 0.22, 0.5, 16]} /></mesh>
      <mesh position={[0, 0.24, -1.55]} material={M.steel}><boxGeometry args={[0.9, 0.32, 0.7]} /></mesh>
      <mesh position={[-0.4, 0.13, -0.8]} material={M.plasticBlack}><boxGeometry args={[0.3, 0.1, 0.3]} /></mesh>
      <PartHit {...props} size={[1.8, 0.8, 3.4]} center={[0, 0.2, -0.1]} />
    </group>
  )
}
