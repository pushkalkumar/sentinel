import type { MeshLogEntry } from '@/lib/types'

export const XENON_FIELD = 'xenon-a'

/** A real button press is a mesh hop from xenon-a with kind "button" (backend/app/hardware_bridge.py). */
export const isXenonPress = (h: MeshLogEntry | null | undefined): h is MeshLogEntry =>
  !!h && h.origin_node === XENON_FIELD && (h.kind as string) === 'button'
