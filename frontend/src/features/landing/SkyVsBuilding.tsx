import clsx from 'clsx'
import { WRAP } from './layout'

// The discrimination rule as one chart: eight PM2.5 lines share the sky, one leaves it.
const POINTS = 64
const SPIKE_AT = 0.66
const MAX = 210
const GRID = [50, 100, 150, 200]
const NODES = ['hub', 'library', 'science', 'cafeteria', 'arts', 'gym', 'field', 'parking']

function hash(seed: string, i: number): number {
  let h = 2166136261
  const s = `${seed}:${i}`
  for (let k = 0; k < s.length; k++) {
    h ^= s.charCodeAt(k)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000 - 0.5
}

/** Regional smoke: slow climb from about 12 to about 40 µg/m³ over the window. */
function sky(p: number): number {
  return 12 + 28 * (p * p * (3 - 2 * p))
}

function series(node: string): number[] {
  const bias = 0.85 + (hash(node, 99) + 0.5) * 0.3
  return Array.from({ length: POINTS }, (_, i) => {
    const p = i / (POINTS - 1)
    let v = sky(p) * bias + hash(node, i) * 2.4
    if (node === 'gym' && p > SPIKE_AT) {
      const q = Math.min(1, (p - SPIKE_AT) / 0.16)
      v += 160 * (1 - Math.pow(1 - q, 2))
    }
    return Math.max(2, v)
  })
}

const SERIES = NODES.map((n) => ({ id: n, values: series(n) }))
const GYM_END = SERIES.find((s) => s.id === 'gym')!.values[POINTS - 1]

interface ChartProps { width: number; height: number; className?: string }

/** Axis labels sit in the left gutter, series labels in the right one, so nothing collides at any width. */
function Chart({ width: W, height: H, className }: ChartProps) {
  const PAD = { l: 34, r: 56, t: 12, b: 12 }
  const x = (i: number) => PAD.l + (i / (POINTS - 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + (1 - Math.min(v, MAX) / MAX) * (H - PAD.t - PAD.b)
  const toPath = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Eight PM2.5 lines rise slowly together over 40 minutes; the gym line spikes sharply near the end.">
      <g stroke="var(--color-line-faint)" strokeWidth={1}>
        {GRID.map((g) => <line key={g} x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} />)}
      </g>
      <g fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-ink-4)" textAnchor="end">
        {GRID.map((g) => <text key={g} x={PAD.l - 10} y={y(g) + 4}>{g}</text>)}
      </g>
      {SERIES.filter((s) => s.id !== 'gym').map((s) => (
        <path key={s.id} d={toPath(s.values)} fill="none" stroke="var(--color-ink-3)" strokeWidth={1.25} strokeLinejoin="round" opacity={0.7} />
      ))}
      {SERIES.filter((s) => s.id === 'gym').map((s) => (
        <path key={s.id} d={toPath(s.values)} fill="none" stroke="var(--color-alarm)" strokeWidth={1.75} strokeLinejoin="round" />
      ))}
      <text x={x(POINTS - 1) + 10} y={y(GYM_END) + 4} fontFamily="var(--font-sans)" fontSize={12} fill="var(--color-alarm)">gym</text>
      <text x={x(POINTS - 1) + 10} y={y(38) + 4} fontFamily="var(--font-sans)" fontSize={12} fill="var(--color-ink-3)">the rest</text>
    </svg>
  )
}

export function SkyVsBuilding() {
  return (
    <section className={clsx(WRAP, 'py-section-sm md:py-section')} aria-labelledby="sky-title">
      <h2 id="sky-title" className="display-h1 text-xl md:text-2xl text-ink max-w-[24ch]">
        One node spiking while its neighbours stay flat is a fire in that building.
      </h2>
      <p className="display-h1 text-xl md:text-2xl text-ink-3 mt-2 max-w-[24ch]">Every node climbing together is the sky.</p>
      <p className="prose-landing mt-8 max-w-[52ch]">
        Each node is compared with its radio neighbours, not with a county sensor miles away. Wildfire smoke never reads as a fire, and a fire never hides in the smoke.
      </p>
      <figure className="mt-14 md:mt-20">
        <Chart width={1120} height={300} className="w-full h-auto hidden md:block" />
        <Chart width={560} height={300} className="w-full h-auto md:hidden" />
        <figcaption className="mt-4 flex justify-between text-xs text-ink-3">
          <span>PM2.5, µg/m³, eight nodes over 40 minutes</span>
          <span className="hidden sm:inline">gym spikes at 15:11</span>
        </figcaption>
      </figure>
    </section>
  )
}
