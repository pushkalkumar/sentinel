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

/** HARDWARE_3D §6: demand loop by default, `always` only when in view and continuous, `never` on static tier. */
export function FrameloopController({ inView, tier, continuous = false, watchStore = false }: Props) {
  const setFrameloop = useThree((s) => s.setFrameloop)
  const invalidate = useThree((s) => s.invalidate)

  useEffect(() => {
    if (tier === 'static') {
      setFrameloop('never')
      invalidate()
      const t = setTimeout(invalidate, 600)
      return () => clearTimeout(t)
    }
    setFrameloop(inView && continuous ? 'always' : 'demand')
    invalidate()
  }, [inView, tier, continuous, setFrameloop, invalidate])

  useEffect(() => {
    if (!watchStore) return
    return useHardwareStore.subscribe((s, prev) => {
      if (s.explode !== prev.explode || s.hoverPartId !== prev.hoverPartId || s.selectedPartId !== prev.selectedPartId) invalidate()
    })
  }, [watchStore, invalidate])

  return null
}
