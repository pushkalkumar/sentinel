import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import type { TimelineResponse } from '@/lib/types'
import { fmtSim } from '@/lib/time'
import { ALERT_META, PRIORITY_COLOR } from '@/lib/bands'
import { useUiStore } from '@/store/ui'
import { useTimelineStore } from '@/store/timeline'
import { isoToFrac, PIN_COLOR, type DayBounds } from './timelineMath'

export interface PinsProps {
  data: TimelineResponse
  bounds: DayBounds
}

type TimelineAlert = TimelineResponse['alerts'][number]
type TimelineIncident = TimelineResponse['incidents'][number]

function AlertPin({ a, bounds }: { a: TimelineAlert; bounds: DayBounds }) {
  const reduced = useReducedMotion() ?? false
  const scrubTo = useTimelineStore((s) => s.scrubTo)
  const openExplain = useUiStore((s) => s.openExplain)
  const left = `${(isoToFrac(a.started_at, bounds) * 100).toFixed(3)}%`
  const color = PIN_COLOR[a.priority]
  const meta = ALERT_META[a.kind]
  const nearRight = isoToFrac(a.started_at, bounds) > 0.7

  return (
    <div className="group absolute bottom-0 -translate-x-1/2 focus-within:z-20 hover:z-20" style={{ left }}>
      <motion.button
        type="button"
        initial={reduced ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        onClick={() => scrubTo(a.started_at)}
        aria-label={`${meta?.label ?? a.kind} at ${fmtSim(a.started_at)}${a.node_label ? `, ${a.node_label}` : ''}`}
        className="block w-3 h-4 flex items-end justify-center cursor-pointer"
      >
        <i
          aria-hidden
          className={clsx('block rounded-full', a.priority <= 2 ? 'size-2' : 'size-1.5')}
          style={{ background: color, boxShadow: a.priority === 1 ? `0 0 0 2px ${color}44` : undefined }}
        />
      </motion.button>
      <div
        role="tooltip"
        className={clsx(
          'pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto',
          'invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100',
          'transition-[opacity] duration-[120ms]',
          'absolute bottom-full mb-2 w-72 bg-overlay rounded-md p-3 text-sm text-ink',
          nearRight ? 'right-0' : 'left-0',
        )}
        style={{ boxShadow: 'var(--shadow-overlay)' }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <i aria-hidden className="size-1.5 rounded-full" style={{ background: PRIORITY_COLOR[a.priority] }} />
          <span className="font-mono text-xs text-ink">{a.kind}</span>
          <span className="ml-auto font-mono text-2xs text-ink-3">{fmtSim(a.started_at)}</span>
        </div>
        <p className="font-mono text-xs text-ink-2 break-words">{a.reason || 'No reason recorded.'}</p>
        {a.node_id && (
          <button
            type="button"
            onClick={() => openExplain(a.node_id as string, a.started_at)}
            className="mt-2 text-xs text-signal hover:underline"
          >
            Show math
          </button>
        )}
      </div>
    </div>
  )
}

function IncidentPin({ i, bounds }: { i: TimelineIncident; bounds: DayBounds }) {
  const reduced = useReducedMotion() ?? false
  const scrubTo = useTimelineStore((s) => s.scrubTo)
  if (!i.sim_at) return null
  const left = `${(isoToFrac(i.sim_at, bounds) * 100).toFixed(3)}%`
  return (
    <motion.button
      type="button"
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      onClick={() => scrubTo(i.sim_at as string)}
      title={`${i.code} · ${i.type} · ${i.status} · trust ${i.trust_score}`}
      aria-label={`Incident ${i.code} at ${fmtSim(i.sim_at)}`}
      className="absolute top-0 -translate-x-1/2 w-3 h-3 flex items-center justify-center cursor-pointer"
      style={{ left }}
    >
      <i aria-hidden className="block size-1.5 rotate-45 bg-ink-2" />
    </motion.button>
  )
}

/** Decision pins (bottom edge) and incident diamonds (top edge) over the track. */
export function Pins({ data, bounds }: PinsProps) {
  return (
    <>
      {data.incidents.map((i) => <IncidentPin key={i.code} i={i} bounds={bounds} />)}
      {data.alerts.map((a) => <AlertPin key={a.id} a={a} bounds={bounds} />)}
    </>
  )
}
