import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { IncidentPublic } from '@/lib/types'
import { errorText, getIncidentPublic, isApiError } from '@/lib/api'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { useIncidentStore } from '@/store/incidents'
import { StatusTimeline } from '@/features/phone/StatusTimeline'
import { FieldButton } from '@/features/phone/FieldButton'
import { CODE_ALPHABET, CODE_HINT, CODE_LEN, SLAB } from '@/features/phone/surface'

const POLL_MS = 10_000

function normaliseCode(raw: string): string {
  const c = raw.trim().toUpperCase().replace(/\s+/g, '')
  const body = c.startsWith('SN-') ? c.slice(3) : c.startsWith('SN') ? c.slice(2) : c
  return `SN-${body}`
}

/** Catches a typo before the server does: a character outside the alphabet can never be a real code. */
function codeProblem(code: string): string | null {
  const body = code.slice(3)
  const bad = [...new Set([...body].filter((ch) => !CODE_ALPHABET.includes(ch)))]
  if (bad.length > 0) return `${bad.join(', ')} ${bad.length === 1 ? 'is' : 'are'} not in the code alphabet. ${CODE_HINT}`
  if (body.length !== CODE_LEN) return `A code has ${CODE_LEN} characters after SN-. ${CODE_HINT}`
  return null
}

export default function Status() {
  const [params] = useSearchParams()
  const code = normaliseCode(params.get('code') ?? '')
  const hasCode = code.length > 3
  const problem = hasCode ? codeProblem(code) : null
  const lookup = hasCode && !problem

  const [incident, setIncident] = useState<IncidentPublic | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // WS incident_event lands in the incident store; any change for our code triggers a refetch.
  const liveUpdatedAt = useIncidentStore((s) => s.byCode[code]?.updated_at)
  const liveStatus = useIncidentStore((s) => s.byCode[code]?.status)

  const load = useCallback(async (manual = false) => {
    if (!lookup) return
    if (manual) setRefreshing(true)
    try {
      setIncident(await getIncidentPublic(code))
      setError(null)
    } catch (e) {
      if (isApiError(e, 'NOT_FOUND')) setError(`No report ${code}. ${CODE_HINT}`)
      else setError(errorText(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [code, lookup])

  useEffect(() => { void load() }, [load, liveUpdatedAt])

  useEffect(() => {
    if (!lookup) return
    const id = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [lookup, load])

  if (!hasCode) {
    return (
      <div className="flex flex-col gap-4 pt-8 font-field">
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink">No code given</h1>
        <p className="text-[17px] text-f-ink-2">Go back and enter the code from your report.</p>
        <Link to="/m" className="inline-flex items-center gap-1.5 min-h-12 text-[17px] font-medium text-f-ink">
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
        <p className="text-[15px] text-f-ink-2">{problem ? 'Check this code' : 'Your report'}</p>
        <h1 className="font-field-mono text-[40px] font-semibold leading-none tracking-[0.02em] text-f-ink tabular-nums mt-1">{code}</h1>
      </div>

      {problem && <p role="alert" className="text-[17px] leading-6 text-f-ink-2 text-pretty">{problem}</p>}

      {lookup && loading && !incident && !error && (
        <p className="text-[16px] text-f-ink-2" role="status">Looking up {code}</p>
      )}

      {error && !incident && (
        <p role="alert" className="text-[17px] leading-6 text-f-ink-2 text-pretty">{error}</p>
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

      {lookup && <FieldButton onClick={() => void load(true)} loading={refreshing}>Refresh</FieldButton>}
    </div>
  )
}
