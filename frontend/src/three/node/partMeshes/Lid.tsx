import { Edges, RoundedBox } from '@react-three/drei'
import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

/** Lid box is 1.0 tall centred on 0, so its top face is at +0.5; the LED dome and screws sit on that plane. */
const TOP = 0.5
const LED_XZ: [number, number] = [-0.6, 3.9]

export function Lid(props: PartMeshProps) {
  return (
    <group>
      <RoundedBox args={[14.2, 1.0, 9.2]} radius={0.32} smoothness={6} material={M.lid}>
        <Edges threshold={30} color="#6a6e76" />
      </RoundedBox>
      <mesh position={[0, -0.56, 0]} material={M.vent}><boxGeometry args={[13.4, 0.12, 8.4]} /></mesh>
      <group position={[LED_XZ[0], TOP, LED_XZ[1]]}>
        <mesh material={M.plasticBlack}><cylinderGeometry args={[0.46, 0.46, 0.08, 24]} /></mesh>
        <mesh position={[0, 0.02, 0]} material={M.ledDome}><sphereGeometry args={[0.34, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /></mesh>
      </group>
      {[[6.6, 4.1], [-6.6, 4.1], [6.6, -4.1], [-6.6, -4.1]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, TOP + 0.02, z]} material={M.steel}><cylinderGeometry args={[0.16, 0.16, 0.05, 16]} /></mesh>
      ))}
      <PartHit {...props} size={[14.4, 1.2, 9.4]} />
    </group>
  )
}
