import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import type { MeshLogEntry } from '@/lib/types'
import { CampusView, useCampus3D } from '@/components/map/CampusView'
import { Pill } from '@/components/ui/Pill'
import {
  activeHops, HOP_MS, HOPS, INCIDENT_CODE, LINKS, LOOP_MS, NODE_XY, STATIC_FRAME_MS, useHeroLoop,
  type FeedLine, type FeedTone, type HeroDecision, type HopEvent,
} from './HeroLoop'

const DASH_LEN = 36
const DROP_AT = 0.6
const DISSOLVE_MS = 160
const FLASH_MS = 160
const TICK_MS = 800

/** Approximation of --ease-hop cubic-bezier(0.3, 0, 0.2, 1). */
function easeHop(p: number): number {
  const c = Math.min(1, Math.max(0, p))
  return 1 - Math.pow(1 - c, 2.2)
}

interface DashProps { hop: HopEvent; t: number }

function HopDash({ hop, t }: DashProps) {
  const a = NODE_XY[hop.from]
  const b = NODE_XY[hop.to]
  if (!a || !b) return null
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const elapsed = t - hop.startMs
  const baseOpacity = hop.kind === 'telemetry' ? 0.35 : 1
  const stroke = 'var(--color-signal)'

  if (hop.outcome === 'drop') {
    const travelMs = HOP_MS * DROP_AT
    const dropX = a.x + dx * DROP_AT
    const dropY = a.y + dy * DROP_AT
    if (elapsed < travelMs) {
      const p = easeHop(elapsed / travelMs) * DROP_AT
      const hx = a.x + dx * p
      const hy = a.y + dy * p
      const tail = Math.min(DASH_LEN, p * len)
      return <line className="hop-dash" x1={hx - ux * tail} y1={hy - uy * tail} x2={hx} y2={hy} stroke={stroke} strokeWidth={3} strokeLinecap="round" opacity={baseOpacity} />
    }
    if (elapsed < travelMs + DISSOLVE_MS) {
      const q = 1 - (elapsed - travelMs) / DISSOLVE_MS
      const tail = DASH_LEN * (0.3 + 0.7 * q)
      return <line className="hop-dash" x1={dropX - ux * tail} y1={dropY - uy * tail} x2={dropX} y2={dropY} stroke={stroke} strokeWidth={3} strokeLinecap="round" opacity={baseOpacity * q} />
    }
    if (elapsed < travelMs + DISSOLVE_MS + TICK_MS) {
      return (
        <g stroke="var(--color-ink-3)" strokeWidth={1.5} strokeLinecap="round">
          <line x1={dropX - 4} y1={dropY - 4} x2={dropX + 4} y2={dropY + 4} />
          <line x1={dropX + 4} y1={dropY - 4} x2={dropX - 4} y2={dropY + 4} />
        </g>
      )
    }
    return null
  }

  if (elapsed < HOP_MS) {
    const p = easeHop(elapsed / HOP_MS)
    const hx = a.x + dx * p
    const hy = a.y + dy * p
    const tail = Math.min(DASH_LEN, p * len)
    return <line className="hop-dash" x1={hx - ux * tail} y1={hy - uy * tail} x2={hx} y2={hy} stroke={stroke} strokeWidth={3} strokeLinecap="round" opacity={baseOpacity} />
  }
  if (elapsed < HOP_MS + FLASH_MS) {
    const q = 1 - (elapsed - HOP_MS) / FLASH_MS
    return <circle cx={b.x} cy={b.y} r={12} fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.6 * q * baseOpacity} />
  }
  return null
}

/** Overlays the frozen CampusMap with the traveling dashes. Same viewBox, no pointer events. */
function HopOverlay({ origin }: { origin: number | null }) {
  const [now, setNow] = useState(() => performance.now())
  const raf = useRef<number | null>(null)
  useEffect(() => {
    if (origin === null) return
    const tick = () => {
      setNow(performance.now())
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current) }
  }, [origin])
  if (origin === null) return null
  const t = (now - origin) % LOOP_MS
  const hops = activeHops(t)
  if (hops.length === 0) return null
  return (
    <svg viewBox="0 0 1000 700" className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
      {hops.map((h) => <HopDash key={h.id} hop={h} t={t} />)}
    </svg>
  )
}

/**
 * The scripted loop as mesh-log rows (CONTRACT §3.7), so the 3D scene flies the same hops the SVG
 * overlay draws. Only the incident carries the code, which is what the map rings.
 */
function meshRow(hop: HopEvent, index: number, pass: number): MeshLogEntry {
  const incident = hop.kind === 'incident'
  return {
    id: pass * HOPS.length + index,
    msg_id: `${hop.id}-${pass}`,
    origin_node: incident ? 'gym' : hop.from,
    kind: hop.kind === 'telemetry' ? 'telemetry' : 'alarm',
    hop_from: hop.from,
    hop_to: hop.to,
    attempt: 1,
    status: hop.outcome === 'drop' ? 'dropped' : 'delivered',
    path: [hop.from, hop.to],
    ttl: 8,
    payload: incident ? { code: INCIDENT_CODE } : {},
    ts: new Date().toISOString(),
  }
}

/** Emits each scripted hop once as it comes due; the 3D scene starts a pulse for every row it has not seen. */
function useScriptedMeshHops(origin: number | null, enabled: boolean): MeshLogEntry[] {
  const [rows, setRows] = useState<MeshLogEntry[]>([])
  useEffect(() => {
    if (!enabled || origin === null) {
      setRows([])
      return
    }
    let last = -1
    let pass = 0
    const id = window.setInterval(() => {
      const now = (performance.now() - origin) % LOOP_MS
      const wrapped = now < last
      if (wrapped) pass += 1
      const after = wrapped ? -1 : last
      last = now
      const due = HOPS.map((h, i) => [h, i] as const).filter(([h]) => h.startMs > after && h.startMs <= now)
      if (due.length > 0) setRows((prev) => [...prev.slice(-24), ...due.map(([h, i]) => meshRow(h, i, pass))])
    }, 80)
    return () => window.clearInterval(id)
  }, [origin, enabled])
  return rows
}

/** One large reading, one line, one pill. The guidance sentence and the rule line live in the console, not here. */
function Decision({ decision }: { decision: HeroDecision }) {
  // Number, headline and pill are one frame's state: the band is always bandOf(this number).
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="stat-number text-ink tabular-nums leading-none" style={{ fontSize: 'clamp(56px, 8cqw, 88px)' }}>{decision.pm25}</span>
        <span className="text-sm text-ink-3">PM2.5, 10 min</span>
      </div>
      <div className="mt-5 min-h-[3.6rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={decision.headline}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
            className="display-h2 text-lg @[640px]:text-[22px] @[640px]:leading-[1.3] text-ink max-w-[20ch]"
          >
            {decision.headline}
          </motion.p>
        </AnimatePresence>
      </div>
      <div className="mt-3"><Pill kind="band" value={decision.band} /></div>
    </div>
  )
}

const TONE: Record<FeedTone, string> = {
  ink: 'text-ink-2', warn: 'text-warn', alarm: 'text-alarm', ok: 'text-ok', signal: 'text-signal',
}

/** The last two log lines only. Time in ink-3, label carries the tone, detail in ink-2. */
function Feed({ lines }: { lines: FeedLine[] }) {
  const last = lines.slice(-2)
  return (
    <ol className="font-mono text-xs space-y-2" aria-label="Incident feed">
      {last.length === 0 && <li className="text-ink-3">Waiting for the first reading.</li>}
      {last.map((l) => (
        <li key={l.id} className="grid grid-cols-[auto_1fr] gap-x-3 leading-4">
          <span className="text-ink-3 tabular-nums">{l.clock}</span>
          <span className="min-w-0 truncate">
            <span className={clsx('font-medium', TONE[l.tone])}>{l.label}</span>
            <span className="text-ink-2"> {l.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Live console preview (DESIGN_V2 §4): no header row, no SIM tag, no rules. Map, reading, two log lines. */
export function HeroCard({ className }: { className?: string }) {
  const { frame, t, reduced, origin } = useHeroLoop()
  // The 3D scene animates hops itself; the SVG map needs the dash overlay on the same viewBox.
  const three = useCampus3D({ ground: 'campus' })
  const meshHops = useScriptedMeshHops(origin, three)
  return (
    <section
      className={clsx('relative bg-surface rounded-lg overflow-hidden @container shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', className)}
      aria-label="Sentinel console preview"
      data-phase={frame.phase}
      data-loop-t={reduced ? STATIC_FRAME_MS : Math.round(t)}
    >
      <div className="grid grid-cols-1 @[640px]:grid-cols-[minmax(0,56fr)_minmax(0,44fr)]">
        <div className="p-2 @[640px]:p-4">
          <div className="relative">
            <CampusView
              compact={!three}
              drift
              ground="campus"
              mode="mesh"
              labels="hover"
              nodes={frame.nodes}
              links={LINKS}
              hops={three ? meshHops : undefined}
              highlightCode={frame.incidentStatus === 'received' ? INCIDENT_CODE : undefined}
              className="w-full aspect-[10/7] rounded-md overflow-hidden"
            />
            {!three && <HopOverlay origin={origin} />}
          </div>
        </div>
        <div className="min-w-0 p-6 @[640px]:pl-6 @[640px]:pr-10 @[640px]:py-10 flex flex-col gap-8 @[640px]:gap-0">
          <Decision decision={frame.decision} />
          <div className="@[640px]:mt-auto @[640px]:pt-8">
            <Feed lines={frame.feed} />
          </div>
        </div>
      </div>
    </section>
  )
}
