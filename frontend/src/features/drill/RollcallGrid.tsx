import { useRef } from 'react'
import type { Drill } from '@/lib/types'
import { ClassTile } from './ClassTile'
import { drillElapsedS, useNowTick } from './clock'

/** How long an arrived tile keeps its arrival animation class (enough to finish the 240 ms fade). */
const ARRIVAL_WINDOW_MS = 1500

const ARRIVE_CSS = `
@keyframes drill-arrive { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
.drill-arrive { animation: drill-arrive 240ms var(--ease-enter) both; }
`

export interface RollcallGridProps {
  drill: Drill
}

/** DESIGN §6.11 / §8.3: wrapping grid of class tiles, 12px gap, arrivals stagger 40 ms. */
export function RollcallGrid({ drill }: RollcallGridProps) {
  const running = drill.ended_at === null
  const now = useNowTick(1000, running)
  const elapsedS = drillElapsedS(drill, now)

  // Track which submissions have been seen so only new arrivals animate.
  const seen = useRef<Map<number, string>>(new Map())
  const arrivals = useRef<Map<number, { at: number; index: number }>>(new Map())
  const firstRender = useRef(true)

  let batchIndex = 0
  const tick = Date.now()
  for (const c of drill.classes) {
    const stamp = c.rollcall?.submitted_at ?? null
    const prev = seen.current.get(c.class_id)
    if (stamp && stamp !== prev && !firstRender.current) {
      arrivals.current.set(c.class_id, { at: tick, index: batchIndex })
      batchIndex += 1
    }
    if (stamp) seen.current.set(c.class_id, stamp)
    else seen.current.delete(c.class_id)
  }
  firstRender.current = false

  return (
    <div className="flex flex-wrap gap-3" role="list" aria-label="Classes">
      <style>{ARRIVE_CSS}</style>
      {drill.classes.map((c) => {
        const a = arrivals.current.get(c.class_id)
        const fresh = a && tick - a.at < ARRIVAL_WINDOW_MS
        return (
          <div key={c.class_id} role="listitem">
            <ClassTile cls={c} elapsedS={elapsedS} arrivalIndex={fresh ? a.index : undefined} />
          </div>
        )
      })}
    </div>
  )
}
