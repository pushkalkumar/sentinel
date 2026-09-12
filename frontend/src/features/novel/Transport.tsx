import clsx from 'clsx'
import { ChevronDown, ChevronUp, Pause, Play } from 'lucide-react'
import { fmtSim } from '@/lib/time'
import { useTimelineStore, type TimelineSpeed } from '@/store/timeline'
import { useSimStore } from '@/store/sim'

export interface TransportProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  disabled?: boolean
}

const SPEEDS: TimelineSpeed[] = [1, 10]

/** LIVE button, play/pause, 1x/10x, sim clock readout and the collapse toggle. */
export function Transport({ collapsed, onToggleCollapsed, disabled = false }: TransportProps) {
  const active = useTimelineStore((s) => s.active)
  const t = useTimelineStore((s) => s.t)
  const playing = useTimelineStore((s) => s.playing)
  const speed = useTimelineStore((s) => s.speed)
  const setPlaying = useTimelineStore((s) => s.setPlaying)
  const setSpeed = useTimelineStore((s) => s.setSpeed)
  const goLive = useTimelineStore((s) => s.goLive)
  const liveTs = useSimStore((s) => s.simState?.sim_ts ?? null)

  const shown = active && t ? t : liveTs

  return (
    <div className="h-9 shrink-0 flex items-center gap-2 px-3 border-b border-line">
      <h2 className="label-signage">Time machine</h2>
      <button
        type="button"
        onClick={goLive}
        disabled={!active}
        aria-pressed={!active}
        className={clsx(
          'inline-flex items-center gap-2 h-6 px-2 rounded-full text-xs font-medium transition-[background-color,color] duration-[120ms]',
          active ? 'bg-raised text-ink-2 hover:text-ink hairline' : 'bg-signal-dim text-signal',
        )}
        title={active ? 'Return to the live stream' : 'Showing live readings'}
      >
        <i aria-hidden className={clsx('size-1.5 rounded-full', active ? 'bg-ink-4' : 'bg-signal pulse-live')} />
        LIVE
      </button>
      {active && (
        <span className="inline-flex items-center gap-2 h-[22px] px-1.5 rounded-sm border border-dashed border-line-strong font-mono text-2xs text-ink-3 whitespace-nowrap">
          Replaying stored readings
        </span>
      )}
      <span className="ml-auto font-mono text-xs tabular-nums text-ink-2" title="Sim clock">{fmtSim(shown, 'HH:mm')}</span>
      {!collapsed && (
        <>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            disabled={disabled}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            className="inline-flex items-center justify-center size-7 rounded-sm text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-45"
          >
            {playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} />}
          </button>
          <div role="radiogroup" aria-label="Replay speed" className="inline-flex h-7 p-0.5 rounded-sm bg-raised hairline">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                disabled={disabled}
                onClick={() => setSpeed(s)}
                className={clsx(
                  'px-2 rounded-[3px] font-mono text-xs transition-[background-color,color] duration-[120ms] disabled:opacity-45',
                  speed === s ? 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-ink-2 hover:text-ink',
                )}
              >
                {s}x
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand time machine' : 'Collapse time machine'}
        className="inline-flex items-center justify-center size-7 rounded-sm text-ink-3 hover:text-ink"
      >
        {collapsed ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
      </button>
    </div>
  )
}
