// Pull statement with the "one spikes" chart: eight PM2.5 lines share the sky, one leaves it.
const W = 640
const H = 200
const PAD = { l: 8, r: 8, t: 12, b: 20 }
const POINTS = 48
const SPIKE_AT = 0.64
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
    let v = sky(p) * bias + hash(node, i) * 3
    if (node === 'gym' && p > SPIKE_AT) {
      const q = Math.min(1, (p - SPIKE_AT) / 0.18)
      v += 160 * (1 - Math.pow(1 - q, 2))
    }
    return Math.max(2, v)
  })
}

const MAX = 210
function x(i: number): number { return PAD.l + (i / (POINTS - 1)) * (W - PAD.l - PAD.r) }
function y(v: number): number { return PAD.t + (1 - Math.min(v, MAX) / MAX) * (H - PAD.t - PAD.b) }
function toPath(vals: number[]): string {
  return vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
}

const LINES = NODES.map((n) => ({ id: n, d: toPath(series(n)) }))
const GRID = [50, 100, 150, 200]

export function PullQuote() {
  return (
    <section className="py-16 md:py-24 border-t border-line" aria-labelledby="pull-title">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <blockquote className="lg:col-span-7 min-w-0">
          <p id="pull-title" className="display-h1 text-xl md:text-2xl text-ink max-w-[22ch]">
            One node spiking while its neighbours are flat is a fire in that aisle.
          </p>
          <p className="display-h1 text-xl md:text-2xl text-ink-2 mt-3 max-w-[22ch]">
            Every node climbing together is the sky.
          </p>
          <footer className="mt-6 text-sm text-ink-3 max-w-[60ch]">
            That is the whole discrimination rule. It compares each node against its radio neighbours, not against a county sensor miles away, so wildfire smoke never reads as a fire and a fire never hides in the smoke.
          </footer>
        </blockquote>
        <figure className="lg:col-span-5 min-w-0">
          <div className="hairline rounded-md bg-surface p-4">
            <div className="flex items-baseline justify-between gap-4 mb-2">
              <span className="label-signage">PM2.5 µg/m³ · 8 nodes · 40 min</span>
              <span className="font-mono text-2xs text-ink-3">gym spikes at 15:11</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Eight PM2.5 lines rise slowly together; the gym line spikes sharply near the end.">
              <g stroke="var(--color-line-faint)" strokeWidth={1}>
                {GRID.map((g) => <line key={g} x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} />)}
              </g>
              <g fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-4)">
                {GRID.map((g) => <text key={g} x={W - PAD.r} y={y(g) - 3} textAnchor="end">{g}</text>)}
              </g>
              {LINES.filter((l) => l.id !== 'gym').map((l) => (
                <path key={l.id} d={l.d} fill="none" stroke="var(--color-ink-3)" strokeWidth={1.25} strokeLinejoin="round" opacity={0.8} />
              ))}
              {LINES.filter((l) => l.id === 'gym').map((l) => (
                <path key={l.id} d={l.d} fill="none" stroke="var(--color-alarm)" strokeWidth={2} strokeLinejoin="round" />
              ))}
              <text x={x(POINTS - 1) - 4} y={y(190)} textAnchor="end" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-alarm)">gym</text>
              <text x={x(6)} y={y(24) - 8} fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-ink-2)">7 neighbours</text>
            </svg>
          </div>
          <figcaption className="mt-2 font-mono text-2xs text-ink-3">Scripted from the simulator's curve shape. Live data lives in the console.</figcaption>
        </figure>
      </div>
    </section>
  )
}
