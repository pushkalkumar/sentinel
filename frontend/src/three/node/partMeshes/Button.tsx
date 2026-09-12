import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

/** Local z = 0 is the outer face of the front wall; the cap sits on it, the switch body goes into the wall. */
const FACE = [Math.PI / 2, 0, 0] as const

export function Button(props: PartMeshProps) {
  return (
    <group>
      <mesh rotation={FACE} position={[0, 0, 0.05]} material={M.plasticBlack}><cylinderGeometry args={[0.82, 0.82, 0.1, 32]} /></mesh>
      <mesh rotation={FACE} position={[0, 0, 0.16]} material={M.accent}><cylinderGeometry args={[0.66, 0.7, 0.14, 32]} /></mesh>
      <mesh position={[0, 0, 0.22]} scale={[1, 1, 0.22]} material={M.accent}><sphereGeometry args={[0.64, 32, 12]} /></mesh>
      <mesh rotation={FACE} position={[0, 0, -0.25]} material={M.plasticBlack}><cylinderGeometry args={[0.3, 0.3, 0.5, 16]} /></mesh>
      <PartHit {...props} size={[1.8, 1.8, 0.8]} center={[0, 0, 0.1]} />
    </group>
  )
}
