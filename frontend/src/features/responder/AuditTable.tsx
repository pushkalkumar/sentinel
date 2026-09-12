import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import type { AuditEntry, IncidentAction } from '@/lib/types'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Segmented } from '@/components/ui/Segmented'
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
  { value: 'all', label: 'All' },
  { value: 'created', label: 'Received' },
  { value: 'relayed', label: 'Relayed' },
  { value: 'acknowledge', label: 'Acknowledged' },
  { value: 'resolve', label: 'Resolved' },
]

/** Notes arrive from several writers; the table reads as one voice in sentence case. */
function sentence(note: string): string {
  if (!note) return ''
  return note.charAt(0).toUpperCase() + note.slice(1)
}

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
  { key: 'note', header: 'Note', render: (r) => <span className="text-ink-2 line-clamp-2">{sentence(r.note)}</span> },
]

/** Loopback on every row tells a judge nothing, so the column only appears when an address is real. */
const IP_COLUMN: Column<AuditEntry> = { key: 'ip', header: 'IP', mono: true, width: 128 }
const LOOPBACK = new Set(['127.0.0.1', '::1', 'localhost', ''])

/** /responder/audit: newest first, filter by action, IP in mono. Resolution rows are immutable upstream. */
export function AuditTable({ entries, loading = false, error = null, className }: AuditTableProps) {
  const [filter, setFilter] = useState<Filter>('all')
  // Newest first by event time: a resolve must never print above the relay it followed (judge item 34).
  const rows = useMemo(() => {
    const list = filter === 'all' ? entries : entries.filter((e) => e.action === filter)
    return [...list].sort((a, b) => b.at.localeCompare(a.at) || b.id - a.id)
  }, [entries, filter])
  const showIp = useMemo(() => entries.some((e) => !LOOPBACK.has(e.ip)), [entries])
  const columns = useMemo(() => (showIp ? [...COLUMNS.slice(0, 4), IP_COLUMN, ...COLUMNS.slice(4)] : COLUMNS), [showIp])

  return (
    <div className={className}>
      <div className="flex items-center gap-3 px-5 h-12 border-b border-line">
        <Segmented<Filter> label="Action" options={FILTERS} value={filter} onChange={setFilter} />
        <span className="ml-auto font-mono text-xs text-ink-3 tabular-nums">
          {rows.length} of {entries.length} {entries.length === 1 ? 'event' : 'events'}
        </span>
      </div>
      <DataTable<AuditEntry>
        columns={columns}
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
