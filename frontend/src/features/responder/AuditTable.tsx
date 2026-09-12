import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { AuditEntry, IncidentAction } from '@/lib/types'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { fmtWall, fmtWallZoned } from '@/lib/time'

export interface AuditTableProps {
  entries: AuditEntry[]
  loading?: boolean
  error?: string | null
  /** Used to render an empty state that says where the log comes from. */
  className?: string
}

type Filter = 'all' | IncidentAction

const ACTION_LABEL: Record<IncidentAction, string> = {
  created: 'Received', relayed: 'Relayed', acknowledge: 'Acknowledged', en_route: 'En route',
  resolve: 'Resolved', flag_false: 'Flagged false', message: 'Message',
}

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'resolve', label: 'Resolved' },
  { value: 'flag_false', label: 'Flagged false' },
  { value: 'acknowledge', label: 'Acknowledged' },
  { value: 'en_route', label: 'En route' },
  { value: 'message', label: 'Messages' },
  { value: 'created', label: 'Received' },
  { value: 'relayed', label: 'Relayed' },
]

const COLUMNS: Column<AuditEntry>[] = [
  {
    key: 'at', header: 'Time', mono: true, width: 96,
    render: (r) => <time dateTime={r.at} title={fmtWallZoned(r.at)}>{fmtWall(r.at, 'HH:mm:ss')}</time>,
  },
  {
    key: 'incident_code', header: 'Incident', mono: true, width: 104,
    render: (r) => <Link to={`/responder/incident/${r.incident_code}`} className="text-ink hover:text-signal">{r.incident_code}</Link>,
  },
  { key: 'action', header: 'Action', width: 132, render: (r) => ACTION_LABEL[r.action] ?? r.action },
  {
    key: 'actor_name', header: 'Actor', width: 240,
    render: (r) => (
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="truncate">{r.actor_name ?? (r.actor_role === 'system' ? 'Sentinel' : r.actor_role === 'civilian' ? 'Reporter' : r.actor_role)}</span>
        <span className="font-mono text-2xs text-ink-3 shrink-0">{r.actor_role}</span>
      </span>
    ),
  },
  { key: 'ip', header: 'IP', mono: true, width: 128 },
  { key: 'note', header: 'Note', render: (r) => <span className="text-ink-2 line-clamp-2">{r.note}</span> },
]

/** /responder/audit: newest first, filter by action, IP in mono. Resolution rows are immutable upstream. */
export function AuditTable({ entries, loading = false, error = null, className }: AuditTableProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const rows = useMemo(
    () => (filter === 'all' ? entries : entries.filter((e) => e.action === filter)),
    [entries, filter],
  )
  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-5 h-12 border-b border-line">
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <span className="label-signage">Filter</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="h-9 rounded-sm bg-raised hairline px-2 text-sm text-ink outline-none focus:border-signal-line"
          >
            {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </label>
        <span className="ml-auto font-mono text-xs text-ink-3 tabular-nums">
          {rows.length} of {entries.length} {entries.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      <DataTable<AuditEntry>
        columns={COLUMNS}
        rows={rows}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        empty={filter === 'all' ? 'No audit events yet.' : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase() ?? ''} events.`}
        emptyAction={filter === 'all'
          ? <span className="text-ink-3">Every acknowledge, en route, resolve and flag lands here with the actor and IP.</span>
          : <button type="button" onClick={() => setFilter('all')} className="text-ink underline underline-offset-2">Show all actions</button>}
        className="max-h-[70dvh]"
      />
    </div>
  )
}
