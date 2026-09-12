import type { AirResponse } from '@/lib/types'
import { BAND_META, bandOf } from '@/lib/bands'
import { BAND_ORDER } from '@/lib/types'

/** One 12px bar per node, segments by band over the fetched range, hairline gaps. */
export function BandHistory({ data }: { data: AirResponse }) {
  if (data.series.length === 0) return <p className="text-sm text-ink-3">No readings in this range yet.</p>
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {data.series.map((s) => {
          const n = s.points.length
          const segs: { band: string; color: string; n: number }[] = []
          for (const p of s.points) {
            const b = bandOf(p.pm25)
            const last = segs[segs.length - 1]
            if (last && last.band === b) last.n += 1
            else segs.push({ band: b, color: BAND_META[b].color, n: 1 })
          }
          return (
            <li key={s.node_id} className="flex items-center gap-3">
              <span className="text-xs text-ink-2 w-28 truncate">{s.label}</span>
              <div className="flex-1 h-3 flex gap-px bg-line rounded-xs overflow-hidden" role="img" aria-label={`${s.label} band history`}>
                {n === 0
                  ? <span className="flex-1 bg-raised" />
                  : segs.map((g, i) => <span key={i} style={{ flexGrow: g.n, background: g.color, opacity: 0.85 }} />)}
              </div>
            </li>
          )
        })}
      </ul>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {BAND_ORDER.map((b) => (
          <li key={b} className="flex items-center gap-1.5 text-xs text-ink-3">
            <i aria-hidden className="size-2 rounded-[1px]" style={{ background: BAND_META[b].color }} />
            {BAND_META[b].label}
          </li>
        ))}
      </ul>
    </div>
  )
}
