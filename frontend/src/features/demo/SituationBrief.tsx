import { useEffect, useRef, useState } from 'react'
import { useDemoStore } from './demoStore'
import { responder } from './demoFallback'
import { AiApiError, getBrief, isModelOutput, type Brief } from '@/features/ai/aiApi'
import { useSessionStore } from '@/store/session'
import { fmtSim } from '@/lib/time'

const DEMO_SITE_ID = 1
/** The brief reads stored rows; give the chapter's writes a moment to land before asking. */
const SETTLE_MS = 1500

/** Slim card: GET /api/ai/brief on every chapter change. The template fallback shows the same way, labelled. */
export function SituationBrief() {
  const chapterSeq = useDemoStore((s) => s.chapterSeq)
  const staging = useDemoStore((s) => s.staging)
  const [brief, setBrief] = useState<Brief | null>(null)
  const [note, setNote] = useState<string | null>(null)
  const seq = useRef(0)

  useEffect(() => {
    if (staging) return
    seq.current += 1
    const mySeq = seq.current
    const timer = window.setTimeout(async () => {
      try {
        let res: Brief
        try {
          res = await getBrief(DEMO_SITE_ID, useSessionStore.getState().token)
        } catch (e) {
          // /demo often runs signed out; the brief needs a responder or admin bearer.
          if (!(e instanceof AiApiError && (e.status === 401 || e.status === 403))) throw e
          const token = await responder()
          if (!token) throw e
          res = await getBrief(DEMO_SITE_ID, token)
        }
        if (seq.current !== mySeq) return
        setBrief(res)
        setNote(null)
      } catch {
        if (seq.current !== mySeq) return
        setNote('Brief unavailable; the map and cards stand on their own.')
      }
    }, SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [chapterSeq, staging])

  const source = brief ? (isModelOutput(brief) ? 'Gemini, from stored rows' : 'template, from stored rows') : null

  return (
    <section className="bg-surface rounded-lg p-panel flex flex-col" aria-label="Situation brief">
      <header className="flex items-baseline gap-3">
        <h2 className="label-signage">Situation brief</h2>
        {brief && <span className="font-mono text-2xs text-ink-4 tabular-nums ml-auto">as of {fmtSim(brief.as_of, 'HH:mm')}</span>}
      </header>
      {brief ? (
        <>
          <p className="mt-3 text-sm text-ink-2 leading-relaxed line-clamp-3">{brief.brief}</p>
          <p className="mt-2 text-xs text-ink-4 truncate" title={brief.basis}>{source}. Verify before acting.</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-4">{note ?? 'Reading the rows…'}</p>
      )}
    </section>
  )
}
