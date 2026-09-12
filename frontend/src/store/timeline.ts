import { create } from 'zustand'
import type { Alert, BandKey, DecisionCard, ISO, NodeId, TimelineResponse } from '@/lib/types'
import { computeFrame, clampMs, dayBounds, latestReadingMs } from '@/features/novel/timelineMath'

export type TimelineSpeed = 1 | 10

/** 1x follows the simulator's own default pace (60 sim seconds per real second, CONTRACT §7). */
const SIM_SECONDS_PER_REAL_SECOND = 60
const TICK_MS = 100

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
  /** Move by whole sim minutes from the current position (keyboard arrows). */
  stepMinutes: (n: number) => void
  goLive: () => void
  setPlaying: (playing: boolean) => void
  setSpeed: (speed: TimelineSpeed) => void
}

let ticker: ReturnType<typeof setInterval> | null = null

function stopTicker(): void {
  if (ticker) clearInterval(ticker)
  ticker = null
}

export const useTimelineStore = create<TimelineState>()((set, get) => {
  /** Upper scrub bound: the latest stored reading, else the end of the axis. */
  const ceilingMs = (data: TimelineResponse): number => {
    const b = dayBounds(data)
    const latest = latestReadingMs(data)
    return latest === null ? b.endMs : Math.min(b.endMs, Math.max(b.startMs, latest))
  }

  const startTicker = () => {
    stopTicker()
    ticker = setInterval(() => {
      const { playing, t, data, speed } = get()
      if (!playing || !data) return stopTicker()
      const b = dayBounds(data)
      const fromMs = t ? Date.parse(t) : b.startMs
      const stepMs = (TICK_MS / 1000) * SIM_SECONDS_PER_REAL_SECOND * speed * 1000
      const ceiling = ceilingMs(data)
      const nextMs = Math.min(ceiling, fromMs + stepMs)
      get().scrubTo(new Date(nextMs).toISOString())
      if (nextMs >= ceiling) {
        set({ playing: false })
        stopTicker()
      }
    }, TICK_MS)
  }

  return {
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

    scrubTo: (iso) => {
      const { data } = get()
      if (!data) {
        set({ active: true, t: iso })
        return
      }
      const b = dayBounds(data)
      const ms = clampMs(Date.parse(iso), b)
      const t = Number.isFinite(ms) ? new Date(ms).toISOString() : iso
      set({ active: true, t, frame: computeFrame(data, t) })
    },

    stepMinutes: (n) => {
      const { data, t } = get()
      if (!data) return
      const b = dayBounds(data)
      const fromMs = t ? Date.parse(t) : ceilingMs(data)
      get().scrubTo(new Date(clampMs(fromMs + n * 60_000, b)).toISOString())
    },

    goLive: () => {
      stopTicker()
      set({ active: false, t: null, frame: null, playing: false })
    },

    setPlaying: (playing) => {
      const { data, t } = get()
      if (playing && !data) return
      if (playing && data) {
        const b = dayBounds(data)
        const atEnd = t ? Date.parse(t) >= ceilingMs(data) : false
        // Play from the start when idle at live or parked at the end.
        get().scrubTo(t && !atEnd ? t : new Date(b.startMs).toISOString())
        set({ playing: true })
        startTicker()
        return
      }
      stopTicker()
      set({ playing: false })
    },

    setSpeed: (speed) => set({ speed }),
  }
})
