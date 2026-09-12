import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { DrillClass } from '@/lib/types'
import { elapsed } from '@/lib/time'

export interface ClassTileProps {
  cls: DrillClass
  /** After the drill ends, an unreported class is "not submitted", not "waiting". */
  ended?: boolean
  /** Index in the current arrival batch; drives the 40 ms stagger. Undefined = no arrival animation. */
  arrivalIndex?: number
}

const STAGGER_MS = 40

/** DESIGN_V2 §4: 3px bottom bar carries the state. Pending is neutral, matched ok, missing warn. */
const BAR: Record<DrillClass['state'], string> = {
  pending: 'bg-line-strong',
  matched: 'bg-ok',
  missing: 'bg-warn',
}

/**
 * Fills its grid cell (design item 14) and carries what the principal needs to act:
 * class, teacher, present of roster, missing count. State by the bottom bar, no border.
 */
export function ClassTile({ cls, ended = false, arrivalIndex }: ClassTileProps) {
  const rc = cls.rollcall
  const missingCount = rc?.missing_refs.length ?? 0
  const style: CSSProperties = {}
  if (arrivalIndex !== undefined) style.animationDelay = `${arrivalIndex * STAGGER_MS}ms`

  return (
    <div
      className={clsx(
        'relative w-full min-h-[116px] rounded-md bg-surface overflow-hidden px-4 pt-3.5 pb-5 flex flex-col',
        arrivalIndex !== undefined && 'drill-arrive',
      )}
      style={style}
      title={rc ? `Submitted ${elapsed(rc.elapsed_s)} in at ${rc.node_label}` : ended ? 'Never submitted' : 'Not submitted yet'}
    >
      <div className="flex items-baseline gap-2 min-w-0">
        <span className="text-base font-medium text-ink truncate">{cls.name}</span>
        <span className="text-xs text-ink-3 truncate">{cls.teacher_name}</span>
      </div>
      <span className="mt-auto leading-none">
        {rc ? (
          <span className="font-mono text-lg leading-none tabular-nums">
            <span className="text-ink">{rc.present}</span>
            <span className="text-ink-4"> / {cls.roster_size}</span>
          </span>
        ) : (
          <span className="text-sm text-ink-4">{ended ? 'not submitted' : 'waiting'}</span>
        )}
      </span>
      <span className="mt-1.5 text-xs leading-none tabular-nums">
        {rc
          ? missingCount > 0
            ? <span className="text-warn">{missingCount} missing</span>
            : <span className="text-ink-3">all present, {rc.node_label}</span>
          : <span className="text-ink-4">{cls.roster_size} on roster</span>}
      </span>
      <i aria-hidden className={clsx('absolute inset-x-0 bottom-0 h-[3px]', BAR[cls.state])} />
    </div>
  )
}
