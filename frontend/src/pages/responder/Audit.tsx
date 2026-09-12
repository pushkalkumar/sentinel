import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { AuditEntry } from '@/lib/types'
import { errorText, getAudit } from '@/lib/api'
import { useIncidentStore } from '@/store/incidents'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { AuditTable } from '@/features/responder/AuditTable'

export default function Audit() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fetchedAt, setFetchedAt] = useState<number | null>(null)
  // Any incident change (WS incident_event) means a new audit row; refetch on it.
  const byCode = useIncidentStore((s) => s.byCode)

  const load = useCallback(() => {
    setLoading(true)
    getAudit(200)
      .then((r) => { setEntries(r.events); setError(null); setFetchedAt(Date.now()) })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load, byCode])

  return (
    <>
      <PageHeader
        eyebrow="Responder"
        title="Audit log"
        right={<Button variant="ghost" icon={RefreshCw} onClick={load} loading={loading && entries.length > 0}>Refresh</Button>}
      />
      <Panel
        title="Every action, with actor and IP"
        meta={fetchedAt ? `newest first · ${entries.length} events` : undefined}
        padded={false}
      >
        <AuditTable entries={entries} loading={loading} error={error} />
      </Panel>
    </>
  )
}
