import clsx from 'clsx'
import { Link } from 'react-router'
import { useHardwareStore } from '@/store/hardware'
import type { PartId } from '@/three/node/parts'

interface BomRow { part: string; q1: string; q100: string; q1000: string; id?: PartId }

/** spec §4.1 verbatim. */
const ROWS: BomRow[] = [
  { part: 'ESP32-S3 module', q1: '$8.00', q100: '$4.50', q1000: '$3.20', id: 'esp32s3' },
  { part: 'SX1262 LoRa module + antenna', q1: '$10.00', q100: '$6.50', q1000: '$4.80', id: 'sx1262' },
  { part: 'PMS5003 PM sensor', q1: '$15.00', q100: '$11.00', q1000: '$9.00', id: 'pms5003' },
  { part: 'BME280', q1: '$3.00', q100: '$1.40', q1000: '$0.90', id: 'bme280' },
  { part: 'MQ-2 gas sensor', q1: '$2.00', q100: '$1.00', q1000: '$0.60', id: 'mq2' },
  { part: '18650 cell + holder', q1: '$5.00', q100: '$3.50', q1000: '$2.80', id: 'cell18650' },
  { part: 'TP4056 + protection + MT3608 boost', q1: '$2.50', q100: '$1.20', q1000: '$0.80', id: 'power' },
  { part: '6 V 2 W solar panel', q1: '$5.00', q100: '$3.50', q1000: '$2.60', id: 'solar' },
  { part: 'PCB, passives, connectors, MOSFETs', q1: '$4.00', q100: '$1.80', q1000: '$1.10', id: 'pcb' },
  { part: 'Button, WS2812, buzzer', q1: '$1.00', q100: '$0.50', q1000: '$0.30', id: 'button' },
  { part: 'IP65 enclosure + mount', q1: '$5.00', q100: '$3.00', q1000: '$2.20', id: 'lid' },
  { part: 'Assembly / test', q1: '$0 (hand)', q100: '$4.00', q1000: '$2.50' },
]

const TH = 'text-xs font-normal text-ink-3 text-left px-3 h-10'
const TD = 'px-3 h-11 border-t border-line'
const NUM = 'font-mono text-xs tabular-nums text-right'

/** Hairline rows only, no container, no header rule. Hovering a row lights the part in the model above. */
export function BomTable() {
  const hover = useHardwareStore((s) => s.hoverPartId)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr>
            <th className={TH}>Part</th>
            <th className={clsx(TH, 'text-right')}>Qty 1</th>
            <th className={clsx(TH, 'text-right')}>Qty 100</th>
            <th className={clsx(TH, 'text-right')}>Qty 1,000</th>
          </tr>
        </thead>
        <tbody onPointerLeave={() => useHardwareStore.getState().hover(null)}>
          {ROWS.map((r) => (
            <tr
              key={r.part}
              onPointerEnter={() => r.id && useHardwareStore.getState().hover(r.id)}
              className={clsx('transition-colors duration-[120ms]', r.id && hover === r.id ? 'bg-raised' : 'hover:bg-raised')}
            >
              <td className={clsx(TD, 'text-ink')}>
                {r.id ? <Link to={`?part=${r.id}`} className="hover:underline decoration-line-strong underline-offset-[3px]">{r.part}</Link> : r.part}
              </td>
              <td className={clsx(TD, NUM, 'text-ink-3')}>{r.q1}</td>
              <td className={clsx(TD, NUM, 'text-ink-3')}>{r.q100}</td>
              <td className={clsx(TD, NUM, 'text-ink')}>{r.q1000}</td>
            </tr>
          ))}
          <tr>
            <td className={clsx(TD, 'text-ink font-medium')}>Total</td>
            <td className={clsx(TD, NUM, 'text-ink-2')}>~$60</td>
            <td className={clsx(TD, NUM, 'text-ink-2')}>~$42</td>
            <td className={clsx(TD, NUM, 'text-ink')}>~$31</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
