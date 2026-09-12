import { useCallback, useMemo, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import type { TimelineResponse } from '@/lib/types'
import { fmtSim } from '@/lib/time'
import { useTimelineStore } from '@/store/timeline'
import { useSimStore } from '@/store/sim'
import { Pins } from './Pins'
import { DAY_END_H, DAY_START_H, fracToMs, isoToFrac, medianSeries, msToFrac, sparklinePath, type DayBounds } from './timelineMath'

export interface TrackProps {
  data: TimelineResponse
  bounds: DayBounds
}

const SPARK_W = 1000
const SPARK_H = 40

/** 07:00 to 20:00 axis with the site-median sparkline behind, pins, and the draggable handle. */
export function Track({ data, bounds }: TrackProps) {
  const reduced = useReducedMotion() ?? false
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const active = useTimelineStore((s) => s.active)
  const t = useTimelineStore((s) => s.t)
  const scrubTo = useTimelineStore((s) => s.scrubTo)
  const stepMinutes = useTimelineStore((s) => s.stepMinutes)
  const setPlaying = useTimelineStore((s) => s.setPlaying)
  const liveTs = useSimStore((s) => s.simState?.sim_ts ?? data.sim_now ?? null)

  const spark = useMemo(() => sparklinePath(medianSeries(data), bounds, SPARK_W, SPARK_H), [data, bounds])
  const hours = useMemo(() => Array.from({ length: DAY_END_H - DAY_START_H + 1 }, (_, i) => DAY_START_H + i), [])

  const shownIso = active && t ? t : liveTs
  const handleFrac = shownIso ? isoToFrac(shownIso, bounds) : null
  const liveFrac = liveTs ? isoToFrac(liveTs, bounds) : null

  const fracFromEvent = useCallback((clientX: number): number => {
    const el = ref.current
    if (!el) return 0
    const r = el.getBoundingClientRect()
    return r.width > 0 ? Math.min(1, Math.max(0, (clientX - r.left) / r.width)) : 0
  }, [])

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // Pins and their tooltips handle their own clicks.
    if ((e.target as HTMLElement).closest('button')) return
    dragging.current = true
    setPlaying(false)
    e.currentTarget.setPointerCapture(e.pointerId)
    scrubTo(new Date(fracToMs(fracFromEvent(e.clientX), bounds)).toISOString())
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    scrubTo(new Date(fracToMs(fracFromEvent(e.clientX), bounds)).toISOString())
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    e.currentTarget.releasePointerCapture(e.pointerId)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); stepMinutes(-1) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); stepMinutes(1) }
    else if (e.key === 'Home') { e.preventDefault(); scrubTo(new Date(bounds.startMs).toISOString()) }
    else if (e.key === 'End') { e.preventDefault(); scrubTo(new Date(bounds.endMs).toISOString()) }
  }

  return (
    <div className="flex flex-col min-w-0 select-none">
      <div
        ref={ref}
        role="slider"
        tabIndex={0}
        aria-label="Replay position"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={handleFrac === null ? undefined : Math.round(handleFrac * 100)}
        aria-valuetext={shownIso ? fmtSim(shownIso) : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
        className="relative h-8 rounded-sm hairline bg-canvas cursor-ew-resize touch-none outline-none focus-visible:border-signal-line"
      >
        <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-6 w-full" aria-hidden>
          {spark.area && <path d={spark.area} fill="var(--color-signal-dim)" />}
          {spark.line && <path d={spark.line} fill="none" stroke="var(--color-signal)" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {hours.map((h) => {
          const x = msToFrac(bounds.startMs + (h - DAY_START_H) * 3_600_000, bounds) * 100
          return <i key={h} aria-hidden className="absolute bottom-0 w-px h-2 bg-line-strong" style={{ left: `${x}%` }} />
        })}
        {liveFrac !== null && active && (
          <i aria-hidden title={`Live ${fmtSim(liveTs)}`} className="absolute inset-y-0 w-px bg-ink-4" style={{ left: `${liveFrac * 100}%` }} />
        )}
        <Pins data={data} bounds={bounds} />
        {handleFrac !== null && (
          <motion.div
            layout={!reduced}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: 45 }}
            className="absolute inset-y-0 -translate-x-1/2 pointer-events-none"
            style={{ left: `${handleFrac * 100}%` }}
            aria-hidden
          >
            <div className={clsx('absolute inset-y-0 left-1/2 w-px', active ? 'bg-ink' : 'bg-signal')} />
            <div className={clsx('absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-4 rounded-xs border', active ? 'bg-ink border-ink' : 'bg-signal border-signal')} />
          </motion.div>
        )}
      </div>
      <div className="relative h-4 font-mono text-2xs text-ink-3" aria-hidden>
        {hours.filter((h) => h % 2 === 1 || h === DAY_START_H).map((h) => {
          const x = msToFrac(bounds.startMs + (h - DAY_START_H) * 3_600_000, bounds) * 100
          return (
            <span key={h} className={clsx('absolute', h === DAY_END_H ? '-translate-x-full' : h === DAY_START_H ? '' : '-translate-x-1/2')} style={{ left: `${x}%` }}>
              {String(h).padStart(2, '0')}:00
            </span>
          )
        })}
      </div>
    </div>
  )
}
