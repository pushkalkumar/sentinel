import { useMemo } from 'react'
import * as THREE from 'three'
import { MATERIALS as M } from '../materials'
import { mm } from '../parts'
import { Cyl } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const TURNS = 6
const RADIUS = 2.4
const BASE = 3
const TOP = 22

function helixCurve(): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = []
  const n = TURNS * 24
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = t * TURNS * Math.PI * 2
    // The coil tightens toward the tip like a real spring helical.
    const r = RADIUS * (1 - 0.18 * t)
    pts.push(new THREE.Vector3(mm(r * Math.cos(a)), mm(BASE + (TOP - BASE) * t), mm(r * Math.sin(a))))
  }
  return new THREE.CatmullRomCurve3(pts)
}

/** Copper spring helical on an SMA ferrule. Local origin sits on the SMA jack. */
export function Antenna(props: PartMeshProps) {
  const geom = useMemo(() => new THREE.TubeGeometry(helixCurve(), TURNS * 40, mm(0.5), 8, false), [])
  return (
    <group>
      <Cyl r={3.2} h={3} at={[0, 1.5, 0]} mat={M.aluminium} segments={24} />
      <Cyl r={0.7} h={BASE} at={[0, BASE / 2 + 1, 0]} mat={M.copper} segments={10} />
      <mesh geometry={geom} material={M.copper} castShadow />
      <PartHit {...props} size={[7, TOP + 2, 7]} center={[0, TOP / 2 + 1, 0]} />
    </group>
  )
}
