import type { AlertKind, NodeDetail } from '@/lib/types'
import { BAND_META } from '@/lib/bands'

export interface BandBannerProps {
  node: NodeDetail | null
  loading: boolean
  error: string | null
}

const WHITE = '#FFFFFF'
const INK = '#0A0908'

/**
 * One sentence of advice per alert kind. A node spiking on its own means leave the building;
 * "shelter indoors" is only ever right for regional smoke, never for a fire in this room.
 */
function advice(kind: AlertKind, label: string): string | null {
  if (kind === 'LOCAL_FIRE') return `Fire suspected at ${label}. Leave the building and go to your muster point.`
  if (kind === 'LOCAL_SMOKE_SUSPECT') return `Smoke at ${label}. Leave the building; staff are checking.`
  if (kind === 'HAZARDOUS_SMOKE') return `Hazardous air at ${label}. Shelter indoors.`
  return null
}

/** 44px strip at the top of every /m page. Solid band fill; a local alert or Hazardous turns it into the alarm. */
export function BandBanner({ node, loading, error }: BandBannerProps) {
  if (!node) {
    const text = loading ? 'Loading node' : error ? error : 'No node picked'
    return (
      <div role="status" className="h-11 flex items-center px-6 bg-f-canvas text-[15px] text-f-ink-2 font-field">
        <span className="truncate">{text}</span>
      </div>
    )
  }

  const kind = node.banner.alert?.kind ?? null
  const alarmText = kind ? advice(kind, node.label) : node.banner.band === 'hazardous' ? `Hazardous air at ${node.label}. Shelter indoors.` : null

  if (alarmText) {
    return (
      <div role="alert" className="min-h-11 flex items-center px-6 py-2 bg-f-alarm text-white text-[17px] font-semibold font-field leading-tight">
        <span>{alarmText}</span>
      </div>
    )
  }

  const band = node.banner.band ? BAND_META[node.banner.band] : null
  const bg = band ? band.color : 'var(--color-f-canvas)'
  const fg = band ? (band.inkOnSolid === INK ? INK : WHITE) : INK
  const pm = node.latest ? Math.round(node.latest.pm25) : null

  return (
    <div role="status" className="h-11 flex items-center justify-between gap-4 px-6 font-field text-[17px]" style={{ background: bg, color: fg }}>
      <span className="font-semibold truncate min-w-0">{node.banner.band_label}</span>
      {pm !== null && <span className="shrink-0 whitespace-nowrap tabular-nums opacity-80">PM2.5 {pm}</span>}
    </div>
  )
}
