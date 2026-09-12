// Millimetre-space primitives so part files read like a drawing. Every box is chamfered (DESIGN_V2 §5).
import type { ReactNode } from 'react'
import { RoundedBox } from '@react-three/drei'
import type * as THREE from 'three'
import { mm, type Vec3 } from '../parts'

type Mat = THREE.Material | THREE.Material[]

interface BoxProps {
  size: Vec3
  at?: Vec3
  /** Corner radius in mm. */
  r?: number
  mat: THREE.Material
  children?: ReactNode
}

const O: Vec3 = [0, 0, 0]

export function Rbox({ size, at = O, r = 0.6, mat, children }: BoxProps) {
  const rad = Math.min(mm(r), mm(Math.min(size[0], size[1], size[2]) / 2) - 1e-4)
  return (
    <RoundedBox args={[mm(size[0]), mm(size[1]), mm(size[2])]} radius={rad} smoothness={6} material={mat} position={[mm(at[0]), mm(at[1]), mm(at[2])]} castShadow receiveShadow>
      {children}
    </RoundedBox>
  )
}

/** Plain box for thin plates that need per-face materials (a textured top with bare sides). */
export function PlateBox({ size, at = O, mat }: { size: Vec3; at?: Vec3; mat: Mat }) {
  return (
    <mesh position={[mm(at[0]), mm(at[1]), mm(at[2])]} material={mat} castShadow receiveShadow>
      <boxGeometry args={[mm(size[0]), mm(size[1]), mm(size[2])]} />
    </mesh>
  )
}

interface CylProps {
  r: number
  h: number
  at?: Vec3
  /** Axis the cylinder runs along; default y (upright). */
  axis?: 'x' | 'y' | 'z'
  segments?: number
  rTop?: number
  mat: Mat
  open?: boolean
}

const AXIS_ROT: Record<'x' | 'y' | 'z', [number, number, number]> = { x: [0, 0, -Math.PI / 2], y: [0, 0, 0], z: [Math.PI / 2, 0, 0] }

export function Cyl({ r, h, at = O, axis = 'y', segments = 40, rTop, mat, open = false }: CylProps) {
  return (
    <mesh position={[mm(at[0]), mm(at[1]), mm(at[2])]} rotation={AXIS_ROT[axis]} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[mm(rTop ?? r), mm(r), mm(h), segments, 1, open]} />
    </mesh>
  )
}
