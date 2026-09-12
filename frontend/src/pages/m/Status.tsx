import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { IncidentPublic } from '@/lib/types'
import { errorText, getIncidentPublic, isApiError } from '@/lib/api'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { useIncidentStore } from '@/store/incidents'
import { StatusTimeline } from '@/features/phone/StatusTimeline'
import { FieldButton } from '@/features/phone/FieldButton'
import { SLAB } from '@/features/phone/surface'

const POLL_MS = 10_000

function normaliseCode(raw: string): string {
  const c = raw.trim().toUpperCase().replace(/\s+/g, '')
  return c.startsWith('SN-') ? c : c.startsWith('SN') ? `SN-${c.slice(2)}` : `SN-${c}`
}

export default function Status() {
  const [params] = useSearchParams()
  const code = normaliseCode(params.get('code') ?? '')
  const hasCode = code.length > 3

  const [incident, setIncident] = useState<IncidentPublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // WS incident_event lands in the incident store; any change for our code triggers a refetch.
  const liveUpdatedAt = useIncidentStore((s) => s.byCode[code]?.updated_at)
  const liveStatus = useIncidentStore((s) => s.byCode[code]?.status)

  const load = useCallback(async (manual = false) => {
    if (!hasCode) return
    if (manual) setRefreshing(true)
    try {
      setIncident(await getIncidentPublic(code))
      setError(null)
    } catch (e) {
      if (isApiError(e, 'NOT_FOUND')) setError(`No report with code ${code}. Check the letters: the alphabet has no zero, no letter O, no 1, no I.`)
      else setError(errorText(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [code, hasCode])

  useEffect(() => { void load() }, [load, liveUpdatedAt])

  useEffect(() => {
    if (!hasCode) return
    const id = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [hasCode, load])

  if (!hasCode) {
    return (
      <div className="flex flex-col gap-4 pt-8 font-field">
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink">No code given</h1>
        <p className="text-[17px] text-f-ink-2">Go back and enter the code from your report.</p>
        <Link to="/m" className="inline-flex items-center gap-1.5 min-h-12 text-[17px] font-medium text-f-signal">
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden /> Back
        </Link>
      </div>
    )
  }

  const status = incident ? (liveStatus ?? incident.status) : null
  const messages = incident?.timeline.filter((e) => e.action === 'message') ?? []

  return (
    <div className="flex flex-col gap-8 pt-2 font-field">
      <Link to="/m" className="inline-flex items-center gap-1.5 min-h-12 -ml-1 px-1 text-[16px] text-f-ink-2 self-start">
        <ArrowLeft size={20} strokeWidth={1.5} aria-hidden /> Back
      </Link>

      <div>
        <p className="text-[15px] text-f-ink-2">Your report</p>
        <h1 className="font-field-mono text-[40px] font-semibold leading-none tracking-[0.02em] text-f-ink tabular-nums mt-1">{code}</h1>
      </div>

      {loading && !incident && <p className="text-[16px] text-f-ink-2">Looking up your report</p>}

      {error && !incident && (
        <p role="alert" className="text-[17px] leading-6 text-f-ink text-pretty">{error}</p>
      )}

      {incident && status && (
        <>
          <StatusTimeline status={status} timeline={incident.timeline} />

          {status === 'false' && (
            <p className="text-[16px] text-f-alarm">A responder flagged this report as false. Find a staff member if you still need help.</p>
          )}
          {status === 'resolved' && (
            <p className="text-[18px] font-medium text-f-ink">Resolved. If you still need help, send a new report.</p>
          )}

          {messages.length > 0 && (
            <section className="flex flex-col gap-3" aria-label="Messages from responders">
              {messages.map((m, i) => (
                <blockquote key={`${m.at}-${i}`} className={`${SLAB} px-5 py-4`}>
                  <p className="text-[18px] text-f-ink leading-snug text-pretty">{m.note}</p>
                  <footer className="mt-2 text-[14px] text-f-ink-2">
                    Responder, <time dateTime={m.at} title={fmtWallZoned(m.at)} className="font-field-mono tabular-nums">{fmtWall(m.at)}</time>
                  </footer>
                </blockquote>
              ))}
            </section>
          )}

          {error && <p className="text-[14px] text-f-alarm">{error}</p>}
        </>
      )}

      <FieldButton onClick={() => void load(true)} loading={refreshing}>Refresh</FieldButton>
    </div>
  )
}
