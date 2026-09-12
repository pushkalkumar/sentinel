import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { postTriage, isModelOutput, type TriageResult } from '@/features/ai/aiApi'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'
import { REPORT } from './demoFallback'

const EASE_ENTER: [number, number, number, number] = [0.2, 0, 0, 1]
const URGENCY_WORD: Record<number, string> = { 1: 'immediate', 2: 'urgent', 3: 'soon', 4: 'routine' }

/** Beside the phone mock during the report chapter: the judge's text run through POST /api/ai/triage. */
export function TriageCard({ visible }: { visible: boolean }) {
  const [result, setResult] = useState<TriageResult | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!visible) return
    let alive = true
    setFailed(false)
    postTriage({ text: REPORT.text, type: REPORT.type, count: REPORT.count })
      .then((r) => { if (alive) setResult(r) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [visible])

  const show = visible && (result !== null || failed)
  const live = result ? isModelOutput(result) : false

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key="triage"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.28, ease: EASE_ENTER, delay: 0.2 }}
          className="absolute left-[328px] bottom-6 w-[300px] rounded-lg bg-overlay px-5 py-4"
          style={{ boxShadow: 'var(--shadow-overlay)' }}
          aria-label="Report triage"
          data-testid="triage-card"
        >
          <header className="flex items-baseline gap-3">
            <h3 className="label-signage">Triage</h3>
            <span className="ml-auto text-xs text-ink-4">{live ? 'Gemini triage, human decides' : 'keyword fallback'}</span>
          </header>
          <p className="mt-2 text-xs text-ink-3 truncate" title={REPORT.text}>“{REPORT.text}”</p>
          {result ? (
            <>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                <dt className="text-ink-3">Type</dt>
                <dd className="text-ink">{INCIDENT_TYPE_LABEL[result.type]}{result.count > 1 && <span className="text-ink-3 font-mono"> ×{result.count}</span>}</dd>
                <dt className="text-ink-3">Urgency</dt>
                <dd className="text-ink"><span className="font-mono">{result.urgency}</span> <span className="text-ink-3">{URGENCY_WORD[result.urgency] ?? ''}</span></dd>
                {result.hazards && result.hazards.length > 0 && (
                  <>
                    <dt className="text-ink-3">Hazards</dt>
                    <dd className="text-ink">{result.hazards.join(', ')}</dd>
                  </>
                )}
              </dl>
              {result.english_summary && <p className="mt-3 text-sm text-ink-2 leading-snug">{result.english_summary}</p>}
              {!live && <p className="mt-3 text-xs text-ink-4">Keyword rules read the type and count. No model call.</p>}
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-4">Triage unavailable. The report stands as typed.</p>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
