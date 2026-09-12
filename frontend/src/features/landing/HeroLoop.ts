// Scripted 24 s hero loop. Pure function of loop time; no backend, no stores.
// Phases: calm → smoke → gym fire → incident hop → resolved (DESIGN §8.1).
import { useEffect, useRef, useState } from 'react'
import topology from '@shared/topology.json'
import type { Alert, BandKey, Node, NodeId } from '@/lib/types'
import { BAND_META, bandOf } from '@/lib/bands'

export const LOOP_MS = 24_000
/** The hero card starts its loop this long after mount (DESIGN §7). */
export const LOOP_START_DELAY_MS = 600
/** Reduced motion shows this frame: incident delivered, log visible. */
export const STATIC_FRAME_MS = 16_500
export const HOP_MS = 220
export const SITE_ID = 1
export const INCIDENT_CODE = 'SN-7K3F'

const SIM_CLOCK_BASE_S = 15 * 3600 + 9 * 60 + 28   // 15:09:28
const SIM_SECONDS_PER_LOOP_SECOND = 8

export type HeroPhase = 'calm' | 'smoke' | 'fire' | 'incident' | 'resolved'
export type HopKind = 'telemetry' | 'alarm' | 'incident'
export type HopOutcome = 'ok' | 'drop'

export interface HopEvent {
  id: string
  from: NodeId
  to: NodeId
  /** Loop time the dash leaves `from`. */
  startMs: number
  kind: HopKind
  outcome: HopOutcome
}

export type FeedTone = 'ink' | 'warn' | 'alarm' | 'ok' | 'signal'
export interface FeedLine {
  id: string
  atMs: number
  clock: string
  label: string
  detail: string
  tone: FeedTone
  /** Second line: path + trust pill (the incident line only). */
  sub?: { path: string; trust: 'verified' }
}

export interface HeroDecision {
  band: BandKey
  pm25: number
  headline: string
  guidance: string
  rule: string
}

export interface HeroFrame {
  phase: HeroPhase
  clock: string
  nodes: Node[]
  decision: HeroDecision
  feed: FeedLine[]
  incidentStatus: 'none' | 'received' | 'resolved'
}

// ---- phase boundaries (loop ms) ---------------------------------------------
const T_SMOKE = 4_500
const T_FIRE = 12_250
const T_INCIDENT = 14_000
const T_DELIVERED = 16_000
const T_RESOLVED = 20_000

export function phaseAt(t: number): HeroPhase {
  if (t < T_SMOKE) return 'calm'
  if (t < T_FIRE) return 'smoke'
  if (t < T_INCIDENT) return 'fire'
  if (t < T_RESOLVED) return 'incident'
  return 'resolved'
}

export function simClock(t: number, withSeconds = true): string {
  const total = Math.floor(SIM_CLOCK_BASE_S + (t / 1000) * SIM_SECONDS_PER_LOOP_SECOND)
  const h = Math.floor(total / 3600) % 24
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const p = (n: number) => String(n).padStart(2, '0')
  return withSeconds ? `${p(h)}:${p(m)}:${p(s)}` : `${p(h)}:${p(m)}`
}

// ---- topology ----------------------------------------------------------------
interface TopoNode {
  id: string; label: string; zone_id: number; lat: number; lng: number; map_x: number; map_y: number
  indoor: boolean; is_gateway: boolean; floor: number | null; neighbours: string[]
  /** Real Xenon boards live in the topology too; the scripted hero shows only the eight virtual nodes. */
  hardware?: boolean
}
const SITE = topology.sites.find((s) => s.id === SITE_ID)!
const TOPO_NODES = (SITE.nodes as TopoNode[]).filter((n) => !n.hardware)
const TOPO_IDS = new Set(TOPO_NODES.map((n) => n.id))

export const NODE_IDS: NodeId[] = TOPO_NODES.map((n) => n.id)

/** Undirected links, each once. */
export const LINKS: [NodeId, NodeId][] = (() => {
  const seen = new Set<string>()
  const out: [NodeId, NodeId][] = []
  for (const n of TOPO_NODES) {
    for (const m of n.neighbours) {
      if (!TOPO_IDS.has(m)) continue
      const key = [n.id, m].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      out.push([n.id, m])
    }
  }
  return out
})()

export const NODE_XY: Record<NodeId, { x: number; y: number }> = Object.fromEntries(
  TOPO_NODES.map((n) => [n.id, { x: n.map_x, y: n.map_y }]),
)

// ---- readings ----------------------------------------------------------------
function lerp(a: number, b: number, p: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, p))
}
function ease(p: number): number {
  const c = Math.min(1, Math.max(0, p))
  return c * c * (3 - 2 * c)
}
/** Hashed deterministic noise, so the loop is identical on every visit. */
function noise(seed: string, bucket: number): number {
  let h = 2166136261
  const s = `${seed}:${bucket}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

/** Regional smoke curve: flat, then a climb over 4 s that crosses Unhealthy at T_SMOKE and holds near 71 at the field. */
function regionalPm(t: number): number {
  const climb = ease((t - (T_SMOKE - 3_500)) / 4_000)
  return lerp(7, 66, climb)
}

const FIELD_BIAS: Record<NodeId, number> = {
  field: 1.08, parking: 1.02, gym: 0.82, cafeteria: 0.9, arts: 0.86, library: 0.8, science: 0.84, hub: 0.78,
}

function pmAt(id: NodeId, t: number): number {
  const base = regionalPm(t) * (FIELD_BIAS[id] ?? 0.9) + noise(id, Math.floor(t / 800)) * 1.6
  if (id === 'gym' && t >= T_FIRE) {
    // Fire: one node spikes while its neighbours stay with the sky.
    const rise = ease((t - T_FIRE) / 1_800)
    const fade = t >= T_RESOLVED ? ease((t - T_RESOLVED) / 3_500) : 0
    return base + lerp(0, 190, rise) * (1 - fade)
  }
  return Math.max(2, base)
}

function tempAt(id: NodeId, t: number): number {
  if (id === 'gym' && t >= T_FIRE) return 21.4 + lerp(0, 9.6, ease((t - T_FIRE) / 2_400))
  return 21.4 + noise(`t-${id}`, Math.floor(t / 2_000)) * 0.6
}

function fireAlert(t: number): Alert {
  return {
    id: 9001, tenant_id: 1, site_id: SITE_ID, zone_id: 2, node_id: 'gym',
    kind: 'LOCAL_FIRE', priority: 1, band_from: 'unhealthy', band_to: 'hazardous',
    reason: 'PM2.5 rose 140 in 60 s while neighbours stayed flat; temp +6.2 °C; gas +310',
    metrics: { pm25: pmAt('gym', t), pm_rise: 140, temp_rise: 6.2, gas_delta: 310, regional: regionalPm(t) },
    started_at: '2026-09-12T22:11:06.000Z', cleared_at: null,
    node_label: 'Gymnasium', zone_name: 'Campus South',
  }
}

export function nodesAt(t: number): Node[] {
  const fire = t >= T_FIRE && t < T_RESOLVED
  return TOPO_NODES.map((n) => {
    const pm25 = pmAt(n.id, t)
    const isFire = fire && n.id === 'gym'
    return {
      id: n.id, site_id: SITE_ID, zone_id: n.zone_id, label: n.label,
      lat: n.lat, lng: n.lng, map_x: n.map_x, map_y: n.map_y,
      floor: n.floor, indoor: n.indoor, is_gateway: n.is_gateway, neighbours: n.neighbours,
      fw_version: '0.9.2', last_seen: null,
      battery_pct: 88 - Math.round(Math.abs(noise(`b-${n.id}`, 0)) * 30), rssi: -62 - Math.round(Math.abs(noise(`r-${n.id}`, 0)) * 30),
      status: isFire ? 'alert' : 'ok',
      band: bandOf(pm25),
      latest: {
        ts: '2026-09-12T22:10:00.000Z', pm1: pm25 * 0.7, pm25, pm10: pm25 * 1.2,
        temp_c: tempAt(n.id, t), rh: 41, mq2_raw: isFire ? 1290 : 980, rssi: -64, battery_pct: 84,
      },
      open_alerts: isFire ? [fireAlert(t)] : [],
    }
  })
}

// ---- decision card -----------------------------------------------------------
export function decisionAt(t: number): HeroDecision {
  // The outdoor-activity decision follows the field node's 10-minute rolling average.
  const pm25 = Math.round(pmAt('field', t))
  const band = bandOf(pm25)
  const m = BAND_META[band]
  const rule = band === 'unhealthy' || band === 'hazardous' || band === 'very_unhealthy'
    ? `Rule: band worsened Moderate → Unhealthy at ${simClock(T_SMOKE)} (ACTIVITY_ADVISORY)`
    : band === 'good'
      ? 'Rule: no band change in the last 10 min'
      : 'Rule: regional PM2.5 rising across all 8 nodes (sky, not fire)'
  return { band, pm25, headline: m.headline, guidance: m.guidance, rule }
}

// ---- feed -------------------------------------------------------------------
const FEED: FeedLine[] = [
  { id: 'f0', atMs: 300, clock: simClock(300), label: 'telemetry', detail: '8 of 8 nodes', tone: 'ink' },
  { id: 'f1', atMs: T_SMOKE - 1_200, clock: simClock(T_SMOKE - 1_200), label: 'band', detail: '→ Sensitive, field', tone: 'warn' },
  { id: 'f2', atMs: T_SMOKE, clock: simClock(T_SMOKE), label: 'band', detail: '→ Unhealthy, field', tone: 'alarm' },
  { id: 'f3', atMs: T_FIRE, clock: simClock(T_FIRE), label: 'LOCAL_FIRE', detail: 'gym, rest flat', tone: 'alarm' },
  {
    id: 'f4', atMs: T_DELIVERED, clock: simClock(T_DELIVERED), label: INCIDENT_CODE, detail: 'Trapped, 2', tone: 'signal',
    sub: { path: 'gym → science → hub', trust: 'verified' },
  },
  { id: 'f5', atMs: T_RESOLVED, clock: simClock(T_RESOLVED), label: INCIDENT_CODE, detail: 'Resolved', tone: 'ok' },
]

export function feedAt(t: number): FeedLine[] {
  return FEED.filter((l) => l.atMs <= t).slice(-4)
}

// ---- hops -------------------------------------------------------------------
/** Multi-hop path helper: one event per link, HOP_MS plus a 60 ms pause at each node. */
function path(idPrefix: string, nodes: NodeId[], startMs: number, kind: HopKind, dropAt: number | null = null): HopEvent[] {
  const out: HopEvent[] = []
  let t = startMs
  for (let i = 0; i < nodes.length - 1; i++) {
    const drop = dropAt === i
    out.push({ id: `${idPrefix}-${i}`, from: nodes[i], to: nodes[i + 1], startMs: t, kind, outcome: drop ? 'drop' : 'ok' })
    if (drop) break
    t += HOP_MS + 60
  }
  return out
}

export const HOPS: HopEvent[] = [
  // Calm telemetry: the map breathes at 35 percent.
  ...path('t1', ['field', 'cafeteria', 'hub'], 300, 'telemetry'),
  ...path('t2', ['parking', 'arts', 'library', 'hub'], 1_900, 'telemetry'),
  ...path('t3', ['gym', 'science', 'hub'], 3_400, 'telemetry'),
  ...path('t4', ['field', 'cafeteria', 'hub'], 5_200, 'telemetry'),
  ...path('t5', ['arts', 'library', 'hub'], 6_900, 'telemetry'),
  ...path('t6', ['science', 'hub'], 8_300, 'telemetry'),
  ...path('t7', ['field', 'cafeteria', 'hub'], 9_800, 'telemetry'),
  ...path('t8', ['parking', 'arts', 'library', 'hub'], 11_000, 'telemetry'),
  // Fire alarm leaves the gym at priority 1.
  ...path('a1', ['gym', 'science', 'hub'], T_FIRE + 200, 'alarm'),
  // Incident: first attempt drops on science → hub, retry 1.2 s later lands.
  ...path('i1', ['gym', 'science', 'hub'], T_INCIDENT, 'incident', 1),
  ...path('i2', ['science', 'hub'], T_INCIDENT + HOP_MS + 60 + 1_200, 'incident'),
  // Resolution relays back out, then telemetry resumes.
  ...path('r1', ['hub', 'science', 'gym'], T_RESOLVED + 150, 'incident'),
  ...path('t9', ['field', 'cafeteria', 'hub'], 21_600, 'telemetry'),
  ...path('t10', ['arts', 'library', 'hub'], 22_800, 'telemetry'),
]

/** Hop dash visible window (travel, then landing flash or drop tick). */
export const HOP_VISIBLE_MS = HOP_MS + 800

export function activeHops(t: number): HopEvent[] {
  return HOPS.filter((h) => t >= h.startMs && t < h.startMs + HOP_VISIBLE_MS)
}

export function frameAt(t: number): HeroFrame {
  const phase = phaseAt(t)
  return {
    phase,
    clock: simClock(t),
    nodes: nodesAt(t),
    decision: decisionAt(t),
    feed: feedAt(t),
    incidentStatus: t < T_DELIVERED ? 'none' : t < T_RESOLVED ? 'received' : 'resolved',
  }
}

// ---- hook -------------------------------------------------------------------
const FRAME_TICK_MS = 250

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export interface HeroLoopState {
  frame: HeroFrame
  /** Loop time in ms, wrapped to [0, LOOP_MS). Frozen at STATIC_FRAME_MS under reduced motion. */
  t: number
  reduced: boolean
  /** performance.now() at loop t=0, for per-frame hop math. Null until started or when reduced. */
  origin: number | null
}

/** Drives the scripted loop. Frame state updates 4x a second; hop dashes read `origin` on rAF. */
export function useHeroLoop(): HeroLoopState {
  const reduced = usePrefersReducedMotion()
  const [origin, setOrigin] = useState<number | null>(null)
  const [t, setT] = useState(reduced ? STATIC_FRAME_MS : 0)
  const originRef = useRef<number | null>(null)

  useEffect(() => {
    if (reduced) {
      originRef.current = null
      setOrigin(null)
      setT(STATIC_FRAME_MS)
      return
    }
    let interval: number | undefined
    const start = window.setTimeout(() => {
      const o = performance.now()
      originRef.current = o
      setOrigin(o)
      setT(0)
      interval = window.setInterval(() => {
        if (originRef.current === null) return
        setT((performance.now() - originRef.current) % LOOP_MS)
      }, FRAME_TICK_MS)
    }, LOOP_START_DELAY_MS)
    return () => {
      window.clearTimeout(start)
      if (interval !== undefined) window.clearInterval(interval)
    }
  }, [reduced])

  return { frame: frameAt(t), t, reduced, origin }
}
