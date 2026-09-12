import { useState } from 'react'
import { useNavigate } from 'react-router'
import type { CreateIncidentResponse } from '@/lib/types'
import { STATUS_LABEL } from '@/lib/types'
import { CodeCells } from '@/components/ui/CodeCells'
import { useIncidentStore } from '@/store/incidents'
import { FieldButton } from './FieldButton'

export interface CodeScreenProps {
  result: CreateIncidentResponse
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

  return (
    <div className="flex flex-col gap-6 pt-6 font-field">
      <h1 className="text-[28px] font-bold leading-tight text-f-ink">Report received</h1>

      <section aria-labelledby="your-code">
        <p id="your-code" className="text-[18px] text-f-ink-2">Your code</p>
        <h2 className="sr-only">{result.code}</h2>
        {/* 56px cells overflow the 350px column at 390 wide (six cells plus hyphen); 48px keeps them on one row. */}
        <CodeCells code={result.code} size="phone" className="mt-3 [&>span]:w-12!" />
        <p className="mt-2 text-[14px] text-f-ink-2">No zero, no letter O.</p>
      </section>

      <p className="text-[16px] text-f-ink-2">Write it on your hand. Responders have it.</p>

      <div className="flex flex-col gap-3">
        <FieldButton onClick={copy}>
          {copied === 'done' ? 'Copied' : copied === 'failed' ? 'Copy failed, write it down' : 'Copy code'}
        </FieldButton>
        <FieldButton onClick={() => navigate(`/m/status?code=${encodeURIComponent(result.code)}`)}>Check status</FieldButton>
      </div>

      <p className="text-[18px] text-f-ink" role="status" aria-live="polite">
        Status: <span className="font-semibold">{STATUS_LABEL[status]}</span>
        {result.via === 'internet' && (
          <span className="block mt-1 text-[14px] text-f-ink-2">Sent over the internet with no node stamp, so it shows as {result.trust_label === 'verified' ? 'Verified' : 'Likely at most'}.</span>
        )}
      </p>
    </div>
  )
}
