import type { DecisionLogEntry } from '@/lib/types'
import { fmtSim } from '@/lib/time'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pill } from '@/components/ui/Pill'

const COLUMNS: Column<DecisionLogEntry>[] = [
  { key: 'at', header: 'Time', mono: true, width: 64, render: (e) => fmtSim(e.at, 'HH:mm') },
  { key: 'text', header: 'Decision', render: (e) => <span className="text-sm">{e.text || e.guidance}</span> },
  { key: 'pm25', header: 'PM2.5', align: 'right', mono: true, width: 64, render: (e) => Math.round(e.pm25) },
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
