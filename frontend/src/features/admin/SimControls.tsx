import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'
import { ChevronDown, Pause, Play } from 'lucide-react'
import { useSimStore } from '@/store/sim'
import { useSessionStore } from '@/store/session'
import { useUiStore } from '@/store/ui'
import { errorText, simControl } from '@/lib/api'
import type { SimAction, SimSpeed } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'
import { fmtSim } from '@/lib/time'

const SPEEDS: { value: `${SimSpeed}`; label: string }[] = [
  { value: '1', label: '1x' }, { value: '10', label: '10x' }, { value: '60', label: '60x' }, { value: '300', label: '300x' },
]
/** The node the stage demo burns when the admin has not selected one. */
const FIRE_DEFAULT_NODE = 'gym'
const JUMPS = [
  { t: 'calm', label: 'Calm morning' },
  { t: 'smoke', label: 'Regional smoke' },
  { t: 'fire', label: 'Gym fire' },
] as const

function MenuRow({ children, onClick, disabled, loading, tone = 'default' }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean; tone?: 'default' | 'danger'
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled || loading}
      onClick={onClick}
      className={clsx(
        'w-full h-9 px-3 rounded-md flex items-center gap-2 text-sm text-left',
        'transition-[background-color,color] duration-[120ms] disabled:opacity-40 disabled:pointer-events-none',
        tone === 'danger' ? 'text-alarm hover:bg-alarm-dim' : 'text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.05)]',
      )}
    >
      {children}
      {loading && <span className="ml-auto text-xs text-ink-4">working</span>}
    </button>
  )
}

/**
 * Admin-only scenario controls, collapsed into one small menu (DESIGN_V2 §4).
 * Proxied to the simulator through the backend (CONTRACT §3.7).
 */
export function SimControls({ className }: { className?: string }) {
  const role = useSessionStore((s) => s.role)
  const sim = useSimStore((s) => s.simState)
  const connected = useSimStore((s) => s.connected)
  const selected = useUiStore((s) => s.selectedNodeId)
  const toast = useUiStore((s) => s.toast)
  const setSim = useSimStore((s) => s.setSim)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('pointerdown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  if (role !== 'admin') return null

  const send = async (label: string, action: SimAction) => {
    setBusy(label)
    setError(null)
    try {
      const s = await simControl(action)
      setSim(s)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const offline = !connected
  const playing = sim?.playing ?? false
  const phase = JUMPS.find((j) => j.t === sim?.phase)?.label ?? sim?.phase ?? 'Scenario'
  const status = offline ? 'Simulator offline' : `${phase}, ${fmtSim(sim?.sim_ts, 'HH:mm')} sim time, regional ${Math.round(sim?.regional_pm25 ?? 0)}`

  return (
    <div ref={root} className={clsx('relative', className)}>
      <Button
        variant="ghost"
        icon={playing ? Pause : Play}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="h-9 px-3 text-sm"
      >
        <span className="text-ink-2">{offline ? 'Scenario' : `Scenario: ${phase}, ${sim?.speed ?? 60}x`}</span>
        <ChevronDown size={14} strokeWidth={1.5} className={clsx('text-ink-3 transition-transform duration-[160ms]', !open && 'rotate-180')} aria-hidden />
      </Button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Scenario controls"
          className="absolute right-0 bottom-full mb-2 w-72 z-40 p-2 rounded-lg bg-overlay shadow-overlay flex flex-col gap-1"
        >
          <div className="px-3 pt-2 pb-1 text-xs text-ink-3">{status}</div>
          <MenuRow disabled={offline} loading={busy === 'play'} onClick={() => send('play', { action: playing ? 'pause' : 'play' })}>
            {playing ? <Pause size={15} strokeWidth={1.5} aria-hidden /> : <Play size={15} strokeWidth={1.5} aria-hidden />}
            {playing ? 'Pause' : 'Play'}
          </MenuRow>
          <div className="px-3 py-1 flex items-center justify-between gap-3">
            <span className="text-sm text-ink-2">Speed</span>
            <Segmented
              label="Simulation speed"
              options={SPEEDS.map((o) => ({ ...o, disabled: offline }))}
              value={`${sim?.speed ?? 60}` as `${SimSpeed}`}
              onChange={(v) => send('speed', { action: 'speed', speed: Number(v) as SimSpeed })}
              className="h-8"
            />
          </div>
          <div className="my-1 h-px bg-line" aria-hidden />
          <div className="px-3 pt-1 pb-0.5 text-xs text-ink-4">Jump to</div>
          {JUMPS.map((j) => (
            <MenuRow key={j.t} disabled={offline} loading={busy === `jump-${j.t}`} onClick={() => send(`jump-${j.t}`, { action: 'jump', t: j.t })}>
              {j.label}
            </MenuRow>
          ))}
          <div className="my-1 h-px bg-line" aria-hidden />
          {/* Never a dead end: with nothing selected the row starts a fire at the gym, the demo's node. */}
          <MenuRow
            tone="danger"
            disabled={offline}
            loading={busy === 'fire'}
            onClick={() => {
              const target = selected ?? FIRE_DEFAULT_NODE
              send('fire', { action: 'trigger_fire', node_id: target }).then(() => { toast(`Fire curve started at ${target}`); setOpen(false) })
            }}
          >
            {`Start a fire at ${selected ?? FIRE_DEFAULT_NODE}`}
          </MenuRow>
          <MenuRow disabled={offline} loading={busy === 'clear'} onClick={() => send('clear', { action: 'clear' })}>
            Clear overrides
          </MenuRow>
          {error && <p className="px-3 py-2 text-xs text-alarm">{error}</p>}
        </div>
      )}
    </div>
  )
}
