import clsx from 'clsx'
import { PartCard } from './PartCard'
import { PartList } from './PartList'
import { BOM_TOTAL_1K } from '@/three/node/parts'

const SPEC: [string, string][] = [
  ['MCU', 'ESP32-S3'],
  ['Particulates', 'PMS5003'],
  ['Temp / RH', 'BME280'],
  ['Gas', 'MQ-2'],
  ['Radio', 'SX1262 915 MHz'],
  ['Link budget', '+22 dBm SF9'],
  ['Range', '1 to 2 km'],
  ['Battery', '18650 3400 mAh'],
  ['Solar', '6 V 2 W'],
  ['Normal draw', '12 mA'],
  ['Disaster draw', '180 to 250 mA'],
  ['Runtime', '3 d / 12 to 18 h'],
]

const PRICE: [string, string][] = [
  ['Per node at 1,000', `$${Math.round(BOM_TOTAL_1K)}`],
  ['At 100', '$42'],
  ['At 1', '$60'],
]

/** Right rail: 320px, surface, no hairlines. Card, list, then the spec and price with 40px of air between groups. */
export function SpecRail({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <aside className={clsx('bg-surface flex flex-col min-h-0 overflow-y-auto', className)}>
      <div className="px-6 pt-7 pb-4">
        <PartCard />
      </div>
      <div className="px-3">
        <PartList />
      </div>
      {!compact && (
        <>
          <Rows rows={SPEC} className="pt-10" />
          <Rows rows={PRICE} className="pt-8 pb-10" />
        </>
      )}
    </aside>
  )
}

function Rows({ rows, className }: { rows: [string, string][]; className?: string }) {
  return (
    <dl className={clsx('px-7 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1.5', className)}>
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-sm text-ink-3">{k}</dt>
          <dd className="font-mono text-xs text-ink tabular-nums text-right leading-5">{v}</dd>
        </div>
      ))}
    </dl>
  )
}
