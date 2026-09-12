import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import type { CreateIncidentResponse, IncidentPublic } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { getIncidentPublic } from '@/lib/api'
import { useIncidentStore } from '@/store/incidents'
import { FieldButton } from './FieldButton'
import { CODE_HINT, SLAB } from './surface'

export interface CodeScreenProps {
  result: CreateIncidentResponse
}

const RELAY_POLL_MS = 1500

function codeBody(code: string): string {
  const clean = code.trim().toUpperCase()
  return clean.startsWith('SN-') ? clean.slice(3) : clean.startsWith('SN') ? clean.slice(2) : clean
}

/**
 * Where the report actually is. It sits on the node it was handed to until the mesh relays it,
 * so the screen says so instead of claiming a responder already has it.
 */
function RelayLine({ result }: { result: CreateIncidentResponse }) {
  const [relayNote, setRelayNote] = useState<string | null>(null)
  const place = result.node_label ?? 'the node you joined'

  useEffect(() => {
    if (result.via !== 'node' || relayNote) return
    let cancelled = false
    const read = async () => {
      try {
        const pub: IncidentPublic = await getIncidentPublic(result.code)
        const relayed = pub.timeline.find((e) => e.action === 'relayed')
        if (!cancelled && relayed) setRelayNote(relayed.note)
      } catch {
        /* keep the last state; the status page is the fallback */
      }
    }
    void read()
    const id = setInterval(() => void read(), RELAY_POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [result.code, result.via, relayNote])

  if (result.via !== 'node') {
    return <p className="text-[15px] leading-5 text-f-ink-2">Sent over the internet to the edge server.</p>
  }

  return (
    <ol className="flex flex-col gap-1 text-[15px] leading-5" aria-live="polite">
      <li className="text-f-ink">Handed to the {place} box.</li>
      <li className={relayNote ? 'text-f-ink' : 'text-f-ink-2'}>
        {relayNote ? relayNote : 'Relaying over the mesh to the gateway.'}
      </li>
      <li className={relayNote ? 'text-f-ink font-medium' : 'text-f-ink-2/70'}>
        {relayNote ? 'Responders have it.' : 'Responders see it once it lands.'}
      </li>
    </ol>
  )
}

/** DESIGN §6.9 success screen. Status line follows WS incident_event for this code. */
export function CodeScreen({ result }: CodeScreenProps) {
  const navigate = useNavigate()
  const live = useIncidentStore((s) => s.byCode[result.code])
  const status = live?.status ?? result.status
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.code)
      setCopied('done')
    } catch {
      setCopied('failed')
    }
  }

  const chars = codeBody(result.code).split('')

  return (
    <div className="flex flex-col gap-8 pt-8 font-field">
      <div>
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink">Report received</h1>
        <p className="text-[17px] text-f-ink-2 mt-1">This is your code. Write it on your hand.</p>
      </div>

      {/* DESIGN_V2 §4: bigger cells, no borders between them. One white slab, the four characters on a grid. */}
      <section aria-labelledby="your-code" className={`${SLAB} px-5 pt-5 pb-4`}>
        <h2 id="your-code" className="sr-only">{result.code}</h2>
        <div className="font-field-mono text-[15px] tracking-[0.12em] text-f-ink-2/70 tabular-nums" aria-hidden>SN-</div>
        <div className="grid grid-cols-4 mt-1" aria-hidden>
          {chars.map((ch, i) => (
            <span key={i} className="flex items-center justify-center h-[84px] font-field-mono text-[64px] font-bold leading-none text-f-ink tabular-nums">{ch}</span>
          ))}
        </div>
        <p className="mt-3 text-[14px] text-f-ink-2">{CODE_HINT}</p>
      </section>

      <RelayLine result={result} />

      <div className="flex flex-col gap-3">
        <FieldButton variant="ink" onClick={() => navigate(`/m/status?code=${encodeURIComponent(result.code)}`)}>Check status</FieldButton>
        <FieldButton onClick={copy}>
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed, write it down' : 'Copy code'}
        </FieldButton>
      </div>

      <p className="text-[17px] text-f-ink-2" role="status" aria-live="polite">
        Status <span className="font-semibold text-f-ink">{STATUS_LABEL[status]}</span>
        {result.via === 'internet' && (
          <span className="block mt-1 text-[14px] leading-5">No node stamp, so it shows as {result.trust_label === 'verified' ? 'Verified' : 'Likely at most'}.</span>
        )}
      </p>
    </div>
  )
}
