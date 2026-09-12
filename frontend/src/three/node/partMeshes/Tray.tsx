import { useMemo } from 'react'
import * as THREE from 'three'
import { MATERIALS as M } from '../materials'
import { BOX, PCB_MM, mm } from '../parts'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -d / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false)
  s.lineTo(x + w, y + d - r)
  s.absarc(x + w - r, y + d - r, r, 0, Math.PI / 2, false)
  s.lineTo(x + r, y + d)
  s.absarc(x + r, y + d - r, r, Math.PI / 2, Math.PI, false)
  s.lineTo(x, y + r)
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false)
  return s
}

const WALL_H = BOX.trayH - BOX.floor
const VENT_X = Array.from({ length: 9 }, (_, i) => 36 + i * 3.4)
const STANDOFFS: [number, number][] = [[-61, -36], [61, -36], [-61, 36], [61, 36]]

/** Walls are one bevelled extrusion with a rounded-rectangle hole, so the rim reads as moulded, not stacked slabs. */
function useWallGeometry() {
  return useMemo(() => {
    const outer = roundedRect(mm(BOX.w), mm(BOX.d), mm(BOX.cornerR))
    const inner = roundedRect(mm(BOX.w - 2 * BOX.wall), mm(BOX.d - 2 * BOX.wall), mm(BOX.cornerR - BOX.wall))
    outer.holes.push(new THREE.Path(inner.getPoints(24)))
    const g = new THREE.ExtrudeGeometry(outer, {
      depth: mm(WALL_H), bevelEnabled: true, bevelThickness: mm(0.6), bevelSize: mm(0.5), bevelSegments: 3, curveSegments: 24,
    })
    g.rotateX(-Math.PI / 2)
    g.translate(0, mm(BOX.floor), 0)
    return g
  }, [])
}

export function Tray(props: PartMeshProps) {
  const walls = useWallGeometry()
  return (
    <group>
      <mesh geometry={walls} material={M.enclosure} castShadow receiveShadow />
      <Rbox size={[BOX.w, BOX.floor, BOX.d]} at={[0, BOX.floor / 2, 0]} r={2.5} mat={M.enclosure} />
      {/* PCB standoffs and the low rib that separates the sensor chamber. */}
      {STANDOFFS.map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={2.6} h={PCB_MM.y - BOX.floor} at={[x, BOX.floor + (PCB_MM.y - BOX.floor) / 2, z]} mat={M.enclosure} segments={20} />
      ))}
      <Rbox size={[1.6, 9, BOX.d - 2 * BOX.wall - 2]} at={[27, BOX.floor + 4.5, 0]} r={0.5} mat={M.enclosure} />
      {/* Vent slots on the front wall feed the particulate sensor. */}
      {VENT_X.map((x) => (
        <Rbox key={x} size={[1.3, 16, 0.5]} at={[x, 26, BOX.d / 2 + 0.45]} r={0.4} mat={M.cavity} />
      ))}
      {/* Wall-mount ears on the back. */}
      {[-52, 52].map((x) => (
        <group key={x} position={[mm(x), mm(2), mm(-BOX.d / 2 - 5)]}>
          <Rbox size={[16, 3, 10]} r={1.5} mat={M.enclosure} />
          <Cyl r={2.2} h={3.2} mat={M.cavity} segments={20} />
        </group>
      ))}
      <PartHit {...props} size={[BOX.w + 2, BOX.trayH, BOX.d + 2]} center={[0, BOX.trayH / 2, 0]} />
    </group>
  )
}
