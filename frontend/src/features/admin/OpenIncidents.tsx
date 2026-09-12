import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { INCIDENT_TYPE_LABEL, STATUS_LABEL } from '@/lib/types'
import { relative, fmtWallZoned } from '@/lib/time'
import { Pill } from '@/components/ui/Pill'

/** Read-only list for the admin console. Responders act on /responder. */
export function OpenIncidents() {
  const order = useIncidentStore((s) => s.order)
  const byCode = useIncidentStore((s) => s.byCode)
  const open = order.map((c) => byCode[c]).filter((i) => i && isOpenIncident(i))

  if (open.length === 0) {
    return <p className="px-5 py-4 text-sm text-ink-3">No open incidents. Reports from phones next to a node land here.</p>
  }
  return (
    <ul className="py-1">
      {open.slice(0, 6).map((inc) => (
        <li key={inc.code} className="px-5 py-2 border-b border-line last:border-b-0">
          <div className="flex items-center gap-2">
            <Pill kind="code" value={inc.code} />
            <span className="text-sm text-ink">{INCIDENT_TYPE_LABEL[inc.type]}{inc.count > 1 ? ` · ${inc.count}` : ''}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-ink-2">
            <span className="font-mono">{inc.node_id ?? 'internet'}</span>
            <Pill kind="trust" value={inc.trust_label} />
          </div>
          <div className="mt-1 text-xs text-ink-3" title={fmtWallZoned(inc.updated_at)}>
            {STATUS_LABEL[inc.status]} · {relative(inc.updated_at)}
          </div>
        </li>
      ))}
    </ul>
  )
}
