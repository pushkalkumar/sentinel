import { useState } from 'react'
import { Pause, Play } from 'lucide-react'
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

/** Admin-only scenario controls. Proxied to the simulator through the backend (CONTRACT §3.7). */
export function SimControls() {
  const role = useSessionStore((s) => s.role)
  const sim = useSimStore((s) => s.simState)
  const connected = useSimStore((s) => s.connected)
  const selected = useUiStore((s) => s.selectedNodeId)
  const toast = useUiStore((s) => s.toast)
  const setSim = useSimStore((s) => s.setSim)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Button
        variant="ghost"
        icon={playing ? Pause : Play}
        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
        disabled={offline}
        loading={busy === 'play'}
        onClick={() => send('play', { action: playing ? 'pause' : 'play' })}
      >
        {playing ? 'Pause' : 'Play'}
      </Button>
      <Segmented
        label="Simulation speed"
        options={SPEEDS.map((o) => ({ ...o, disabled: offline }))}
        value={`${sim?.speed ?? 60}` as `${SimSpeed}`}
        onChange={(v) => send('speed', { action: 'speed', speed: Number(v) as SimSpeed })}
      />
      <span className="hidden md:block w-px h-5 bg-line" aria-hidden />
      <span className="label-signage">Jump</span>
      {(['calm', 'smoke', 'fire'] as const).map((t) => (
        <Button key={t} variant="ghost" disabled={offline} loading={busy === `jump-${t}`} onClick={() => send(`jump-${t}`, { action: 'jump', t })}>
          {t === 'calm' ? 'Calm morning' : t === 'smoke' ? 'Regional smoke' : 'Gym fire'}
        </Button>
      ))}
      <span className="hidden md:block w-px h-5 bg-line" aria-hidden />
      <Button
        variant="danger"
        disabled={offline || !selected}
        loading={busy === 'fire'}
        title={selected ? `Start a fire curve at ${selected}` : 'Select a node on the map first'}
        onClick={() => { if (selected) send('fire', { action: 'trigger_fire', node_id: selected }).then(() => toast(`Fire curve started at ${selected}`)) }}
      >
        Trigger fire{selected ? ` at ${selected}` : ''}
      </Button>
      <Button variant="ghost" disabled={offline} loading={busy === 'clear'} onClick={() => send('clear', { action: 'clear' })}>
        Clear overrides
      </Button>
      <span className="ml-auto font-mono text-xs text-ink-3 tabular-nums">
        {offline
          ? 'simulator offline'
          : `${sim?.phase ?? ''} · sim ${fmtSim(sim?.sim_ts, 'HH:mm:ss')} · regional ${Math.round(sim?.regional_pm25 ?? 0)}`}
      </span>
      {error && <span className="basis-full text-sm text-alarm">{error}</span>}
    </div>
  )
}
