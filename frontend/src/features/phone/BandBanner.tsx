import type { NodeDetail } from '@/lib/types'
import { BAND_META } from '@/lib/bands'
import { fmtSim } from '@/lib/time'

export interface BandBannerProps {
  node: NodeDetail | null
  loading: boolean
  error: string | null
}

const WHITE = '#FFFFFF'
const INK = '#0A0908'

/** 44px strip at the top of every /m page. Solid band fill; LOCAL_FIRE or Hazardous turns it into the alarm. */
export function BandBanner({ node, loading, error }: BandBannerProps) {
  if (!node) {
    const text = loading ? 'Loading node...' : error ? error : 'No node picked · reports show Likely at most'
    return (
      <div role="status" className="h-11 flex items-center px-5 bg-f-surface border-b border-f-line text-[14px] text-f-ink-2 font-field">
        <span className="truncate">{text}</span>
      </div>
    )
  }

  const fire = node.banner.alert?.kind === 'LOCAL_FIRE'
  const hazardous = node.banner.band === 'hazardous'
  if (fire || hazardous) {
    const place = node.label.toUpperCase()
    const text = fire ? `FIRE REPORTED AT ${place} · LEAVE THE BUILDING` : `HAZARDOUS AIR AT ${place} · SHELTER INDOORS`
    return (
      <div role="alert" className="h-11 flex items-center px-5 bg-f-alarm text-white text-[20px] font-bold font-field leading-none">
        <span className="truncate">{text}</span>
      </div>
    )
  }

  const band = node.banner.band ? BAND_META[node.banner.band] : null
  const bg = band ? band.color : '#FFFFFF'
  const fg = band ? (band.inkOnSolid === INK ? INK : WHITE) : INK
  const pm = node.latest ? Math.round(node.latest.pm25) : null
  const at = node.latest?.ts ?? node.last_seen

  return (
    <div role="status" className="h-11 flex items-center justify-between gap-3 px-5 font-field" style={{ background: bg, color: fg, borderBottom: band ? undefined : '1px solid var(--color-f-line)' }}>
      <span className="flex items-center gap-2 min-w-0 text-[18px] font-semibold">
        <i aria-hidden className="size-2.5 rounded-full shrink-0" style={{ background: fg }} />
        <span className="truncate">
          {node.banner.band_label}
          {pm !== null && <span className="font-normal"> · PM2.5 {pm}</span>}
        </span>
      </span>
      <span className="shrink-0 font-field-mono text-[14px] tabular-nums opacity-90">
        {node.id} · {fmtSim(at)}
      </span>
    </div>
  )
}
