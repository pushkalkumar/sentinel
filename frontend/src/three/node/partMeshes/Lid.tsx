import { Edges, RoundedBox } from '@react-three/drei'
import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

export function Lid(props: PartMeshProps) {
  return (
    <group>
      <RoundedBox args={[14.2, 1.0, 9.2]} radius={0.32} smoothness={6} material={M.enclosure}>
        <Edges threshold={30} color="#5a5e66" />
      </RoundedBox>
      <mesh position={[0, -0.56, 0]} material={M.vent}><boxGeometry args={[13.4, 0.12, 8.4]} /></mesh>
      <mesh position={[-0.6, 0.5, 3.9]} material={M.frost}><sphereGeometry args={[0.36, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      {[[6.6, 4.1], [-6.6, 4.1], [6.6, -4.1], [-6.6, -4.1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.52, z]} material={M.steel}><cylinderGeometry args={[0.16, 0.16, 0.05, 16]} /></mesh>
      ))}
      <PartHit {...props} size={[14.4, 1.2, 9.4]} />
    </group>
  )
}
