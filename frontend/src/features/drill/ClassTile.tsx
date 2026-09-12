import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { DrillClass } from '@/lib/types'
import { elapsed } from '@/lib/time'

export interface ClassTileProps {
  cls: DrillClass
  /** Seconds since the drill started (frozen once the drill ends). */
  elapsedS: number
  /** Index in the current arrival batch; drives the 40 ms stagger. Undefined = no arrival animation. */
  arrivalIndex?: number
}

const STAGGER_MS = 40

const BORDER: Record<DrillClass['state'], string> = {
  pending: 'var(--color-line)',
  matched: 'rgba(90,212,110,0.5)',
  missing: 'rgba(255,178,36,0.6)',
}

/** DESIGN §6.11: 120×88 tile, state shown by hairline and a 6px dot, never a flooded fill. */
export function ClassTile({ cls, elapsedS, arrivalIndex }: ClassTileProps) {
  const rc = cls.rollcall
  const missingCount = rc?.missing_refs.length ?? 0
  const style: CSSProperties = { borderColor: BORDER[cls.state] }
  if (arrivalIndex !== undefined) style.animationDelay = `${arrivalIndex * STAGGER_MS}ms`

  const dotClass = cls.state === 'pending'
    ? 'shadow-[inset_0_0_0_1.5px_var(--color-ink-4)]'
    : cls.state === 'matched'
      ? 'bg-ok'
      : 'bg-warn'

  return (
    <div
      className={clsx('w-[120px] h-[88px] shrink-0 rounded-sm bg-surface border p-3 flex flex-col', arrivalIndex !== undefined && 'drill-arrive')}
      style={style}
      title={rc ? `${cls.teacher_name} · submitted ${elapsed(rc.elapsed_s)} in at ${rc.node_label}` : `${cls.teacher_name} · not submitted`}
    >
      <div className="flex items-center gap-2">
        <i aria-hidden className={clsx('size-1.5 rounded-full shrink-0', dotClass)} />
        <span className="text-base font-medium text-ink truncate">{cls.name}</span>
      </div>
      <div className="mt-auto font-mono text-sm tabular-nums">
        {rc ? (
          <span className="text-ink">{rc.present} / {cls.roster_size}</span>
        ) : (
          <span className="text-ink-2">--</span>
        )}
      </div>
      <div className="font-mono text-sm tabular-nums">
        {!rc && <span className="text-ink-3">{elapsed(elapsedS)}</span>}
        {rc && missingCount === 0 && <span className="text-ok">ok</span>}
        {rc && missingCount > 0 && <span className="text-warn">{missingCount} missing</span>}
      </div>
    </div>
  )
}
