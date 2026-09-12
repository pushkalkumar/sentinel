import clsx from 'clsx'
import { useDrillStore } from '@/store/drills'
import type { DrillClass } from '@/lib/types'
import type { ChapterKind } from './chapterKind'

const BAR: Record<DrillClass['state'], string> = {
  pending: 'bg-line-strong',
  matched: 'bg-ok',
  missing: 'bg-warn',
}

/** Chapters where a drill that just closed should stay on screen as the record. */
const KEEPS_RECORD: ChapterKind[] = ['rollcall', 'clear']

function Tile({ cls }: { cls: DrillClass }) {
  const rc = cls.rollcall
  const missing = rc?.missing_refs.length ?? 0
  return (
    <div className="relative min-h-[76px] rounded-md bg-raised overflow-hidden px-3.5 pt-2.5 pb-3 flex flex-col">
      <span className="text-sm font-medium text-ink">{cls.name}</span>
      <span className="mt-auto flex items-baseline justify-between gap-2">
        <span className="font-mono text-base leading-none tabular-nums">
          {rc ? (
            <>
              <span className="text-ink">{rc.present}</span>
              <span className="text-ink-4"> / {cls.roster_size}</span>
            </>
          ) : (
            <span className="text-ink-4">waiting</span>
          )}
        </span>
        {missing > 0 && <span className="text-xs text-warn tabular-nums">{missing} missing</span>}
      </span>
      <i aria-hidden className={clsx('absolute inset-x-0 bottom-0 h-[3px]', BAR[cls.state])} />
    </div>
  )
}

export interface RollcallPanelProps { kind: ChapterKind }

/** Six class tiles from the active drill; the drill that just closed stays up through the all clear. */
export function RollcallPanel({ kind }: RollcallPanelProps) {
  const active = useDrillStore((s) => s.active)
  const last = useDrillStore((s) => s.history[0] ?? null)
  const drill = active ?? (KEEPS_RECORD.includes(kind) ? last : null)
  const classes = drill?.classes ?? []
  const closed = !active && drill !== null

  return (
    <section className="bg-surface rounded-lg p-panel flex flex-col min-h-0" aria-label="Roll call">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="label-signage">Roll call</h2>
        {drill && (
          <span className="text-xs text-ink-3 tabular-nums">
            {closed ? 'Closed' : `${drill.summary.submitted} of ${drill.summary.classes} classes`}
            {drill.summary.missing_total > 0 && <span className="text-warn">, {drill.summary.missing_total} missing</span>}
          </span>
        )}
      </div>
      {drill && classes.length > 0 ? (
        <div className={clsx('mt-3 flex-1 min-h-0 grid grid-cols-3 auto-rows-fr gap-2 transition-opacity duration-[200ms]', closed && 'opacity-70')}>
          {classes.map((c) => <Tile key={c.class_id} cls={c} />)}
        </div>
      ) : (
        <p className="mt-4 text-sm text-ink-4">No drill running</p>
      )}
    </section>
  )
}
