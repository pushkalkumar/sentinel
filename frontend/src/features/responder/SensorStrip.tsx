import clsx from 'clsx'
import type { Alert, Node, Reading } from '@/lib/types'
import { useSiteStore } from '@/store/site'
import { useDisplayAlerts } from '@/store/select'
import { fmtSim } from '@/lib/time'

export interface SensorStripProps {
  node: Node | null
  /** "SENSORS AT GYM" (queue), "NODE GYM NOW", or no label when the panel header already says it. */
  heading?: 'sensors' | 'now' | 'none'
  className?: string
}

/** Readings are ~30 s sim ticks; 20 back is roughly ten sim minutes. */
const RISE_LOOKBACK = 20

function rise(list: Reading[], pick: (r: Reading) => number): number | null {
  if (list.length < 2) return null
  const latest = list[list.length - 1]
  const base = list[Math.max(0, list.length - 1 - RISE_LOOKBACK)]
  return pick(latest) - pick(base)
}

function Delta({ value, digits = 0 }: { value: number | null; digits?: number }) {
  if (value === null || Math.abs(value) < (digits ? 0.05 : 0.5)) return null
  const up = value > 0
  return (
    <span className={clsx('ml-1.5', up ? 'text-warn' : 'text-ink-3')}>
      {up ? '↑' : '↓'}{Math.abs(value).toFixed(digits)}
    </span>
  )
}

function topAlert(alerts: Alert[], nodeId: string): Alert | null {
  const mine = alerts.filter((a) => a.node_id === nodeId && !a.cleared_at).sort((a, b) => a.priority - b.priority)
  return mine[0] ?? null
}

/** DESIGN §8.5 mono strip under the map: PM2.5 with rise, temp with rise, MQ-2, open alert since. */
export function SensorStrip({ node, heading = 'sensors', className }: SensorStripProps) {
  const readings = useSiteStore((s) => (node ? s.readings[node.id] : undefined))
  const alerts = useDisplayAlerts()
  const label = heading === 'none' ? null : node
    ? heading === 'sensors' ? `Sensors at ${node.id}` : `Node ${node.id} now`
    : 'Sensors'

  if (!node) {
    return (
      <div className={clsx('h-12 px-5 flex items-center gap-6 font-mono text-xs text-ink-3 border-t border-line', className)}>
        {label && <span className="label-signage">{label}</span>}
        <span>Select an incident to see its node.</span>
      </div>
    )
  }

  const latest = node.latest
  const list = readings ?? []
  const alert = topAlert(alerts, node.id)
  return (
    <div className={clsx('min-h-12 px-5 py-2 flex items-center gap-x-6 gap-y-1 flex-wrap font-mono text-xs border-t border-line', className)}>
      {label && <span className="label-signage shrink-0">{label}</span>}
      {!latest ? (
        <span className="text-ink-3">No readings yet from this node.</span>
      ) : (
        <>
          <span className="text-ink-2">
            PM2.5 <span className="text-ink">{Math.round(latest.pm25)}</span>
            <Delta value={rise(list, (r) => r.pm25)} />
          </span>
          <span className="text-ink-2">
            temp <span className="text-ink">{latest.temp_c.toFixed(1)}</span>
            <Delta value={rise(list, (r) => r.temp_c)} digits={1} />
          </span>
          <span className="text-ink-2">
            MQ-2 <span className="text-ink">{Math.round(latest.mq2_raw)}</span>
            <Delta value={rise(list, (r) => r.mq2_raw)} />
          </span>
          <span className="text-ink-3">
            batt {latest.battery_pct}% · rssi {latest.rssi}
          </span>
        </>
      )}
      {alert && (
        <span className="ml-auto shrink-0" style={{ color: alert.priority <= 2 ? 'var(--color-alarm)' : 'var(--color-warn)' }}>
          {alert.kind} since {fmtSim(alert.started_at, 'HH:mm:ss')}
        </span>
      )}
    </div>
  )
}
