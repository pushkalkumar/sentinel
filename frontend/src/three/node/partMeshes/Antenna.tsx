import { useMemo } from 'react'
import * as THREE from 'three'
import { MATERIALS as M } from '../materials'
import { PartHit, type PartMeshProps } from './PartHit'

class Helix extends THREE.Curve<THREE.Vector3> {
  r: number
  h: number
  turns: number
  constructor(r: number, h: number, turns: number) {
    super()
    this.r = r
    this.h = h
    this.turns = turns
  }
  override getPoint(t: number, target = new THREE.Vector3()) {
    const a = 2 * Math.PI * this.turns * t
    return target.set(this.r * Math.cos(a), this.h * t, this.r * Math.sin(a))
  }
}

export function Antenna(props: PartMeshProps) {
  const geom = useMemo(() => new THREE.TubeGeometry(new Helix(0.3, 2.4, 9), 220, 0.045, 6, false), [])
  return (
    <group>
      <mesh position={[0, 0.2, 0]} material={M.brass}><cylinderGeometry args={[0.16, 0.16, 0.4, 16]} /></mesh>
      <mesh position={[0, 0.4, 0]} geometry={geom} material={M.copper} />
      <PartHit {...props} size={[0.9, 3.0, 0.9]} center={[0, 1.5, 0]} />
    </group>
  )
}
