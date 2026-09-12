import clsx from 'clsx'
import type { BandKey } from '@/lib/types'
import { BAND_META } from '@/lib/bands'

export interface BandBadgeProps {
  band: BandKey
  size?: 'sm' | 'lg'
  ground?: 'dark' | 'light'
  className?: string
}

/** Band pill. Solid fill for Unhealthy and up on dark; always solid on light (DESIGN §3.4). */
export function BandBadge({ band, size = 'sm', ground = 'dark', className }: BandBadgeProps) {
  const m = BAND_META[band]
  const solid = ground === 'light' || m.solidPill
  const lightInk = band === 'unhealthy' || band === 'hazardous' ? '#FFFFFF' : '#0A0908'
  const style = solid
    ? { background: m.color, color: ground === 'light' ? lightInk : m.inkOnSolid }
    : { background: `${m.color}24`, color: m.color }
  return (
    <span
      title={m.epaName}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'lg' ? 'h-7 px-3 text-sm' : 'h-[22px] pl-1.5 pr-2 text-xs',
        ground === 'light' && 'font-field',
        className,
      )}
      style={style}
    >
      <i aria-hidden className="size-1.5 rounded-full shrink-0" style={{ background: solid ? style.color : m.color }} />
      {m.label}
    </span>
  )
}
