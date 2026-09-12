import { MATERIALS as M } from '../materials'
import { PlateBox, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const FACES = [M.module, M.module, M.espTop, M.module, M.module, M.module]

/** Substrate with the meander antenna exposed at the back, brushed-aluminium RF can over the rest. */
export function Esp32S3(props: PartMeshProps) {
  return (
    <group>
      <PlateBox size={[18, 0.8, 25.5]} at={[0, 0.4, 0]} mat={FACES} />
      <Rbox size={[15.6, 2.3, 17]} at={[0, 0.8 + 1.15, 3.6]} r={0.5} mat={M.aluminium} />
      <PartHit {...props} size={[19, 4, 26.5]} center={[0, 1.6, 0]} />
    </group>
  )
}
