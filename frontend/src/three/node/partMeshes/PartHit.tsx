import { useCursor } from '@react-three/drei'
import type { ThreeEvent } from '@react-three/fiber'
import { useHardwareStore } from '@/store/hardware'
import { MATERIALS } from '../materials'
import type { Part, Vec3 } from '../parts'

export interface PartMeshProps { part: Part; interactive: boolean }

interface HitProps extends PartMeshProps {
  /** Hit box size, slightly larger than the part. */
  size: Vec3
  center?: Vec3
}

/** Invisible hit box plus the shared hover overlay (HARDWARE_3D §4.3). One per part. */
export function PartHit({ part, interactive, size, center = [0, 0, 0] }: HitProps) {
  const hovered = useHardwareStore((s) => s.hoverPartId === part.id)
  const selected = useHardwareStore((s) => s.selectedPartId === part.id)
  useCursor(interactive && hovered)
  if (!interactive) return null
  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useHardwareStore.getState().hover(part.id) }
  const out = () => useHardwareStore.getState().hover(null)
  const click = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); useHardwareStore.getState().select(part.id) }
  return (
    <group position={center}>
      <mesh onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[size[0], size[1], size[2]]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <mesh visible={hovered || selected} material={MATERIALS.hoverOverlay}>
        <boxGeometry args={[size[0] * 1.02, size[1] * 1.02, size[2] * 1.02]} />
      </mesh>
    </group>
  )
}
