import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import clsx from 'clsx'
import { createIncident, getIncident, getMeshLog } from '@/lib/api'
import { useSessionStore } from '@/store/session'
import type { Incident, MeshLogEntry } from '@/lib/types'

const FIELD = 'xenon-a'
const POLL_MS = 2000
const OPEN: Incident['status'][] = ['received', 'acknowledged', 'en_route', 'queued']

/**
 * Bench page for the Xenon demo. Green while quiet; a MODE press on Xenon A (bridge posts a
 * kind=button mesh message) opens a real incident at xenon-a and the screen turns red until a
 * responder resolves it. Everything on screen is the same backend the consoles use.
 */
export default function Xenon() {
  const pickNode = useSessionStore((s) => s.pickNode)
  const [incident, setIncident] = useState<Incident | null>(null)
  const [lastPress, setLastPress] = useState<MeshLogEntry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const seen = useRef<Set<string>>(new Set())
  const primed = useRef(false)
  const opening = useRef(false)

  const open = useCallback(async (press: MeshLogEntry | null) => {
    if (opening.current) return
    opening.current = true
    try {
      pickNode(FIELD)
      const res = await createIncident({ type: 'other', count: 1, text: press ? `"I'm here" button pressed on Xenon A (${press.msg_id})` : 'Manual test press' })
      const full = await getIncident(res.code)
      setIncident(full)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the incident')
    } finally {
      opening.current = false
    }
  }, [pickNode])

  // Watch the mesh log for new button presses from Xenon A. The first poll only primes the seen set.
  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const { entries } = await getMeshLog(40)
        if (!alive) return
        const presses = entries.filter((e) => e.origin_node === FIELD && (e.kind as string) === 'button')
        if (!primed.current) {
          presses.forEach((e) => seen.current.add(e.msg_id))
          primed.current = true
          return
        }
        const fresh = presses.find((e) => !seen.current.has(e.msg_id))
        if (fresh) {
          seen.current.add(fresh.msg_id)
          setLastPress(fresh)
          if (!incident || !OPEN.includes(incident.status)) void open(fresh)
        }
      } catch { /* backend hiccup: keep state */ }
    }
    void tick()
    const id = setInterval(tick, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [incident, open])

  // While an incident is open, follow it until a responder resolves it.
  useEffect(() => {
    if (!incident || !OPEN.includes(incident.status)) return
    let alive = true
    const id = setInterval(async () => {
      try {
        const full = await getIncident(incident.code)
        if (alive) setIncident(full)
      } catch { /* keep last */ }
    }, POLL_MS)
    return () => { alive = false; clearInterval(id) }
  }, [incident])

  const active = incident !== null && OPEN.includes(incident.status)
  const resolved = incident !== null && incident.status === 'resolved'

  return (
    <main
      className={clsx('min-h-dvh flex flex-col items-center justify-center text-center px-8 transition-colors duration-700', active ? 'bg-[#B3372C] text-white' : 'bg-canvas text-ink')}
    >
      <p className={clsx('label-signage', active ? 'text-white/70' : 'text-ink-3')}>Xenon A · real hardware over BLE</p>
      <h1 className="mt-6 font-display text-[clamp(48px,9vw,128px)] leading-[0.95] tracking-tight text-balance">
        {active ? 'Incident reported' : resolved ? 'Resolved' : 'Standing by'}
      </h1>
      <p className={clsx('mt-6 text-lg max-w-xl', active ? 'text-white/85' : 'text-ink-2')}>
        {active
          ? `Button pressed on Xenon A. Report ${incident.code} is ${incident.status.replace('_', ' ')}. A responder closes it from the console.`
          : resolved
            ? `Report ${incident.code} was resolved. Press the MODE button on Xenon A to report again.`
            : 'Press the MODE button on Xenon A. The press hops over BLE to Xenon B, into the gateway, and opens a report here.'}
      </p>
      {incident && (
        <p className={clsx('mt-8 font-mono text-4xl tabular-nums', active ? 'text-white' : 'text-ink')}>{incident.code}</p>
      )}
      {lastPress && (
        <p className={clsx('mt-3 font-mono text-xs', active ? 'text-white/60' : 'text-ink-4')}>
          last press {lastPress.msg_id} · {lastPress.path.join(' → ')} · {lastPress.status}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-warn">{error}</p>}
      <div className="mt-12 flex items-center gap-4 text-sm">
        <button
          type="button"
          onClick={() => void open(null)}
          disabled={active}
          className={clsx('h-10 px-4 rounded-md border', active ? 'border-white/30 text-white/50' : 'border-line text-ink-2 hover:text-ink')}
        >
          Simulate a press
        </button>
        <Link to="/responder" className={clsx('underline-offset-4 hover:underline', active ? 'text-white/80' : 'text-ink-3')}>Open responder console</Link>
      </div>
      <p className={clsx('absolute bottom-6 text-xs', active ? 'text-white/50' : 'text-ink-4')}>
        Two Particle Xenons over BLE and USB stand in for the LoRa mesh. Same message format, one radio swapped.
      </p>
    </main>
  )
}
