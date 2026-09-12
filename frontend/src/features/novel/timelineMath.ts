// Pure helpers for the Time Machine (NOVELTY §3.1). No React, no store access.
import type { Alert, DecisionCard, DecisionLogEntry, ISO, NodeId, TimelineResponse } from '@/lib/types'
import { bandOf, BAND_META } from '@/lib/bands'
import type { TimelineFrame } from '@/store/timeline'

/** Axis runs 07:00 to 20:00 on the demo day (sim clock, UTC-formatted). */
export const DAY_START_H = 7
export const DAY_END_H = 20
export const SIM_MINUTE_MS = 60_000
/** The engine's rolling window (CONTRACT §5 default); the stored log does not carry it. */
export const ROLLING_MINUTES = 10

export interface DayBounds { startMs: number; endMs: number; day: string }

/** Demo day from the response `from`, falling back to the first reading, then today. */
export function dayBounds(data: TimelineResponse | null): DayBounds {
  const src = data?.from || data?.readings[0]?.sim_ts || new Date().toISOString()
  const day = src.slice(0, 10)
  const midnight = Date.parse(`${day}T00:00:00.000Z`)
  return { day, startMs: midnight + DAY_START_H * 3_600_000, endMs: midnight + DAY_END_H * 3_600_000 }
}

export function clampMs(ms: number, b: DayBounds): number {
  return Math.min(b.endMs, Math.max(b.startMs, ms))
}

export function msToFrac(ms: number, b: DayBounds): number {
  const span = b.endMs - b.startMs
  return span <= 0 ? 0 : Math.min(1, Math.max(0, (ms - b.startMs) / span))
}

export function fracToMs(frac: number, b: DayBounds): number {
  return b.startMs + Math.min(1, Math.max(0, frac)) * (b.endMs - b.startMs)
}

export function isoToFrac(iso: ISO, b: DayBounds): number {
  return msToFrac(Date.parse(iso), b)
}

/** Latest stored reading; scrubbing past it would only repeat the last sample. */
export function latestReadingMs(data: TimelineResponse | null): number | null {
  if (!data || data.readings.length === 0) return null
  let max = -Infinity
  for (const r of data.readings) {
    const t = Date.parse(r.sim_ts)
    if (t > max) max = t
  }
  return Number.isFinite(max) ? max : null
}

export interface MedianPoint { ms: number; pm25: number }

/** Site median PM2.5 per decimated bucket, sorted by time. Drives the sparkline behind the track. */
export function medianSeries(data: TimelineResponse | null): MedianPoint[] {
  if (!data) return []
  const buckets = new Map<string, number[]>()
  for (const r of data.readings) {
    const arr = buckets.get(r.sim_ts)
    if (arr) arr.push(r.pm25)
    else buckets.set(r.sim_ts, [r.pm25])
  }
  const out: MedianPoint[] = []
  for (const [ts, vals] of buckets) {
    const sorted = [...vals].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    const pm25 = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    out.push({ ms: Date.parse(ts), pm25 })
  }
  return out.sort((a, b) => a.ms - b.ms)
}

/** SVG path for the median sparkline inside a `w`×`h` box (use with preserveAspectRatio="none"). */
export function sparklinePath(points: MedianPoint[], b: DayBounds, w: number, h: number, pad = 2): { line: string; area: string } {
  if (points.length === 0) return { line: '', area: '' }
  const max = Math.max(10, ...points.map((p) => p.pm25))
  const xy = points.map((p) => {
    const x = msToFrac(p.ms, b) * w
    const y = h - pad - (p.pm25 / max) * (h - pad * 2)
    return [x, y] as const
  })
  const line = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const first = xy[0]
  const last = xy[xy.length - 1]
  const area = `${line} L${last[0].toFixed(1)} ${h} L${first[0].toFixed(1)} ${h} Z`
  return { line, area }
}

function nearestReadingPerNode(data: TimelineResponse, tMs: number): TimelineFrame['nodes'] {
  const best = new Map<NodeId, { dist: number; pm25: number; temp_c: number }>()
  for (const r of data.readings) {
    const dist = Math.abs(Date.parse(r.sim_ts) - tMs)
    const cur = best.get(r.node_id)
    if (!cur || dist < cur.dist) best.set(r.node_id, { dist, pm25: r.pm25, temp_c: r.temp_c })
  }
  const nodes: TimelineFrame['nodes'] = {}
  for (const [id, v] of best) nodes[id] = { pm25: v.pm25, temp_c: v.temp_c, band: bandOf(v.pm25) }
  return nodes
}

/** Latest decision at or before `t`, widened into a DecisionCard the admin card can render. */
export function cardAt(data: TimelineResponse, tMs: number, asOf: ISO): DecisionCard | null {
  const past: DecisionLogEntry[] = data.decisions
    .filter((d) => Date.parse(d.at) <= tMs)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  const latest = past[0]
  if (!latest) return null
  const meta = BAND_META[latest.band_to]
  return {
    site_id: data.site_id,
    band: latest.band_to,
    pm25: latest.pm25,
    node_id: latest.node_id,
    node_label: latest.node_label,
    headline: meta?.headline ?? latest.text,
    guidance: latest.guidance || meta?.guidance || '',
    changed_at: latest.at,
    as_of: asOf,
    window_minutes: ROLLING_MINUTES,
    log: past,
  }
}

/** Alerts open at `t`: started at or before, not yet cleared. Widened to the full Alert shape. */
export function alertsAt(data: TimelineResponse, tMs: number): Alert[] {
  const out: Alert[] = []
  for (const a of data.alerts) {
    const start = Date.parse(a.started_at)
    if (start > tMs) continue
    if (a.cleared_at && Date.parse(a.cleared_at) <= tMs) continue
    out.push({
      id: a.id, tenant_id: 0, site_id: data.site_id, zone_id: 0, node_id: a.node_id,
      kind: a.kind, priority: a.priority, band_from: null, band_to: null, reason: a.reason,
      metrics: { pm25: 0, pm_rise: 0, temp_rise: 0, gas_delta: 0, regional: 0 },
      started_at: a.started_at, cleared_at: a.cleared_at,
      node_label: a.node_label, zone_name: '',
    })
  }
  return out.sort((a, b) => a.priority - b.priority)
}

export function computeFrame(data: TimelineResponse, iso: ISO): TimelineFrame {
  const tMs = Date.parse(iso)
  return { nodes: nearestReadingPerNode(data, tMs), card: cardAt(data, tMs, iso), alerts: alertsAt(data, tMs) }
}

/** Pin colour by alert priority (BUILD_PLAN §2.11: alarm / hazardous / warn / ink-3). */
export const PIN_COLOR: Record<1 | 2 | 3 | 4, string> = {
  1: 'var(--color-alarm)', 2: 'var(--color-band-hazardous)', 3: 'var(--color-warn)', 4: 'var(--color-ink-3)',
}
