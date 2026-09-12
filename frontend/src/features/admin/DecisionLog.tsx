import type { DecisionLogEntry } from '@/lib/types'
import { BAND_META, bandIndex } from '@/lib/bands'
import { fmtSim } from '@/lib/time'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pill } from '@/components/ui/Pill'

/**
 * The engine's verb ("improved") is wrong whenever the band index went the other way,
 * so the verb is recomputed from band_from → band_to (design item 10).
 */
function decisionText(e: DecisionLogEntry): string {
  const to = BAND_META[e.band_to].label
  if (!e.band_from) return `Monitoring started, ${to} at ${e.node_label}`
  const d = bandIndex(e.band_to) - bandIndex(e.band_from)
  if (d === 0) return `Still ${to} at ${e.node_label}`
  const verb = d > 0 ? 'Worsened to' : 'Improved to'
  return `${verb} ${to} at ${e.node_label}`
}

/** One decimal when the value sits within 1 µg/m³ of a band edge, so 9.4 never prints as "9 Moderate". */
function pm(value: number): string {
  const nearEdge = Object.values(BAND_META).some((m) => m.max !== null && Math.abs(value - m.max) < 1)
  return nearEdge ? value.toFixed(1) : String(Math.round(value))
}

const COLUMNS: Column<DecisionLogEntry>[] = [
  { key: 'at', header: 'Time', mono: true, width: 64, render: (e) => fmtSim(e.at, 'HH:mm') },
  { key: 'text', header: 'Decision', render: (e) => <span className="text-sm">{decisionText(e)}</span> },
  { key: 'pm25', header: 'PM2.5', align: 'right', mono: true, width: 64, render: (e) => pm(e.pm25) },
  { key: 'node_id', header: 'Node', mono: true, width: 90 },
  { key: 'band_to', header: 'Band', width: 130, render: (e) => <Pill kind="band" value={e.band_to} /> },
]

/** Newest first (DESIGN §8.4). */
export function DecisionLog({ entries, loading = false, error = null }: { entries: DecisionLogEntry[]; loading?: boolean; error?: string | null }) {
  const rows = [...entries].sort((a, b) => b.at.localeCompare(a.at))
  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(e) => `${e.at}-${e.node_id}-${e.band_to}`}
      loading={loading}
      error={error}
      empty="No band changes in this range. The log fills in as the site band moves."
      className="max-h-80"
    />
  )
}
