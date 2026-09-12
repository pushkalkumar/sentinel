import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

const SPOKES = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 8)

export function Pms5003(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.steelCan}><boxGeometry args={[3.8, 2.1, 5.0]} /></mesh>
      <group position={[0, 0.2, 2.52]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={M.vent}><cylinderGeometry args={[0.95, 0.95, 0.03, 32]} /></mesh>
        {SPOKES.map((a) => (
          <mesh key={a} rotation={[0, 0, a]} position={[0, 0, 0.02]} material={M.steelCan}><boxGeometry args={[0.08, 1.6, 0.03]} /></mesh>
        ))}
      </group>
      <mesh position={[0, -0.4, -2.52]} material={M.vent}><boxGeometry args={[2.6, 0.5, 0.03]} /></mesh>
      <mesh position={[-1.4, -0.9, 2.3]} material={M.plasticWhite}><boxGeometry args={[0.9, 0.3, 0.35]} /></mesh>
      <PartHit {...props} size={[4.0, 2.3, 5.3]} />
    </group>
  )
}
