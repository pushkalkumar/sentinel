import { AnimatePresence, motion } from 'motion/react'
import { useIncidentStore } from '@/store/incidents'
import { STATUS_LABEL } from '@/lib/types'

const EASE_ENTER: [number, number, number, number] = [0.2, 0, 0, 1]

function codeBody(code: string): string {
  const clean = code.trim().toUpperCase()
  return clean.startsWith('SN-') ? clean.slice(3) : clean
}

export interface PhoneMockProps { visible: boolean }

/** 280px field phone, light ground and system font like /m/*, showing the code the reporter just got. */
export function PhoneMock({ visible }: PhoneMockProps) {
  const inc = useIncidentStore((s) => (s.lastCreated ? s.byCode[s.lastCreated.code] ?? s.lastCreated : null))
  const show = visible && inc !== null

  return (
    <AnimatePresence>
      {show && inc && (
        <motion.div
          key={inc.code}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.28, ease: EASE_ENTER }}
          className="absolute left-6 bottom-6 w-[280px] rounded-[28px] bg-f-canvas text-f-ink font-field shadow-overlay overflow-hidden"
          data-ground="field"
          aria-label={`Phone showing report ${inc.code}`}
        >
          <div className="px-6 pt-6 pb-5">
            <div className="text-[19px] font-semibold leading-tight">Report received</div>
            <div className="mt-0.5 text-[14px] text-f-ink-2">Responders have it. This is your code.</div>
            <div className="mt-5 rounded-xl bg-f-surface px-4 pt-3.5 pb-3">
              <div className="font-field-mono text-[12px] tracking-[0.12em] text-f-ink-2/70 tabular-nums" aria-hidden>SN-</div>
              <div className="grid grid-cols-4 mt-0.5" aria-hidden>
                {codeBody(inc.code).split('').map((ch, i) => (
                  <span key={i} className="flex items-center justify-center h-[60px] font-field-mono text-[44px] font-bold leading-none tabular-nums">{ch}</span>
                ))}
              </div>
              <div className="mt-2 text-[12px] text-f-ink-2">No zero, no letter O. Write it on your hand.</div>
            </div>
            <div className="mt-4 text-[14px] text-f-ink-2" role="status" aria-live="polite">
              Status <span className="font-semibold text-f-ink">{STATUS_LABEL[inc.status]}</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
