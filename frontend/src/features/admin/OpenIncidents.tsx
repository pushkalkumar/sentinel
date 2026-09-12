import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'
import { STATUS_META } from '@/lib/bands'
import { relative, fmtWallZoned } from '@/lib/time'
import { Pill } from '@/components/ui/Pill'

const MAX_ROWS = 3

/** Read-only list for the admin console, two lines per incident. Responders act on /responder. */
export function OpenIncidents() {
  const order = useIncidentStore((s) => s.order)
  const byCode = useIncidentStore((s) => s.byCode)
  const open = order.map((c) => byCode[c]).filter((i) => i && isOpenIncident(i))

  if (open.length === 0) {
    return <p className="py-2 text-sm text-ink-3">None open. Reports from phones next to a node land here.</p>
  }
  const hidden = open.length - MAX_ROWS
  return (
    <ul className="flex flex-col gap-3">
      {open.slice(0, MAX_ROWS).map((inc) => (
        <li key={inc.code} className="flex flex-col gap-1">
          <div className="flex items-center gap-2 min-w-0">
            <Pill kind="code" value={inc.code} />
            <span className="text-sm text-ink truncate">
              {INCIDENT_TYPE_LABEL[inc.type]}
              {inc.count > 1 && <span className="text-ink-2">, {inc.count} people</span>}
            </span>
            <Pill kind="trust" value={inc.trust_label} className="ml-auto shrink-0" />
          </div>
          <div className="text-xs text-ink-3 truncate" title={fmtWallZoned(inc.updated_at)}>
            {inc.node_label ?? inc.node_id ?? 'Internet only'}, {STATUS_META[inc.status].label.toLowerCase()} {relative(inc.updated_at)}
          </div>
        </li>
      ))}
      {hidden > 0 && <li className="text-xs text-ink-4">{hidden} more in the responder queue</li>}
    </ul>
  )
}
