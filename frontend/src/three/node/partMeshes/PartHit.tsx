import { useCursor } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useHardwareStore } from '@/store/hardware'
import { mm, type Part, type Vec3 } from '../parts'

export interface PartMeshProps { part: Part; interactive: boolean }

interface HitProps extends PartMeshProps {
  /** Hit box size in mm, slightly larger than the part. */
  size: Vec3
  center?: Vec3
}

/** Invisible hit box, one per part. Hover and selection feedback live in the label leader, not on the mesh. */
export function PartHit({ part, interactive, size, center = [0, 0, 0] }: HitProps) {
  const hovered = useHardwareStore((s) => s.hoverPartId === part.id)
  useCursor(interactive && hovered)
  if (!interactive) return null
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useHardwareStore.getState().hover(part.id) }
  const out = () => useHardwareStore.getState().hover(null)
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useHardwareStore.getState().select(part.id) }
  return (
    <mesh position={[mm(center[0]), mm(center[1]), mm(center[2])]} onPointerOver={over} onPointerOut={out} onClick={click}>
      <boxGeometry args={[mm(size[0]), mm(size[1]), mm(size[2])]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
  )
}
