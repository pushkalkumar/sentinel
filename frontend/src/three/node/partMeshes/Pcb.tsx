import { Edges } from '@react-three/drei'
import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

const PADS: [number, number][] = [[-3.0, -2.3], [-3.0, 1.2], [-0.6, -2.6], [2.6, 3.3], [-0.6, 0.2], [-0.6, 3.9]]
const HOLES: [number, number][] = [[6.2, 3.7], [-6.2, 3.7], [6.2, -3.7], [-6.2, -3.7]]

export function Pcb(props: PartMeshProps) {
  return (
    <group>
      <mesh material={M.pcb}><boxGeometry args={[13, 0.16, 8]} /><Edges threshold={40} color="#1f3d2c" /></mesh>
      {PADS.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.085, z]} material={M.pad}><boxGeometry args={[0.9, 0.01, 0.9]} /></mesh>
      ))}
      {HOLES.map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0, z]} material={M.vent}><cylinderGeometry args={[0.16, 0.16, 0.2, 12]} /></mesh>
      ))}
      <PartHit {...props} size={[13.2, 0.3, 8.2]} />
    </group>
  )
}
