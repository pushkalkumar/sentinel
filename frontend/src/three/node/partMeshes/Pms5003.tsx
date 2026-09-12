import { useMemo } from 'react'
import * as THREE from 'three'
import { MATERIALS as M } from '../materials'
import { mm } from '../parts'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const W = 38
const H = 21
const D = 50
const GRILLE_R = 11
const SLOTS = 8
const PINS = Array.from({ length: 8 }, (_, i) => -5.25 + i * 1.5)

function stadium(cx: number, cy: number, len: number, wid: number, angle: number): THREE.Path {
  const pts: THREE.Vector2[] = []
  const r = wid / 2
  const half = len / 2 - r
  const steps = 10
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / steps
    pts.push(new THREE.Vector2(half + r * Math.cos(a), r * Math.sin(a)))
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / steps
    pts.push(new THREE.Vector2(-half + r * Math.cos(a), r * Math.sin(a)))
  }
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return new THREE.Path(pts.map((p) => new THREE.Vector2(cx + p.x * cos - p.y * sin, cy + p.x * sin + p.y * cos)))
}

/** Fan grille: a disc with a ring of eight tangential slots, extruded thin. */
function useGrille() {
  return useMemo(() => {
    const disc = new THREE.Shape()
    disc.absarc(0, 0, mm(GRILLE_R), 0, Math.PI * 2, false)
    for (let i = 0; i < SLOTS; i++) {
      const a = (i / SLOTS) * Math.PI * 2
      const rr = mm(7.2)
      disc.holes.push(stadium(rr * Math.cos(a), rr * Math.sin(a), mm(5.2), mm(1.7), a + Math.PI / 2))
    }
    const g = new THREE.ExtrudeGeometry(disc, { depth: mm(0.7), bevelEnabled: false, curveSegments: 24 })
    g.rotateX(-Math.PI / 2)
    return g
  }, [])
}

/** Sheet-metal laser scattering sensor. Origin at the underside. */
export function Pms5003(props: PartMeshProps) {
  const grille = useGrille()
  return (
    <group>
      <Rbox size={[W, H, D]} at={[0, H / 2, 0]} r={1.2} mat={M.aluminium} />
      <group position={[0, mm(H), mm(12)]}>
        <Cyl r={GRILLE_R + 0.3} h={0.4} at={[0, 0.05, 0]} mat={M.cavity} segments={40} />
        <mesh geometry={grille} material={M.aluminium} position={[0, mm(0.15), 0]} castShadow />
        <Cyl r={2.6} h={1} at={[0, 0.5, 0]} mat={M.aluminium} segments={24} />
      </group>
      {/* Air inlet slot on the end that faces the vents, outlet on the far end. */}
      <Rbox size={[22, 3.2, 0.6]} at={[0, H - 5, D / 2 - 0.1]} r={0.5} mat={M.cavity} />
      <Rbox size={[14, 2.4, 0.6]} at={[0, 5, -D / 2 + 0.1]} r={0.5} mat={M.cavity} />
      {/* 8-pin JST connector on the divider side. */}
      <group position={[mm(-W / 2 + 1.4), mm(3), mm(-14)]}>
        <Rbox size={[2.8, 4.6, 13.5]} r={0.4} mat={M.nylon} />
        {PINS.map((z) => <Cyl key={z} r={0.3} h={2.2} at={[0, -3.2, z]} mat={M.aluminium} segments={6} />)}
      </group>
      <PartHit {...props} size={[W + 3, H + 2, D + 2]} center={[0, H / 2, 0]} />
    </group>
  )
}
