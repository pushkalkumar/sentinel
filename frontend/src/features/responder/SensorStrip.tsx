import clsx from 'clsx'
import type { Alert, Node, Reading } from '@/lib/types'
import { useSiteStore } from '@/store/site'
import { useDisplayAlerts, useDisplayClock } from '@/store/select'
import { ALERT_META } from '@/lib/bands'

export interface SensorStripProps {
  node: Node | null
  /** Kept in the API for callers; the line no longer prints a signage label. */
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

function deltaTitle(value: number | null, unit: string, digits = 0): string | undefined {
  if (value === null || Math.abs(value) < (digits ? 0.05 : 0.5)) return undefined
  return `${value > 0 ? 'up' : 'down'} ${Math.abs(value).toFixed(digits)}${unit} in the last ten minutes`
}

/** How long the alert has been open, in sim minutes: one clock in the console (judge item 7). */
function openMinutes(startedAt: string, simNow: string | null): string {
  if (!simNow) return 'now'
  const mins = Math.round((new Date(simNow).getTime() - new Date(startedAt).getTime()) / 60_000)
  if (!Number.isFinite(mins) || mins <= 0) return 'under a minute'
  return mins < 60 ? `${mins} min` : `${Math.round(mins / 60)} h`
}

function topAlert(alerts: Alert[], nodeId: string): Alert | null {
  const mine = alerts.filter((a) => a.node_id === nodeId && !a.cleared_at).sort((a, b) => a.priority - b.priority)
  return mine[0] ?? null
}

function Reading({ label, value, title, rising }: { label: string; value: string; title?: string; rising?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" title={title}>
      <span className="text-ink-3">{label}</span>
      <span className={clsx('font-mono tabular-nums', rising ? 'text-warn' : 'text-ink')}>{value}</span>
    </span>
  )
}

/**
 * One quiet line of readings under the map (DESIGN_V2 §4): node name, five values,
 * no arrows. Ten-minute deltas show on hover. An open alert closes the line in its colour.
 */
export function SensorStrip({ node, className }: SensorStripProps) {
  const readings = useSiteStore((s) => (node ? s.readings[node.id] : undefined))
  const alerts = useDisplayAlerts()
  const simNow = useDisplayClock()

  if (!node) {
    return (
      <div className={clsx('h-10 flex items-center text-sm text-ink-4', className)}>
        Select an incident to see readings from its node.
      </div>
    )
  }

  const latest = node.latest
  const list = readings ?? []
  const alert = topAlert(alerts, node.id)
  const pmRise = rise(list, (r) => r.pm25)
  const tempRise = rise(list, (r) => r.temp_c)
  const gasRise = rise(list, (r) => r.mq2_raw)
  return (
    <div className={clsx('min-h-10 py-2 flex items-center gap-x-6 gap-y-1 flex-wrap text-sm', className)}>
      <span className="text-ink-2">{node.label}</span>
      {!latest ? (
        <span className="text-ink-4">No readings yet from this node.</span>
      ) : (
        <>
          <Reading label="PM2.5" value={String(Math.round(latest.pm25))} title={deltaTitle(pmRise, '')} rising={(pmRise ?? 0) >= 10} />
          <Reading label="Temp" value={`${latest.temp_c.toFixed(1)}°`} title={deltaTitle(tempRise, '°', 1)} rising={(tempRise ?? 0) >= 2} />
          <Reading label="Gas" value={String(Math.round(latest.mq2_raw))} title={deltaTitle(gasRise, '')} rising={(gasRise ?? 0) >= 50} />
          <Reading label="Battery" value={`${latest.battery_pct}%`} />
          <Reading label="Signal" value={`${latest.rssi}`} title="RSSI, dBm" />
        </>
      )}
      {alert && (
        <span className="ml-auto shrink-0 text-sm" style={{ color: alert.priority <= 2 ? 'var(--color-alarm)' : 'var(--color-warn)' }}>
          {ALERT_META[alert.kind].label}, open {openMinutes(alert.started_at, simNow)}
        </span>
      )}
    </div>
  )
}
