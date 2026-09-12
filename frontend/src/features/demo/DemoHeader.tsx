import { useSiteStore } from '@/store/site'
import { useSimStore } from '@/store/sim'
import { useDisplayClock } from '@/store/select'
import { fmtSim } from '@/lib/time'
import { SIM_TAG_TEXT } from '@/components/ui/SimTag'
import { useDemoStore } from './demoStore'

/** Wordmark and site at the left; the sim clock and the page's one honesty line at the right. */
export function DemoHeader() {
  const siteName = useSiteStore((s) => s.site?.name)
  const clock = useDisplayClock()
  const wsOpen = useSimStore((s) => s.wsStatus === 'open')
  const source = useDemoStore((s) => s.source)
  const honesty = source === 'stub' ? `${SIM_TAG_TEXT.nodes}. Chapters staged from the browser` : SIM_TAG_TEXT.nodes

  return (
    <header className="h-16 shrink-0 flex items-center px-8 gap-4">
      <span className="display-h1 text-[17px] font-medium tracking-tight text-ink">Sentinel</span>
      {siteName && <span className="text-sm text-ink-3 truncate">{siteName}</span>}
      <div className="ml-auto flex flex-col items-end gap-0.5">
        <span className="inline-flex items-center gap-2.5 font-mono text-lg text-ink tabular-nums" aria-label="Simulated time">
          <i aria-hidden className={wsOpen ? 'size-1.5 rounded-full bg-signal pulse-live' : 'size-1.5 rounded-full bg-ink-4'} />
          {fmtSim(clock, 'HH:mm:ss')}
        </span>
        <span className="text-xs text-ink-4">{honesty}</span>
      </div>
    </header>
  )
}
