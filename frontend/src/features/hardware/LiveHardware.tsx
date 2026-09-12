import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { listNodes, getMeshLog } from '@/lib/api'
import { fmtWall } from '@/lib/time'
import type { MeshLogEntry, Node } from '@/lib/types'

const FIELD = 'xenon-a'
const GATEWAY = 'xenon-b'
const SITE_ID = 1
const POLL_MS = 5000
const FRESH_S = 15            // node_a advertises every 5 s; three misses means the link is down
const TAGLINE = 'Two Particle Xenons over BLE stand in for the LoRa mesh. Same message format, one radio swapped.'

/** Polls the node and mesh-log APIs (readings are stamped with the sim clock, so "ago" is tracked here in wall time). */
function useLiveHardware() {
  const [nodes, setNodes] = useState<Record<string, Node>>({})
  const [press, setPress] = useState<MeshLogEntry | null>(null)
  const [meshDenied, setMeshDenied] = useState(false)
  const [seenAt, setSeenAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const lastSeenRef = useRef<string | null>(null)

  useEffect(() => {
    let alive = true
    const poll = async () => {
      try {
        const list = await listNodes(SITE_ID)
        if (!alive) return
        const byId = Object.fromEntries(list.filter((n) => n.id === FIELD || n.id === GATEWAY).map((n) => [n.id, n]))
        setNodes(byId)
        const seen = byId[FIELD]?.last_seen ?? null
        if (seen && seen !== lastSeenRef.current) {
          lastSeenRef.current = seen
          setSeenAt(Date.now())
        }
      } catch { /* backend down: keep the last known state */ }
      try {
        const { entries } = await getMeshLog(40)
        if (!alive) return
        const latest = entries.find((e) => e.origin_node === FIELD && (e.kind as string) === 'button' && e.status === 'delivered')
          ?? entries.find((e) => e.origin_node === FIELD && (e.kind as string) === 'button')
        setPress(latest ?? null)
        setMeshDenied(false)
      } catch { setMeshDenied(true) }   // mesh log needs a bearer token; the panel still shows readings without it
    }
    void poll()
    const timer = window.setInterval(() => void poll(), POLL_MS)
    const tick = window.setInterval(() => setNow(Date.now()), 1000)
    return () => { alive = false; window.clearInterval(timer); window.clearInterval(tick) }
  }, [])

  const ageS = seenAt === null ? null : Math.round((now - seenAt) / 1000)
  return { field: nodes[FIELD], gateway: nodes[GATEWAY], press, meshDenied, ageS }
}

function Row({ dot, label, value, sub }: { dot: 'live' | 'idle' | 'off'; label: string; value: string; sub?: string }) {
  return (
    <li className="h-9 flex items-center gap-3">
      <i
        aria-hidden
        className={clsx('shrink-0 size-1.5 rounded-full', dot === 'off' && 'border border-ink-4')}
        style={{ background: dot === 'live' ? '#5FA36A' : dot === 'idle' ? '#B9A54B' : 'transparent' }}
      />
      <span className="text-sm text-ink-2 truncate">{label}</span>
      <span className="ml-auto font-mono text-sm tabular-nums text-ink whitespace-nowrap">{value}</span>
      {sub && <span className="text-xs text-ink-3 whitespace-nowrap">{sub}</span>}
    </li>
  )
}

/** Quiet panel for the two real boards on the desk: last reading from A, last MODE press relayed through B. */
export function LiveHardware() {
  const { field, gateway, press, meshDenied, ageS } = useLiveHardware()
  const linkUp = ageS !== null && ageS <= FRESH_S
  const reading = field?.latest
  const readingText = reading
    ? `${reading.temp_c.toFixed(1)} °C · ${reading.battery_pct?.toFixed(0) ?? '--'} % · ${reading.rssi} dBm`
    : 'no reading yet'
  const ageText = ageS === null ? undefined : ageS < 2 ? 'now' : `${ageS} s ago`
  const pressText = press ? fmtWall(press.ts, 'HH:mm:ss') : meshDenied ? 'sign in to see' : 'none yet'
  const pressSub = press ? press.path.join(' → ') : undefined

  return (
    <section aria-label="Live hardware" className="rounded-md border border-line bg-raised px-4 py-3">
      <header className="flex items-baseline justify-between">
        <h3 className="text-sm text-ink">Live hardware</h3>
        <span className={clsx('text-xs', linkUp ? 'text-ink-3' : 'text-ink-4')}>
          {linkUp ? 'BLE link up' : field ? 'waiting for Xenon A' : 'nodes not seeded'}
        </span>
      </header>
      <ul className="mt-1">
        <Row
          dot={linkUp ? 'live' : field?.last_seen ? 'idle' : 'off'}
          label={field?.label ?? 'Xenon A · real hardware'}
          value={readingText}
          sub={ageText}
        />
        <Row
          dot={press ? 'live' : linkUp ? 'idle' : 'off'}
          label={gateway?.label ?? 'Xenon B · real gateway'}
          value={pressText}
          sub={pressSub}
        />
      </ul>
      <p className="mt-2 text-xs text-ink-3">{TAGLINE}</p>
    </section>
  )
}
