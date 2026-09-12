import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { Incident, ResponderAction } from '@/lib/types'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'
import { errorText, getIncident, isApiError, postIncidentEvent } from '@/lib/api'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { useIncidentStore } from '@/store/incidents'
import { useSessionStore } from '@/store/session'
import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import { useDisplayAlerts, useDisplayNodes } from '@/store/select'
import { CodeCells } from '@/components/ui/CodeCells'
import { Panel } from '@/components/ui/Panel'
import { Pill } from '@/components/ui/Pill'
import { Skeleton } from '@/components/ui/Skeleton'
import { Timeline } from '@/components/ui/Timeline'
import { TrustMeter } from '@/components/ui/TrustMeter'
import { ActionsRail } from '@/features/responder/ActionsRail'
import { MessageBox } from '@/features/responder/MessageBox'
import { SensorStrip } from '@/features/responder/SensorStrip'
import { WhereCrop } from '@/features/responder/WhereCrop'
import { WeaDraftModal } from '@/features/novel/WeaDraftModal'

function normaliseCode(raw: string | undefined): string {
  const c = (raw ?? '').trim().toUpperCase()
  return c.startsWith('SN-') ? c : `SN-${c}`
}

export default function IncidentDetail() {
  const { code: rawCode } = useParams()
  const code = normaliseCode(rawCode)

  const fromStore = useIncidentStore((s) => s.byCode[code])
  const upsert = useIncidentStore((s) => s.upsert)
  const role = useSessionStore((s) => s.role)
  const userId = useSessionStore((s) => s.user?.id ?? null)
  const siteName = useSiteStore((s) => s.site?.name)
  const siteId = useSiteStore((s) => s.site?.id)
  const toast = useUiStore((s) => s.toast)
  const openWea = useUiStore((s) => s.openWea)
  const alerts = useDisplayAlerts()
  const nodes = useDisplayNodes()

  const [fetched, setFetched] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(!fromStore)
  const [error, setError] = useState<string | null>(null)

  // The store is the live copy (WS incident_event keeps it fresh); the fetch fills closed or unseen codes.
  useEffect(() => {
    let cancelled = false
    setLoading(!fromStore)
    setError(null)
    getIncident(code)
      .then((inc) => { if (!cancelled) { setFetched(inc); upsert(inc) } })
      .catch((e) => {
        if (cancelled) return
        setError(isApiError(e, 'NOT_FOUND') ? `No incident with code ${code}. Check the four characters after SN.` : errorText(e))
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [code, upsert]) // eslint-disable-line react-hooks/exhaustive-deps -- fromStore only seeds the loading flag

  const inc = fromStore ?? fetched
  const node = useMemo(() => (inc?.node_id ? nodes.find((n) => n.id === inc.node_id) ?? null : null), [nodes, inc])

  const weaAlertId = useMemo(() => {
    if (!inc?.node_id) return null
    const a = alerts
      .filter((x) => x.node_id === inc.node_id && !x.cleared_at && x.priority <= 2)
      .sort((x, y) => x.priority - y.priority)[0]
    return a?.id ?? null
  }, [alerts, inc])

  const act = useCallback(async (action: ResponderAction, note: string) => {
    try {
      const updated = await postIncidentEvent(code, { action, note })
      upsert(updated)
      if (action === 'resolve') toast(`Incident ${code} resolved`)
      if (action === 'flag_false') toast(`Incident ${code} flagged false`)
      if (action === 'message') toast('Message sent to the reporter')
    } catch (e) {
      if (isApiError(e, 'INVALID_TRANSITION')) throw new Error('Another responder changed this incident first. The page has the latest state.')
      throw new Error(errorText(e))
    }
  }, [code, upsert, toast])

  const back = (
    <Link to="/responder" className="inline-flex items-center gap-2 h-14 text-sm text-ink-2 hover:text-ink">
      <ArrowLeft size={16} strokeWidth={1.5} aria-hidden /> Queue
    </Link>
  )

  if (loading && !inc) {
    return <>{back}<div className="p-6"><Skeleton className="w-72" /></div></>
  }
  if (!inc) {
    return (
      <>
        {back}
        <div className="py-12 text-center">
          <h1 className="font-mono text-xl text-ink">{code}</h1>
          <p className="mt-3 text-sm text-alarm">{error ?? 'Could not load this incident.'}</p>
          <Link to="/responder" className="inline-block mt-4 text-sm text-ink underline underline-offset-2">Back to the queue</Link>
        </div>
      </>
    )
  }

  const canAct = role === 'responder'
  const closed = inc.status === 'resolved' || inc.status === 'false'
  const where = inc.via === 'internet' ? 'Internet only' : `Via node ${inc.node_id ?? '?'}`
  const site = inc.site_id !== null && inc.site_id === siteId ? siteName : null
  const count = inc.type === 'safe' ? null : `${inc.count} ${inc.count === 1 ? 'person' : 'people'}`

  return (
    <>
      {back}
      <div className="grid gap-4 lg:grid-cols-[58fr_42fr] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="bg-surface rounded-lg p-panel flex flex-col gap-4">
            <h1 className="sr-only">{inc.code}</h1>
            <CodeCells code={inc.code} size="desktop" />
            <div className="flex items-center gap-3 flex-wrap">
              <span className="display-h2 text-lg text-ink">
                {INCIDENT_TYPE_LABEL[inc.type]}
                {count && <span className="text-ink-2">, {count}</span>}
              </span>
              <Pill kind="trust" value={inc.trust_label} />
              <span className="font-mono text-md text-ink tabular-nums">{inc.trust_score}</span>
              <Pill kind="incident" value={inc.status} className="ml-auto" />
            </div>
            {inc.text && <blockquote className="text-sm text-ink border-l-2 border-line-strong pl-3">“{inc.text}”</blockquote>}
            <p className="text-sm text-ink-3">
              {[where, inc.node_label, site].filter(Boolean).join(', ')} at{' '}
              <time className="font-mono text-xs text-ink-2" dateTime={inc.created_at} title={fmtWallZoned(inc.created_at)}>{fmtWall(inc.created_at, 'HH:mm:ss')}</time>
              {inc.mesh && `, ${inc.mesh.hops} ${inc.mesh.hops === 1 ? 'hop' : 'hops'} ${inc.mesh.delivered ? 'delivered' : 'in flight'}`}
            </p>
          </section>

          <Panel title="Timeline" meta={`${inc.events.length} ${inc.events.length === 1 ? 'event' : 'events'}`}>
            {inc.events.length === 0 ? (
              <p className="text-sm text-ink-3">No events yet.</p>
            ) : (
              <Timeline events={inc.events} />
            )}
            <MessageBox
              className="mt-5 pt-4 border-t border-line"
              onSend={(text) => act('message', text)}
              disabled={inc.status === 'false'}
              disabledReason="Flagged false. Messages are closed."
            />
          </Panel>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <Panel title="Actions" meta={closed ? 'locked' : undefined}>
            <ActionsRail
              incident={inc}
              canAct={canAct}
              weaAlertId={weaAlertId}
              onAction={act}
              onDraftWea={openWea}
              currentUserId={userId}
            />
          </Panel>
          <Panel title="Trust">
            <TrustMeter score={inc.trust_score} label={inc.trust_label} breakdown={inc.trust_breakdown} />
          </Panel>
          <Panel title="Where">
            <WhereCrop incident={inc} />
          </Panel>
          <Panel title="Node now">
            <SensorStrip node={node} className="py-0 min-h-0" />
          </Panel>
        </div>
      </div>
      <WeaDraftModal />
    </>
  )
}
