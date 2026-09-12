import type { ExplainResponse } from '@/lib/types'

export interface NeighbourBarsProps {
  explain: ExplainResponse
  width?: number
}

const ROW_H = 18
const LABEL_W = 92
const VALUE_W = 40
const TOP_PAD = 4

/** Horizontal PM2.5 bars: this node in signal, neighbours ink-2, dashed lines at median and 2× median. */
export function NeighbourBars({ explain, width = 320 }: NeighbourBarsProps) {
  const median = explain.eval.regional
  const rows = [
    ...explain.neighbours.map((n) => ({ id: n.id, label: n.label, pm25: n.pm25, self: false })),
    { id: explain.node.id, label: explain.node.label, pm25: explain.eval.pm25, self: true },
  ].sort((a, b) => a.pm25 - b.pm25)

  if (rows.length === 0) return <p className="text-sm text-ink-3">No neighbour readings yet.</p>

  const max = Math.max(10, median * 2.2, ...rows.map((r) => r.pm25)) * 1.05
  const plotX = LABEL_W
  const plotW = Math.max(40, width - LABEL_W - VALUE_W)
  const x = (v: number) => plotX + (Math.min(v, max) / max) * plotW
  const height = TOP_PAD + rows.length * ROW_H + 4

  return (
    <div className="flex flex-col gap-1">
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={`PM2.5 at ${explain.node.label} against ${explain.neighbours.length} neighbours`} className="font-mono">
      {[1, 2].map((k) => {
        const v = median * k
        if (v <= 0 || v > max) return null
        return (
          <g key={k}>
            <line x1={x(v)} x2={x(v)} y1={TOP_PAD - 2} y2={height - 2} stroke={k === 1 ? 'var(--color-ink-3)' : 'var(--color-warn)'} strokeDasharray="3 3" strokeWidth={1} />
          </g>
        )
      })}
      {rows.map((r, i) => {
        const y = TOP_PAD + i * ROW_H
        const w = Math.max(1, x(r.pm25) - plotX)
        const fill = r.self ? 'var(--color-signal)' : 'var(--color-ink-2)'
        return (
          <g key={r.id}>
            <text x={LABEL_W - 8} y={y + 12} textAnchor="end" fontSize={10} fill={r.self ? 'var(--color-ink)' : 'var(--color-ink-2)'} fontWeight={r.self ? 600 : 400}>
              {r.id}
            </text>
            <rect x={plotX} y={y + 3} width={w} height={ROW_H - 8} rx={2} fill={fill} opacity={r.self ? 1 : 0.55} />
            <text x={x(r.pm25) + 6} y={y + 12} fontSize={10} fill={r.self ? 'var(--color-ink)' : 'var(--color-ink-3)'}>
              {r.pm25.toFixed(0)}
            </text>
          </g>
        )
      })}
    </svg>
      <div className="flex gap-4 font-mono text-2xs text-ink-3 pl-[92px]">
        <span>median {median.toFixed(0)}</span>
        <span className="text-warn">2× median {(median * 2).toFixed(0)}</span>
      </div>
    </div>
  )
}
