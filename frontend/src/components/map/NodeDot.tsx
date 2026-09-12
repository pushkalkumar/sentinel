import clsx from 'clsx'
import type { Node } from '@/lib/types'
import { BAND_META } from '@/lib/bands'

export const DOT_R = 6
const OFFLINE_STROKE = '#46423D'
export const ALARM = '#FF4A3D'

export interface NodeDotProps {
  node: Node
  mode: 'air' | 'mesh'
  selected: boolean
  /** Pulse a signal ring (incident highlight). */
  highlighted?: boolean
  /** Brief signal flash after a delivered hop. */
  flash?: boolean
  compact?: boolean
  onSelect?: (id: string) => void
}

/** DESIGN §6.5: 12px dot, square for gateways, rings for alerting, double rings for LOCAL_FIRE. */
export function NodeDot({ node: n, mode, selected, highlighted = false, flash = false, compact = false, onSelect }: NodeDotProps) {
  const fire = n.open_alerts.some((a) => a.kind === 'LOCAL_FIRE')
  const alerting = !fire && n.open_alerts.length > 0
  const offline = n.status === 'offline'
  const bandColor = n.band ? BAND_META[n.band].color : OFFLINE_STROKE
  const fill = fire ? ALARM : bandColor
  const shape = {
    fill: offline ? 'none' : fill,
    stroke: offline ? OFFLINE_STROKE : 'rgba(255,255,255,0.2)',
    strokeWidth: offline ? 1.5 : 1,
  }
  const labelFill = fire ? ALARM : offline ? 'var(--color-ink-4)' : 'var(--color-ink-2)'
  return (
    <g
      transform={`translate(${n.map_x} ${n.map_y})`}
      onClick={onSelect ? () => onSelect(n.id) : undefined}
      className={clsx(onSelect && 'cursor-pointer')}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id) } } : undefined}
      aria-label={`${n.label}${fire ? ', fire' : ''}${offline ? ', offline' : ''}`}
      data-node-id={n.id}
      data-fire={fire || undefined}
    >
      {fire && (
        <>
          <circle r={12} fill="none" stroke={ALARM} strokeWidth={1.5} opacity={0.6} className="pulse-ring-alarm" />
          <circle r={18} fill="none" stroke={ALARM} strokeWidth={1} opacity={0.4} className="pulse-ring-alarm" style={{ animationDelay: '0.6s' }} />
          <circle r={12} fill="none" stroke={ALARM} strokeWidth={1} opacity={0.35} />
          <circle r={18} fill="none" stroke={ALARM} strokeWidth={1} opacity={0.2} />
        </>
      )}
      {alerting && !offline && (
        <>
          <circle r={12} fill="none" stroke={bandColor} strokeWidth={1} opacity={0.4} className="pulse-ring" />
          <circle r={12} fill="none" stroke={bandColor} strokeWidth={1} opacity={0.25} />
        </>
      )}
      {highlighted && <circle r={14} fill="none" stroke="var(--color-signal)" strokeWidth={1} opacity={0.6} className="pulse-ring" />}
      {flash && <circle r={12} fill="none" stroke="var(--color-signal)" strokeWidth={2} opacity={0.6} />}
      {selected && <circle r={10} fill="none" stroke="var(--color-signal)" strokeWidth={1} />}
      {n.is_gateway
        ? <rect x={-DOT_R} y={-DOT_R} width={DOT_R * 2} height={DOT_R * 2} rx={2} {...shape} />
        : <circle r={DOT_R} {...shape} />}
      <text x={DOT_R + 8} y={4} fontFamily="var(--font-mono)" fontSize={compact ? 13 : 11} fill={labelFill}>
        {n.id}
      </text>
      {mode === 'air' && !compact && n.latest && !offline && (
        <text x={DOT_R + 8} y={18} fontFamily="var(--font-mono)" fontSize={11} fill={fill}>
          {Math.round(n.latest.pm25)}
        </text>
      )}
    </g>
  )
}
