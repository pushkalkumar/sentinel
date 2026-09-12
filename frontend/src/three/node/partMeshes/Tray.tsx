import { Edges } from '@react-three/drei'
import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

const WALL_EDGE = '#4a4e56'
const VENTS = Array.from({ length: 8 }, (_, i) => 2.6 + i * 0.5)

export function Tray(props: PartMeshProps) {
  return (
    <group>
      <mesh position={[0, 0.15, 0]} material={M.enclosure}><boxGeometry args={[14, 0.3, 9]} /></mesh>
      {[4.4, -4.4].map((z) => (
        <mesh key={z} position={[0, 2.15, z]} material={M.enclosure}>
          <boxGeometry args={[14, 3.7, 0.2]} /><Edges threshold={20} color={WALL_EDGE} />
        </mesh>
      ))}
      {[6.9, -6.9].map((x) => (
        <mesh key={x} position={[x, 2.15, 0]} material={M.enclosure}>
          <boxGeometry args={[0.2, 3.7, 8.6]} /><Edges threshold={20} color={WALL_EDGE} />
        </mesh>
      ))}
      <mesh position={[2.0, 2.31, 0]} material={M.enclosure}><boxGeometry args={[0.2, 3.3, 8.0]} /></mesh>
      {VENTS.map((x) => (
        <mesh key={x} position={[x, 1.9, 4.53]} material={M.vent}><boxGeometry args={[0.14, 1.2, 0.06]} /></mesh>
      ))}
      {[5.5, -5.5].map((x) => (
        <group key={x} position={[x, 0.15, -4.9]}>
          <mesh material={M.enclosure}><boxGeometry args={[1.2, 0.3, 0.8]} /></mesh>
          <mesh material={M.vent}><cylinderGeometry args={[0.18, 0.18, 0.32, 16]} /></mesh>
        </group>
      ))}
      <PartHit {...props} size={[14.2, 4.2, 9.2]} center={[0, 2.0, 0]} />
    </group>
  )
}
