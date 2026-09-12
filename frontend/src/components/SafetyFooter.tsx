import clsx from 'clsx'

export interface SafetyFooterProps {
  className?: string
  /** Optional links; rendered as plain text until the integrator fills them in. */
  repoUrl?: string
  devpostUrl?: string
}

const LINK = 'underline decoration-line-strong underline-offset-[3px] hover:decoration-signal'

/** DESIGN §8.1 safety footer: 911 line, designed-not-fabricated line, event line. Shared with /hardware. */
export function SafetyFooter({ className, repoUrl, devpostUrl }: SafetyFooterProps) {
  return (
    <footer className={clsx('bg-surface border-t border-line', className)}>
      <div className="max-w-[1600px] mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10">
        <p className="md:col-span-6 text-base text-ink max-w-[52ch]">
          Need help right now? Call 911. Sentinel does not replace 911 or code-required smoke detection.
        </p>
        <div className="md:col-span-6 space-y-3">
          <p className="text-sm text-ink-3 max-w-[60ch]">
            Hardware designed, not fabricated, per organizer guidance. Sensors, mesh radio and SMS are simulated in this demo. All logic is real.
          </p>
          <p className="font-mono text-2xs text-ink-3 flex flex-wrap gap-x-2">
            <span>Frontier Cascadia</span>
            <span aria-hidden>·</span>
            <span>Sept 12 2026</span>
            <span aria-hidden>·</span>
            {repoUrl ? <a href={repoUrl} className={LINK}>Repo</a> : <span>Repo</span>}
            <span aria-hidden>·</span>
            {devpostUrl ? <a href={devpostUrl} className={LINK}>Devpost</a> : <span>Devpost</span>}
          </p>
        </div>
      </div>
    </footer>
  )
}
