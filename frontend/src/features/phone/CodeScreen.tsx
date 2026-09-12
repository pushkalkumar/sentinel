import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { CreateIncidentResponse } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { useIncidentStore } from '@/store/incidents'
import { FieldButton } from './FieldButton'
import { SLAB } from './surface'

export interface CodeScreenProps {
  result: CreateIncidentResponse
}

function codeBody(code: string): string {
  const clean = code.trim().toUpperCase()
  return clean.startsWith('SN-') ? clean.slice(3) : clean.startsWith('SN') ? clean.slice(2) : clean
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
        <p className="text-[17px] text-f-ink-2 mt-1">Responders have it. This is your code.</p>
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
        <p className="mt-3 text-[14px] text-f-ink-2">No zero, no letter O. Write it on your hand.</p>
      </section>

      <div className="flex flex-col gap-3">
        <FieldButton variant="ink" onClick={copy}>
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed, write it down' : 'Copy code'}
        </FieldButton>
        <FieldButton onClick={() => navigate(`/m/status?code=${encodeURIComponent(result.code)}`)}>Check status</FieldButton>
      </div>

      <p className="text-[17px] text-f-ink-2" role="status" aria-live="polite">
        Status <span className="font-semibold text-f-ink">{STATUS_LABEL[status]}</span>
        {result.via === 'internet' && (
          <span className="block mt-1 text-[14px] leading-5">Sent over the internet with no node stamp, so it shows as {result.trust_label === 'verified' ? 'Verified' : 'Likely at most'}.</span>
        )}
      </p>
    </div>
  )
}
