import { MATERIALS as M } from '../materials'
import { PCB_MM } from '../parts'
import { Cyl, PlateBox, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const HOLES: [number, number][] = [[-61, -36], [61, -36], [-61, 36], [61, 36]]
const FACES = [M.pcb, M.pcb, M.pcbTop, M.pcb, M.pcb, M.pcb]

/** Main board: textured top, bare edges, plated holes, a battery JST on the underside edge. Origin at the underside. */
export function Pcb(props: PartMeshProps) {
  return (
    <group>
      <PlateBox size={[PCB_MM.w, PCB_MM.t, PCB_MM.d]} at={[0, PCB_MM.t / 2, 0]} mat={FACES} />
      {HOLES.map(([x, z]) => (
        <Cyl key={`${x}${z}`} r={1.7} h={PCB_MM.t + 0.2} at={[x, PCB_MM.t / 2, z]} mat={M.aluminium} segments={16} />
      ))}
      {/* Battery connector and a debug header, the two things that are on the board itself. */}
      <Rbox size={[7.5, 5, 4.5]} at={[-30, PCB_MM.t + 2.5, 34]} r={0.5} mat={M.nylon} />
      <Rbox size={[12, 2.4, 2.5]} at={[-58, PCB_MM.t + 1.2, -10]} r={0.3} mat={M.plastic} />
      <PartHit {...props} size={[PCB_MM.w + 2, PCB_MM.t + 1, PCB_MM.d + 2]} center={[0, PCB_MM.t / 2, 0]} />
    </group>
  )
}
