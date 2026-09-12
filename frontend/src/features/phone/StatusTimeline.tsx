import clsx from 'clsx'
import type { IncidentPublic, IncidentStatus } from '@/lib/types'
import { fmtWall, fmtWallZoned } from '@/lib/time'

export interface StatusTimelineProps {
  status: IncidentStatus
  timeline: IncidentPublic['timeline']
}

const STEPS: { key: IncidentStatus; label: string; actions: string[] }[] = [
  { key: 'received', label: 'Received', actions: ['created'] },
  { key: 'acknowledged', label: 'Acknowledged', actions: ['acknowledge'] },
  { key: 'en_route', label: 'En route', actions: ['en_route'] },
  { key: 'resolved', label: 'Resolved', actions: ['resolve'] },
]

const RANK: Record<IncidentStatus, number> = {
  queued: 0, received: 0, acknowledged: 1, en_route: 2, resolved: 3, false: -1,
}

/** Four-step vertical timeline; the current step's dot pulses (the only pulse on a field page). */
export function StatusTimeline({ status, timeline }: StatusTimelineProps) {
  const current = RANK[status]
  const flagged = status === 'false'
  return (
    <ol className="relative pl-9 font-field" aria-label="Report progress">
      <i aria-hidden className="absolute left-[7px] top-4 bottom-4 w-px bg-f-line" />
      {STEPS.map((step, i) => {
        const done = !flagged && i < current
        const active = !flagged && i === current
        const at = timeline.find((e) => step.actions.includes(e.action))?.at ?? null
        const label = i === 0 && status === 'queued' ? 'Queued for staff confirmation' : step.label
        return (
          <li key={step.key} className="relative flex items-baseline justify-between gap-3 min-h-14">
            <i
              aria-hidden
              className={clsx(
                'absolute -left-9 top-[7px] size-4 rounded-full',
                active && 'bg-f-signal pulse-live',
                done && 'bg-f-ink',
                !active && !done && 'bg-f-canvas shadow-[inset_0_0_0_1.5px_var(--color-f-line-strong)]',
              )}
            />
            <span className={clsx('text-[18px]', active ? 'font-semibold text-f-signal' : done ? 'font-medium text-f-ink' : 'text-f-ink-2')}>
              {label}
              {active && <span className="sr-only"> (current)</span>}
            </span>
            {at && (
              <time dateTime={at} title={fmtWallZoned(at)} className="shrink-0 font-field-mono text-[14px] text-f-ink-2 tabular-nums">
                {fmtWall(at)}
              </time>
            )}
          </li>
        )
      })}
    </ol>
  )
}
