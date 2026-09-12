import clsx from 'clsx'
import type { Node } from '@/lib/types'
import { BAND_META } from '@/lib/bands'

export const DOT_R = 6
const HIT_R = 22
const OFFLINE_STROKE = '#46423D'
export const ALARM = '#E0574B'
/** SVG transforms default to transform-box: view-box, so the pulse-ring scale would pivot around the map centre and the rings drift off the node. */
const PULSE_STYLE = { transformBox: 'fill-box', transformOrigin: 'center' } as const

export type LabelMode = 'always' | 'hover'

export interface NodeDotProps {
  node: Node
  mode: 'air' | 'mesh'
  selected: boolean
  /** Pulse a signal ring (incident highlight). */
  highlighted?: boolean
  /** Brief signal flash after a delivered hop. */
  flash?: boolean
  compact?: boolean
  /** `hover` (default) keeps the map quiet: labels only for the gateway and for selected, alerting or hovered nodes. */
  labels?: LabelMode
  onSelect?: (id: string) => void
}

/** DESIGN §6.5, muted per DESIGN_V2: 6px dot with a darker ring, square for gateways, one calm ring for alerting, two for LOCAL_FIRE. */
export function NodeDot({ node: n, mode, selected, highlighted = false, flash = false, compact = false, labels = 'hover', onSelect }: NodeDotProps) {
  const fire = n.open_alerts.some((a) => a.kind === 'LOCAL_FIRE')
  const alerting = !fire && n.open_alerts.length > 0
  const offline = n.status === 'offline'
  const bandColor = n.band ? BAND_META[n.band].color : OFFLINE_STROKE
  const fill = fire ? ALARM : bandColor
  const shape = {
    fill: offline ? 'none' : fill,
    stroke: offline ? OFFLINE_STROKE : 'rgba(11,10,9,0.7)',
    strokeWidth: 1,
  }
  const labelFill = fire ? ALARM : offline ? 'var(--color-ink-4)' : 'var(--color-ink-2)'
  const quiet = labels === 'hover' && !selected && !fire && !alerting && !n.is_gateway
  const labelClass = quiet
    ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-[120ms] pointer-events-none'
    : undefined
  return (
    <g
      transform={`translate(${n.map_x} ${n.map_y})`}
      onClick={onSelect ? () => onSelect(n.id) : undefined}
      className={clsx('group outline-none', onSelect && 'cursor-pointer')}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(n.id) } } : undefined}
      aria-label={`${n.label}${fire ? ', fire' : ''}${offline ? ', offline' : ''}`}
      data-node-id={n.id}
      data-fire={fire || undefined}
    >
      {/* generous hit area so hover labels are easy to reach */}
      <circle r={HIT_R} fill="transparent" />
      {fire && (
        <>
          <circle r={12} fill="none" stroke={ALARM} strokeWidth={1} opacity={0.5} className="pulse-ring-alarm" style={PULSE_STYLE} />
          <circle r={18} fill="none" stroke={ALARM} strokeWidth={1} opacity={0.3} className="pulse-ring-alarm" style={{ ...PULSE_STYLE, animationDelay: '0.6s' }} />
          <circle r={12} fill="none" stroke={ALARM} strokeWidth={1} opacity={0.25} />
        </>
      )}
      {alerting && !offline && (
        <circle r={11} fill="none" stroke={bandColor} strokeWidth={1} opacity={0.3} className="pulse-ring" style={PULSE_STYLE} />
      )}
      {highlighted && <circle r={13} fill="none" stroke="var(--color-signal)" strokeWidth={1} opacity={0.5} className="pulse-ring" style={PULSE_STYLE} />}
      {flash && <circle r={11} fill="none" stroke="var(--color-signal)" strokeWidth={1.5} opacity={0.5} />}
      {selected && <circle r={10} fill="none" stroke="var(--color-accent)" strokeWidth={1} opacity={0.9} />}
      {n.is_gateway
        ? <rect x={-DOT_R} y={-DOT_R} width={DOT_R * 2} height={DOT_R * 2} rx={2} {...shape} />
        : <circle r={DOT_R} {...shape} />}
      {/* The gateway label hangs below its square so it never runs under the north-east nodes. */}
      <text
        x={n.is_gateway ? 0 : DOT_R + 8}
        y={n.is_gateway ? DOT_R + 16 : 4}
        textAnchor={n.is_gateway ? 'middle' : undefined}
        fontFamily="var(--font-sans)"
        fontSize={compact ? 13 : 12}
        fill={selected ? 'var(--color-ink)' : labelFill}
        className={labelClass}
      >
        {n.label}
      </text>
      {mode === 'air' && !compact && n.latest && !offline && (
        <text
          x={n.is_gateway ? 0 : DOT_R + 8}
          y={n.is_gateway ? DOT_R + 31 : 19}
          textAnchor={n.is_gateway ? 'middle' : undefined}
          fontFamily="var(--font-mono)"
          fontSize={11}
          fill={fill}
          className={labelClass}
        >
          {Math.round(n.latest.pm25)}
        </text>
      )}
    </g>
  )
}
