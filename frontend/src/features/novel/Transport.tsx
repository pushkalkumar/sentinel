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

const ICON_BTN = 'inline-flex items-center justify-center size-7 rounded-sm text-ink-3 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] disabled:opacity-40 transition-[color,background-color] duration-[120ms]'

/** LIVE button, play/pause, 1x/10x, sim clock readout and the collapse toggle. One row, no rule beneath it. */
export function Transport({ collapsed, onToggleCollapsed, disabled = false }: TransportProps) {
  const active = useTimelineStore((s) => s.active)
  const t = useTimelineStore((s) => s.t)
  const playing = useTimelineStore((s) => s.playing)
  const speed = useTimelineStore((s) => s.speed)
  const setPlaying = useTimelineStore((s) => s.setPlaying)
  const setSpeed = useTimelineStore((s) => s.setSpeed)
  const goLive = useTimelineStore((s) => s.goLive)
  const liveTs = useSimStore((s) => s.simState?.sim_ts ?? null)
  const simSpeed = useSimStore((s) => s.simState?.speed ?? null)

  const shown = active && t ? t : liveTs

  return (
    <div className="h-9 shrink-0 flex items-center gap-3 px-4">
      <h2 className="label-signage">Time machine</h2>
      <button
        type="button"
        onClick={goLive}
        disabled={!active}
        aria-pressed={!active}
        className={clsx(
          'inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium transition-[background-color,color] duration-[120ms]',
          active ? 'bg-raised text-ink-2 hover:text-ink' : 'text-signal',
        )}
        title={active ? 'Return to the live stream' : 'Showing live readings'}
      >
        <i aria-hidden className={clsx('size-1.5 rounded-full', active ? 'bg-ink-4' : 'bg-signal pulse-live')} />
        {active ? 'Back to live' : 'Live'}
      </button>
      {active && <span className="text-xs text-ink-3">Replaying stored readings</span>}
      {/* The only clock in this row is the simulated one, and it says so; wall time is nowhere in the console. */}
      <span className="ml-auto text-xs text-ink-2 whitespace-nowrap">
        Sim <span className="font-mono tabular-nums">{fmtSim(shown, 'HH:mm')}</span>
        {!active && simSpeed !== null && <span className="text-ink-3"> · <span className="font-mono">{simSpeed}x</span></span>}
      </span>
      {!collapsed && (
        <>
          <button
            type="button"
            onClick={() => setPlaying(!playing)}
            disabled={disabled}
            aria-label={playing ? 'Pause replay' : 'Play replay'}
            className={ICON_BTN}
          >
            {playing ? <Pause size={16} strokeWidth={1.5} /> : <Play size={16} strokeWidth={1.5} />}
          </button>
          <div role="radiogroup" aria-label="Replay speed" className="inline-flex h-7 p-0.5 rounded-md bg-raised">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                disabled={disabled}
                onClick={() => setSpeed(s)}
                className={clsx(
                  'px-2 rounded-[5px] font-mono text-xs transition-[background-color,color] duration-[120ms] disabled:opacity-40',
                  speed === s ? 'bg-overlay text-ink' : 'text-ink-3 hover:text-ink-2',
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
        className={ICON_BTN}
      >
        {collapsed ? <ChevronUp size={16} strokeWidth={1.5} /> : <ChevronDown size={16} strokeWidth={1.5} />}
      </button>
    </div>
  )
}
