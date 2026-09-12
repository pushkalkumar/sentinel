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
  setExplode: (v: number) => void
  setManual: (manual: boolean) => void
  select: (id: PartId | null) => void
  hover: (id: PartId | null) => void
  setReducedMotion: (v: boolean) => void
  setTier: (t: DeviceTier) => void
  resetView: () => void
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

  setExplode: (v) => {
    const next = clamp01(v)
    if (next !== get().explode) set({ explode: next })
  },
  setManual: (manual) => set({ manual }),
  select: (id) => set({ selectedPartId: id === get().selectedPartId ? null : id }),
  hover: (id) => set({ hoverPartId: id }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  setTier: (tier) => set({ tier }),
  resetView: () => set({ explode: 0, manual: false, resetSeq: get().resetSeq + 1 }),
}))

/** The part the card shows: hover wins, then selection, then the MCU. */
export const activePartId = (s: HardwareState): PartId => s.hoverPartId ?? s.selectedPartId ?? 'esp32s3'
