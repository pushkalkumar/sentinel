import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Cell18650(props: PartMeshProps) {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={M.cellWrap}><cylinderGeometry args={[0.9, 0.9, 6.5, 32]} /></mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 3.31]} material={M.steel}><cylinderGeometry args={[0.35, 0.35, 0.12, 16]} /></mesh>
      {[3.55, -3.55].map((z) => (
        <group key={z} position={[0, -0.1, z]}>
          <mesh material={M.plasticBlack}><boxGeometry args={[2.0, 1.7, 0.4]} /></mesh>
          <mesh position={[0, 0.1, z > 0 ? -0.22 : 0.22]} material={M.steel}><boxGeometry args={[0.5, 0.9, 0.05]} /></mesh>
        </group>
      ))}
      <PartHit {...props} size={[2.2, 2.0, 7.6]} />
    </group>
  )
}
