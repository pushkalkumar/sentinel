import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { useHardwareStore, type DeviceTier } from '@/store/hardware'

interface Props {
  inView: boolean
  tier: DeviceTier
  /** True only for the mesh scene with autorotate and dash animation. */
  continuous?: boolean
  /** Re-render on explode or hover changes (node scene). */
  watchStore?: boolean
}

/** Static tier renders a handful of frames by hand: the environment map, contact shadows and textures settle over the first few. */
const STATIC_FRAMES_MS = [0, 120, 400, 900, 1600]

/** Demand loop by default, `always` only when in view and continuous, `never` (manual frames) on the static tier. */
export function FrameloopController({ inView, tier, continuous = false, watchStore = false }: Props) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const invalidate = useThree((s) => s.invalidate)
  const advance = useThree((s) => s.advance)
  const size = useThree((s) => s.size)

  useEffect(() => {
    if (tier === 'static') {
      setFrameloop('never')
      const timers = STATIC_FRAMES_MS.map((ms) => setTimeout(() => advance(performance.now()), ms))
      return () => timers.forEach(clearTimeout)
    }
    setFrameloop(inView && continuous ? 'always' : 'demand')
    invalidate()
  }, [inView, tier, continuous, setFrameloop, invalidate, advance, size.width, size.height])

  useEffect(() => {
    if (!watchStore) return
    return useHardwareStore.subscribe((s, prev) => {
      if (s.explode !== prev.explode || s.hoverPartId !== prev.hoverPartId || s.selectedPartId !== prev.selectedPartId) invalidate()
    })
  }, [watchStore, invalidate])

  return null
}
