import { useCallback, useEffect, useState } from 'react'
import type { AuditEntry } from '@/lib/types'
import { errorText, getAudit } from '@/lib/api'
import { useIncidentStore } from '@/store/incidents'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { AuditTable } from '@/features/responder/AuditTable'

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedOnce, setLoadedOnce] = useState(false)
  // Any incident change (WS incident_event) means a new audit row; refetch on it.
  const byCode = useIncidentStore((s) => s.byCode)

  const load = useCallback(() => {
    setLoading(true)
    getAudit(200)
      .then((r) => { setEntries(r.events); setError(null); setLoadedOnce(true) })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load, byCode])

  return (
    <>
      {/* No Refresh button: the socket updates the log (design item 26). */}
      <PageHeader title="Audit log" />
      <Panel
        title="Actions"
        live
        meta={loadedOnce ? `${entries.length} events, newest first` : undefined}
        padded={false}
      >
        <AuditTable entries={entries} loading={loading} error={error} />
      </Panel>
    </>
  )
}
