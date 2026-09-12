import { useMemo, useState } from 'react'
import clsx from 'clsx'
import type { AirResponse, NodeId } from '@/lib/types'
import { BAND_META } from '@/lib/bands'
import { BAND_ORDER } from '@/lib/types'
import { fmtSim } from '@/lib/time'

const W = 1000
const H = 360
const PAD = { l: 48, r: 72, t: 16, b: 28 }

export interface AirChartProps {
  data: AirResponse
  selected: NodeId | null
  onSelect: (id: NodeId | null) => void
}

/** DESIGN §8.4: 8 hand-rolled polylines, dashed band thresholds, crosshair with a mono readout. No fills. */
export function AirChart({ data, selected, onSelect }: AirChartProps) {
  const [hover, setHover] = useState<number | null>(null)

  const { t0, t1, yMax } = useMemo(() => {
    let lo = Infinity
    let hi = -Infinity
    let max = 0
    for (const s of data.series) {
      for (const p of s.points) {
        const t = Date.parse(p.ts)
        if (t < lo) lo = t
        if (t > hi) hi = t
        if (p.pm25 > max) max = p.pm25
      }
    }
    if (!Number.isFinite(lo)) { lo = 0; hi = 1 }
    if (hi === lo) hi = lo + 60_000
    return { t0: lo, t1: hi, yMax: Math.max(60, Math.ceil((max * 1.15) / 25) * 25) }
  }, [data])

  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - Math.min(v, yMax) / yMax) * (H - PAD.t - PAD.b)

  const ticks = useMemo(() => {
    const span = t1 - t0
    const stepMs = span > 6 * 3600_000 ? 3600_000 : span > 2 * 3600_000 ? 1800_000 : 600_000
    const out: number[] = []
    for (let t = Math.ceil(t0 / stepMs) * stepMs; t <= t1; t += stepMs) out.push(t)
    return out
  }, [t0, t1])

  const hoverT = hover === null ? null : t0 + (hover / (W - PAD.l - PAD.r)) * (t1 - t0)

  const readout = useMemo(() => {
    if (hoverT === null) return null
    return data.series.map((s) => {
      let best = s.points[0]
      let bd = Infinity
      for (const p of s.points) {
        const d = Math.abs(Date.parse(p.ts) - hoverT)
        if (d < bd) { bd = d; best = p }
      }
      return { id: s.node_id, pm25: best?.pm25 ?? null }
    })
  }, [data, hoverT])

  if (data.series.length === 0 || data.series.every((s) => s.points.length === 0)) {
    return <p className="p-5 text-sm text-ink-3">No readings in this range yet. Widen the range or let the simulator run.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label="PM2.5 by node over time"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W - PAD.l
          setHover(Math.max(0, Math.min(W - PAD.l - PAD.r, px)))
        }}
        onMouseLeave={() => setHover(null)}
      >
        {/* band thresholds */}
        {BAND_ORDER.map((b) => {
          const m = BAND_META[b]
          if (m.max === null || m.max > yMax) return null
          return (
            <g key={b}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(m.max)} y2={y(m.max)} stroke="var(--color-line-faint)" strokeDasharray="4 6" />
              <text x={PAD.l - 6} y={y(m.max) + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize={11} fill={m.color}>{Math.round(m.max)}</text>
            </g>
          )
        })}
        <text x={PAD.l - 6} y={y(0) + 4} textAnchor="end" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-ink-3)">0</text>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--color-line)" />
        {/* x axis */}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(0) + 4} stroke="var(--color-line-strong)" />
            <text x={x(t)} y={H - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-ink-3)">{fmtSim(new Date(t).toISOString(), 'HH:mm')}</text>
          </g>
        ))}
        {/* regional median */}
        {data.regional.length > 1 && (
          <polyline fill="none" stroke="var(--color-ink-4)" strokeWidth={1} strokeDasharray="2 4" points={data.regional.map((p) => `${x(Date.parse(p.ts))},${y(p.pm25)}`).join(' ')} />
        )}
        {/* node lines */}
        {data.series.map((s) => {
          const isSel = selected === s.node_id
          const dim = selected !== null && !isSel
          const last = s.points[s.points.length - 1]
          return (
            <g key={s.node_id} opacity={dim ? 0.35 : isSel ? 1 : 0.7} onMouseEnter={() => onSelect(s.node_id)} className="cursor-pointer">
              <polyline
                fill="none"
                stroke={isSel ? 'var(--color-ink)' : 'var(--color-ink-2)'}
                strokeWidth={isSel ? 2 : 1.5}
                strokeLinejoin="round"
                points={s.points.map((p) => `${x(Date.parse(p.ts))},${y(p.pm25)}`).join(' ')}
              />
              {last && (isSel || selected === null) && (
                <text x={x(Date.parse(last.ts)) + 6} y={y(last.pm25) + 4} fontFamily="var(--font-mono)" fontSize={11} fill={isSel ? 'var(--color-ink)' : 'var(--color-ink-3)'}>{s.node_id}</text>
              )}
            </g>
          )
        })}
        {/* crosshair */}
        {hover !== null && hoverT !== null && (
          <g pointerEvents="none">
            <line x1={PAD.l + hover} x2={PAD.l + hover} y1={PAD.t} y2={y(0)} stroke="var(--color-signal-line)" />
            <text x={PAD.l + hover} y={PAD.t - 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-signal)">{fmtSim(new Date(hoverT).toISOString(), 'HH:mm')}</text>
          </g>
        )}
      </svg>
      <div className="flex items-start gap-4 flex-wrap px-1">
        <ul className="flex flex-wrap gap-1" aria-label="Nodes">
          <li>
            <button type="button" onMouseEnter={() => onSelect(null)} onClick={() => onSelect(null)} className={clsx('h-7 px-2 rounded-sm font-mono text-xs', selected === null ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink')}>all</button>
          </li>
          {data.series.map((s) => (
            <li key={s.node_id}>
              <button
                type="button"
                onMouseEnter={() => onSelect(s.node_id)}
                onClick={() => onSelect(s.node_id)}
                aria-pressed={selected === s.node_id}
                className={clsx('h-7 px-2 rounded-sm font-mono text-xs', selected === s.node_id ? 'bg-raised text-ink' : 'text-ink-3 hover:text-ink')}
              >
                {s.node_id}{!s.indoor && <span className="text-ink-4"> out</span>}
              </button>
            </li>
          ))}
        </ul>
        <div className="ml-auto font-mono text-xs text-ink-3 tabular-nums min-h-5">
          {readout
            ? readout.map((r) => <span key={r.id} className="mr-3">{r.id} <span className="text-ink">{r.pm25 === null ? '--' : Math.round(r.pm25)}</span></span>)
            : <span>regional median dashed · hover for readings</span>}
        </div>
      </div>
    </div>
  )
}
