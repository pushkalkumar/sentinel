import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { useSiteStore } from '@/store/site'
import { Pill } from '@/components/ui/Pill'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'

const MAX_ROWS = 4

/**
 * The report this session created stays at the top whatever its status (it is the story), then open
 * reports (store order is priority, then trust), then resolved ones dimmed. The WS is unfiltered, so
 * only this site's reports (or internet reports with no site) are shown.
 */
export function IncidentsPanel() {
  const siteId = useSiteStore((s) => s.site?.id)
  const rows = useIncidentStore(useShallow((s) => {
    const own = s.lastCreated ? s.byCode[s.lastCreated.code] : undefined
    const all = s.order.map((c) => s.byCode[c])
      .filter((i) => i.code !== own?.code && i.status !== 'false' && (i.site_id === null || i.site_id === siteId))
    const open = all.filter(isOpenIncident)
    const closed = all.filter((i) => !isOpenIncident(i)).sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    return [...(own ? [own] : []), ...open, ...closed].slice(0, MAX_ROWS)
  }))
  const openCount = rows.filter(isOpenIncident).length

  return (
    <section className="bg-surface rounded-lg p-panel flex flex-col min-h-0 overflow-hidden" aria-label="Incidents">
      <h2 className="label-signage">
        Incidents{openCount > 0 && <span className="ml-2 font-mono normal-case tracking-normal text-ink-4">{openCount}</span>}
      </h2>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-ink-4">No reports</p>
      ) : (
        <ul className="mt-3 flex flex-col">
          {rows.map((inc) => {
            const open = isOpenIncident(inc)
            return (
              <li
                key={inc.code}
                className={clsx('h-11 flex items-center gap-3 border-b border-line last:border-b-0 transition-opacity duration-[200ms]', !open && 'opacity-50')}
              >
                <Pill kind="code" value={inc.code} />
                <span className="text-sm text-ink truncate">{INCIDENT_TYPE_LABEL[inc.type]}{inc.count > 1 && <span className="text-ink-3"> ×{inc.count}</span>}</span>
                <span className="ml-auto flex items-center gap-2 shrink-0">
                  <Pill kind="trust" value={inc.trust_label} />
                  <Pill kind="incident" value={inc.status} dot={false} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
