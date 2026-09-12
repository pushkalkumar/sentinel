import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

const LEGS = Array.from({ length: 6 }, (_, i) => (i * Math.PI * 2) / 6)

export function Mq2(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.steelMesh}><cylinderGeometry args={[1.0, 1.0, 1.6, 32]} /></mesh>
      <mesh position={[0, -0.7, 0]} material={M.plasticBlack}><cylinderGeometry args={[1.05, 1.05, 0.25, 32]} /></mesh>
      {LEGS.map((a) => (
        <mesh key={a} position={[0.6 * Math.cos(a), -0.95, 0.6 * Math.sin(a)]} material={M.steel}>
          <cylinderGeometry args={[0.04, 0.04, 0.35, 6]} />
        </mesh>
      ))}
      <PartHit {...props} size={[2.2, 2.0, 2.2]} center={[0, -0.1, 0]} />
    </group>
  )
}
