import { MATERIALS as M } from '../materials'
import { BOX, mm } from '../parts'
import { Cyl, Rbox } from './primitives'
import { PartHit, type PartMeshProps } from './PartHit'

const SCREWS: [number, number][] = [[64, 39], [-64, 39], [64, -39], [-64, -39]]
const LED_XZ: [number, number] = [-6, 32]
const H = BOX.lidH
/** Light pipe length below the lid top: reaches the LED cap when closed. */
const PIPE = 30

/** Local origin is the lid's underside; the lip and gasket hang below it into the tray. */
export function Lid(props: PartMeshProps) {
  return (
    <group>
      <Rbox size={[BOX.w, H, BOX.d]} at={[0, H / 2, 0]} r={2.6} mat={M.enclosure} />
      <Rbox size={[BOX.w - 2 * BOX.wall - 1.2, 3, BOX.d - 2 * BOX.wall - 1.2]} at={[0, -1.4, 0]} r={2} mat={M.enclosure} />
      <Rbox size={[BOX.w - 3, 1.2, BOX.d - 3]} at={[0, 0.2, 0]} r={3} mat={M.gasket} />
      {/* Panel recess on top. */}
      <Rbox size={[123, 1.2, 73]} at={[0, H - 0.4, 0]} r={1} mat={M.cavity} />
      {/* Captive screws with a hex socket. */}
      {SCREWS.map(([x, z]) => (
        <group key={`${x}${z}`} position={[mm(x), mm(H), mm(z)]}>
          <Cyl r={2.4} h={0.9} at={[0, 0.3, 0]} mat={M.aluminium} segments={24} />
          <Cyl r={1} h={0.5} at={[0, 0.7, 0]} mat={M.cavity} segments={6} />
        </group>
      ))}
      {/* Status dome: bezel ring, frosted hemisphere, and the light pipe that reaches down to the LED. */}
      <group position={[mm(LED_XZ[0]), mm(H), mm(LED_XZ[1])]}>
        <Cyl r={4.4} h={0.8} at={[0, 0.3, 0]} mat={M.plastic} segments={32} />
        <mesh position={[0, mm(0.6), 0]} material={M.ledDome} castShadow>
          <sphereGeometry args={[mm(3.2), 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <Cyl r={2.1} h={PIPE} at={[0, -PIPE / 2 + 0.5, 0]} mat={M.frosted} segments={24} />
      </group>
      <PartHit {...props} size={[BOX.w + 2, H + 2, BOX.d + 2]} center={[0, H / 2, 0]} />
    </group>
  )
}
