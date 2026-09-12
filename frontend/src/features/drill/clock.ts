import { useEffect, useState } from 'react'
import type { Drill } from '@/lib/types'

/** Wall-clock tick shared by the drill timers. Stops ticking when `running` is false. */
export function useNowTick(intervalMs = 1000, running = true): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, running])
  return now
}

/** Seconds from started_at to ended_at (or to `nowMs` while the drill is open). */
export function drillElapsedS(drill: Pick<Drill, 'started_at' | 'ended_at'>, nowMs: number): number {
  const start = new Date(drill.started_at).getTime()
  const end = drill.ended_at ? new Date(drill.ended_at).getTime() : nowMs
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, (end - start) / 1000)
}
