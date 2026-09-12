import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { DrillClass } from '@/lib/types'
import { elapsed } from '@/lib/time'

export interface ClassTileProps {
  cls: DrillClass
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

/** 132×96 tile, no border, state by the bottom bar. No per-tile timestamp (the header carries elapsed). */
export function ClassTile({ cls, arrivalIndex }: ClassTileProps) {
  const rc = cls.rollcall
  const missingCount = rc?.missing_refs.length ?? 0
  const style: CSSProperties = {}
  if (arrivalIndex !== undefined) style.animationDelay = `${arrivalIndex * STAGGER_MS}ms`

  return (
    <div
      className={clsx('relative w-[132px] h-[96px] shrink-0 rounded-md bg-surface overflow-hidden px-4 pt-3.5 pb-4 flex flex-col', arrivalIndex !== undefined && 'drill-arrive')}
      style={style}
      title={rc ? `${cls.teacher_name}, submitted ${elapsed(rc.elapsed_s)} in at ${rc.node_label}` : `${cls.teacher_name}, not submitted`}
    >
      <span className="text-base font-medium text-ink truncate">{cls.name}</span>
      <span className="mt-auto leading-none">
        {rc ? (
          <span className="font-mono text-lg leading-none tabular-nums">
            <span className="text-ink">{rc.present}</span>
            <span className="text-ink-4"> / {cls.roster_size}</span>
          </span>
        ) : (
          <span className="text-sm text-ink-4">waiting</span>
        )}
      </span>
      {rc && missingCount > 0 && (
        <span className="mt-1.5 text-xs leading-none text-warn tabular-nums">{missingCount} missing</span>
      )}
      <i aria-hidden className={clsx('absolute inset-x-0 bottom-0 h-[3px]', BAR[cls.state])} />
    </div>
  )
}
