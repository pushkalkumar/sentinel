import clsx from 'clsx'
import { PartCard } from './PartCard'
import { PartList } from './PartList'
import { BOM_TOTAL_1K } from '@/three/node/parts'

const SPEC: [string, string][] = [
  ['MCU', 'ESP32-S3'],
  ['PM', 'PMS5003'],
  ['T/RH', 'BME280'],
  ['Gas', 'MQ-2'],
  ['Radio', 'SX1262 915 MHz'],
  ['LoRa', '+22 dBm SF9'],
  ['Range', '1 to 2 km'],
  ['Power', '18650 3400 mAh'],
  ['Solar', '6 V 2 W'],
  ['Normal', '~12 mA'],
  ['Disaster', '180 to 250 mA'],
  ['Runtime', '3 d / 12 to 18 h'],
]

const BOM_TIERS: [string, string][] = [['@1000', `$${Math.round(BOM_TOTAL_1K)}`], ['@100', '$42'], ['@1', '$60']]

/** DESIGN §8.8 right rail: 320px, surface, hairline left. Card, list, spec, BOM tiers. */
export function SpecRail({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <aside className={clsx('bg-surface border-l border-line flex flex-col min-h-0 overflow-y-auto', className)}>
      <div className="p-5 border-b border-line">
        <div className="label-signage mb-3">Part</div>
        <PartCard />
      </div>
      <div className="p-3 border-b border-line">
        <PartList />
      </div>
      {!compact && (
        <>
          <dl className="px-5 py-4 border-b border-line grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            <dt className="label-signage col-span-2 mb-1">Spec</dt>
            {SPEC.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </dl>
          <dl className="px-5 py-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-xs">
            <dt className="label-signage col-span-2 mb-1">BOM per node</dt>
            {BOM_TIERS.map(([k, v]) => (
              <Row key={k} k={k} v={v} />
            ))}
          </dl>
        </>
      )}
    </aside>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-ink-3">{k}</dt>
      <dd className="text-ink tabular-nums text-right">{v}</dd>
    </>
  )
}
