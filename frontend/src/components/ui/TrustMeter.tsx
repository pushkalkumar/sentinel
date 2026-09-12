import clsx from 'clsx'
import type { TrustLabel, TrustLine } from '@/lib/types'
import { Pill } from './Pill'

export interface TrustMeterProps {
  score: number
  label: TrustLabel
  breakdown: TrustLine[]
  compact?: boolean
  className?: string
}

const LAYER_LABEL: Record<TrustLine['layer'], string> = {
  proximity: 'Proximity proof',
  sensor: 'Sensor corroboration',
  crowd: 'Crowd corroboration',
  role: 'Reporter role',
  gps: 'GPS consistency',
  history: 'Device history',
  cap: 'Cap',
}

/** DESIGN §6.8: bone fill, ticks at 30 and 60, mono breakdown; the pill carries the verdict colour. */
export function TrustMeter({ score, label, breakdown, compact = false, className }: TrustMeterProps) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className={clsx('min-w-0', className)}>
      <div className="flex items-center gap-4">
        <div className="relative flex-1 h-1.5 rounded-xs bg-line overflow-visible">
          <div className="h-full rounded-xs bg-ink transition-[width] duration-[600ms] ease-[var(--ease-enter)]" style={{ width: `${pct}%` }} />
          {[30, 60].map((t) => (
            <i key={t} aria-hidden className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-ink-4" style={{ left: `${t}%` }} />
          ))}
        </div>
        <span className="font-mono text-md text-ink tabular-nums w-8 text-right">{score}</span>
        <Pill kind="trust" value={label} />
      </div>
      {!compact && (
        <div className="relative h-4 mt-1 font-mono text-2xs text-ink-3">
          <span className="absolute -translate-x-1/2" style={{ left: '30%' }}>30 likely</span>
          <span className="absolute -translate-x-1/2" style={{ left: '60%' }}>60 verified</span>
        </div>
      )}
      {!compact && breakdown.length > 0 && (
        <dl className="mt-3 grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1 font-mono text-xs">
          {breakdown.map((line, i) => {
            const isCap = line.layer === 'cap'
            const tone = line.points < 0 ? 'text-alarm' : line.points === 0 ? 'text-ink-3' : 'text-ink'
            return isCap ? (
              <div key={i} className="col-span-3 text-ink-3">{line.note}</div>
            ) : (
              <div key={i} className="contents">
                <dt className="text-ink-2 whitespace-nowrap">{LAYER_LABEL[line.layer]}</dt>
                <dd className="text-ink-3 truncate">{line.note}</dd>
                <dd className={clsx('text-right tabular-nums', tone)}>{line.points > 0 ? `+${line.points}` : line.points}</dd>
              </div>
            )
          })}
        </dl>
      )}
    </div>
  )
}
