import clsx from 'clsx'

export interface SafetyFooterProps {
  className?: string
  /** Optional links; rendered as plain text until the integrator fills them in. */
  repoUrl?: string
  devpostUrl?: string
}

const WRAP = 'max-w-[1200px] mx-auto px-6 md:px-10'
const LINK = 'underline decoration-line-strong underline-offset-[3px] hover:decoration-ink-2 transition-colors duration-[120ms]'

/**
 * DESIGN §8.1 safety footer, shared with /hardware. The 911 line, then the one honesty line the page is allowed
 * (DESIGN_V2 §2.4): what is real, what is simulated, what is designed, in a single sentence.
 */
export function SafetyFooter({ className, repoUrl, devpostUrl }: SafetyFooterProps) {
  return (
    <footer className={clsx('pt-section-sm md:pt-section pb-12', className)}>
      <div className={clsx(WRAP, 'space-y-6')}>
        <p className="text-base text-ink max-w-[52ch]">
          Need help right now? Call 911. Sentinel does not replace 911 or code-required smoke detection.
        </p>
        <p className="text-xs text-ink-4 max-w-[76ch]">
          Hardware designed, not fabricated, per organizer guidance. In this demo the sensors are 8 virtual nodes, the mesh radio is local UDP and SMS is disabled; the alert logic, trust score and store-and-forward are real. Schematic, BOM and power budget are in the submission.
        </p>
        <p className="text-xs text-ink-3 flex flex-wrap gap-x-5 gap-y-1">
          <span>Frontier Cascadia, September 2026</span>
          {repoUrl ? <a href={repoUrl} className={LINK}>Repo</a> : <span>Repo</span>}
          {devpostUrl ? <a href={devpostUrl} className={LINK}>Devpost</a> : <span>Devpost</span>}
        </p>
      </div>
    </footer>
  )
}
