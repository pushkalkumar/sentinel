import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { AnimatePresence, motion } from 'motion/react'
import { CampusMap } from '@/components/map/CampusMap'
import { Pill } from '@/components/ui/Pill'
import { SimTag } from '@/components/ui/SimTag'
import { BAND_META } from '@/lib/bands'
import {
  activeHops, HOP_MS, INCIDENT_CODE, LINKS, LOOP_MS, NODE_XY, STATIC_FRAME_MS, useHeroLoop,
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

function useCountUp(target: number, durationMs = 600): number {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) { fromRef.current = target; setValue(target); return }
    const start = performance.now()
    let raf = 0
    const step = () => {
      const p = Math.min(1, (performance.now() - start) / durationMs)
      const e = 1 - Math.pow(1 - p, 3)
      const v = Math.round(from + (target - from) * e)
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

function MiniDecision({ decision }: { decision: HeroDecision }) {
  const m = BAND_META[decision.band]
  const value = useCountUp(decision.pm25)
  return (
    <div className="p-5 border-b border-line">
      <div className="label-signage text-ink-3">Outdoor activity · field node</div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h3
              key={decision.headline}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
              className="display-h1 text-lg text-ink"
            >
              {decision.headline}
            </motion.h3>
          </AnimatePresence>
          <p className="mt-1 text-sm text-ink-2">{decision.guidance}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-xl leading-none tabular-nums" style={{ color: m.color }}>{value}</div>
          <div className="font-mono text-2xs text-ink-3 mt-1">PM2.5 µg/m³ 10-min</div>
          <div className="mt-2 flex justify-end"><Pill kind="band" value={decision.band} /></div>
        </div>
      </div>
      <p className="mt-4 pt-3 border-t border-line font-mono text-2xs text-ink-3 truncate" title={decision.rule}>{decision.rule}</p>
    </div>
  )
}

const TONE: Record<FeedTone, string> = {
  ink: 'text-ink-2', warn: 'text-warn', alarm: 'text-alarm', ok: 'text-ok', signal: 'text-signal',
}

function Feed({ lines }: { lines: FeedLine[] }) {
  return (
    <ol className="p-5 font-mono text-xs space-y-2 min-h-[136px]" aria-label="Incident feed">
      {lines.length === 0 && <li className="text-ink-3">Waiting for the first reading.</li>}
      {lines.map((l) => (
        <li key={l.id} className="grid grid-cols-[auto_1fr] gap-x-3 leading-4">
          <span className="text-ink-3 tabular-nums">{l.clock}</span>
          <span className="min-w-0">
            <span className={clsx('font-medium', TONE[l.tone])}>{l.label}</span>
            <span className="text-ink-2"> {l.detail}</span>
            {l.sub && (
              <span className="mt-1 flex items-center gap-2 text-ink-3">
                <span className="truncate">{l.sub.path}</span>
                <Pill kind="trust" value={l.sub.trust} />
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function HeroCard({ className }: { className?: string }) {
  const { frame, t, reduced, origin } = useHeroLoop()
  const fire = frame.nodes.some((n) => n.open_alerts.length > 0)
  return (
    <div className={clsx('relative', className)}>
      <div
        aria-hidden
        className="absolute -inset-16 pointer-events-none"
        style={{ background: 'radial-gradient(60% 50% at 50% 40%, rgba(70,210,228,0.06), transparent 70%)' }}
      />
      <section
        className="relative bg-surface hairline rounded-lg overflow-hidden"
        aria-label="Sentinel console preview"
        data-phase={frame.phase}
        data-loop-t={reduced ? STATIC_FRAME_MS : Math.round(t)}
      >
        <header className="h-10 flex items-center gap-3 px-5 border-b border-line">
          <h2 className="label-signage truncate shrink-0"><span className="hidden sm:inline">Roosevelt High · </span>8 nodes</h2>
          <div className="ml-auto flex items-center gap-4 min-w-0">
            <span className="font-mono text-xs text-ink-2 tabular-nums hidden sm:inline shrink-0" aria-label="Simulated clock">{frame.clock} PDT</span>
            <span className="inline-flex items-center gap-2 shrink-0" aria-hidden>
              <i className={clsx('size-1.5 rounded-full bg-signal', !reduced && 'pulse-live')} />
              <span className="label-signage">Live</span>
            </span>
            <SimTag kind="nodes" className="min-w-0" />
          </div>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-[62fr_38fr]">
          <div className="relative border-b md:border-b-0 md:border-r border-line bg-canvas">
            <CampusMap
              compact
              ground="campus"
              mode="mesh"
              nodes={frame.nodes}
              links={LINKS}
              highlightCode={frame.incidentStatus === 'received' ? INCIDENT_CODE : undefined}
              className="w-full h-auto"
            />
            <HopOverlay origin={origin} />
            {fire && (
              <span className="absolute left-4 bottom-3 inline-flex items-center gap-2 font-mono text-2xs text-alarm">
                <i aria-hidden className="size-1.5 rounded-full bg-alarm" />
                FIRE · gym
              </span>
            )}
            <span className="absolute right-4 bottom-3 font-mono text-2xs text-ink-4 hidden sm:block">square = gateway · circles = mesh</span>
          </div>
          <div className="min-w-0">
            <MiniDecision decision={frame.decision} />
            <Feed lines={frame.feed} />
          </div>
        </div>
      </section>
    </div>
  )
}
