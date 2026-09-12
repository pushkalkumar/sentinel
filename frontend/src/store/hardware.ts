import { create } from 'zustand'
import type { PartId } from '@/three/node/parts'

export type DeviceTier = 'full' | 'static'

export interface HardwareState {
  /** 0 = assembled, 1 = fully exploded. */
  explode: number
  /** True while the slider owns explode; scroll hands control back. */
  manual: boolean
  selectedPartId: PartId | null
  hoverPartId: PartId | null
  reducedMotion: boolean
  tier: DeviceTier
  /** Bumped by the page to ask OrbitControls to reset. */
  resetSeq: number
  /** Set once the visitor has dragged, scrolled or touched the model; the hint toast fires on the first one. */
  interacted: boolean
  setExplode: (v: number) => void
  setManual: (manual: boolean) => void
  select: (id: PartId | null) => void
  hover: (id: PartId | null) => void
  setReducedMotion: (v: boolean) => void
  setTier: (t: DeviceTier) => void
  resetView: () => void
  markInteracted: () => void
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

export const useHardwareStore = create<HardwareState>()((set, get) => ({
  explode: 0,
  manual: false,
  selectedPartId: null,
  hoverPartId: null,
  reducedMotion: false,
  tier: 'full',
  resetSeq: 0,
  interacted: false,

  setExplode: (v) => {
    const next = clamp01(v)
    if (next !== get().explode) set({ explode: next })
  },
  setManual: (manual) => set({ manual }),
  select: (id) => set({ selectedPartId: id === get().selectedPartId ? null : id }),
  hover: (id) => set({ hoverPartId: id }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTier: (tier) => set({ tier }),
  resetView: () => set({ explode: 0, manual: false, selectedPartId: null, resetSeq: get().resetSeq + 1 }),
  markInteracted: () => { if (!get().interacted) set({ interacted: true }) },
}))

/** The part the card shows: hover wins, then selection, then the MCU. */
export const activePartId = (s: HardwareState): PartId => s.hoverPartId ?? s.selectedPartId ?? 'esp32s3'

// Dev-only handle so screenshot scripts can drive the explode factor.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __hw: Pick<HardwareState, 'setExplode' | 'setManual' | 'select' | 'hover'> }).__hw = {
    setExplode: (v) => useHardwareStore.getState().setExplode(v),
    setManual: (m) => useHardwareStore.getState().setManual(m),
    select: (id) => useHardwareStore.getState().select(id),
    hover: (id) => useHardwareStore.getState().hover(id),
  }
}
