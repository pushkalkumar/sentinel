import { create } from 'zustand'
import type { Alert, BandKey, DecisionCard, ISO, NodeId, TimelineResponse } from '@/lib/types'

export type TimelineSpeed = 1 | 10

export interface TimelineFrame {
  nodes: Record<NodeId, { pm25: number; temp_c: number; band: BandKey }>
  card: DecisionCard | null
  alerts: Alert[]
}

export interface TimelineState {
  /** True while the user is scrubbing or replaying; select.ts hooks then read `frame`. */
  active: boolean
  t: ISO | null
  data: TimelineResponse | null
  playing: boolean
  speed: TimelineSpeed
  frame: TimelineFrame | null
  load: (data: TimelineResponse) => void
  scrubTo: (iso: ISO) => void
  goLive: () => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: TimelineSpeed) => void
}

export const useTimelineStore = create<TimelineState>()((set, get) => ({
  active: false,
  t: null,
  data: null,
  playing: false,
  speed: 1,
  frame: null,

  load: (data) => {
    set({ data })
    // Keep the current frame in sync with fresh data while scrubbing.
    const { active, t } = get()
    if (active && t) get().scrubTo(t)
  },

  // OWNER: fe-novel — compute `frame` from `data` at `iso`: nearest reading per node (bands via lib/bands),
  // the latest decision at or before `iso`, and alerts open at `iso`. The scaffold leaves `frame` untouched.
  scrubTo: (iso) => {
    set({ active: true, t: iso })
  },

  goLive: () => set({ active: false, t: null, frame: null, playing: false }),

  setPlaying: (playing) => set({ playing }),

  setSpeed: (speed) => set({ speed }),
}))
