import { Line } from '@react-three/drei'
import { BOUNDARY, BUILDINGS, PATHS, type XZ } from './campusGeometry'

const Y_LINE = 0.02
const Y_FILL = 0.01
const closed = (pts: readonly XZ[]): [number, number, number][] => [...pts, pts[0]].map(([x, z]) => [x, Y_LINE, z])

export function CampusOutline() {
  return (
    <group>
      <Line points={closed(BOUNDARY)} color="#2b3038" lineWidth={1.2} />
      {BUILDINGS.map((b) => {
        const [cx, cz] = b.center
        const [w, d] = b.size
        const rect: XZ[] = [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]]
        return (
          <group key={b.id}>
            <mesh position={[cx, Y_FILL, cz]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[w, d]} />
              <meshBasicMaterial color="#111418" />
            </mesh>
            <Line points={closed(rect)} color="#3a3f48" lineWidth={1} />
          </group>
        )
      })}
      {PATHS.map((p, i) => (
        <Line key={i} points={closed(p)} color="#262a31" lineWidth={1} dashed dashSize={0.25} gapSize={0.2} />
      ))}
    </group>
  )
}
