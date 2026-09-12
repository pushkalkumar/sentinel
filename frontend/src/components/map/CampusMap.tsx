// OWNER: fe-admin
import clsx from 'clsx'
import type { IncidentCode, MeshLogEntry, Node, NodeId, Zone } from '@/lib/types'
import { BAND_META } from '@/lib/bands'

// Frozen interface (BUILD_PLAN §1.3). Add optional props only via INTEGRATION_NOTES.
export interface CampusMapProps {
  nodes: Node[]; links: [NodeId, NodeId][]; zones?: Zone[];
  mode: 'air' | 'mesh'; selectedId?: NodeId | null; onSelect?: (id: NodeId) => void;
  hops?: MeshLogEntry[];            // recent hops to animate (the map decides which are new by id)
  highlightCode?: IncidentCode;     // pulse the node of this incident
  ground: 'campus' | 'floorplan';   // which footprint layer
  compact?: boolean;                // landing hero card / incident detail crop
  className?: string;
}

const DOT_R = 6
const OFFLINE_STROKE = '#46423D'
const ALARM = '#FF4A3D'

/** Minimal renderer: dashed hairline links, 12px band-coloured dots, squares for gateways, mono labels. */
export function CampusMap({ nodes, links, mode, selectedId = null, onSelect, ground, compact = false, className }: CampusMapProps) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return (
    <svg
      viewBox="0 0 1000 700"
      className={clsx('w-full h-auto max-w-full', className)}
      role="img"
      aria-label={`${ground === 'campus' ? 'Campus' : 'Floor plan'} map, ${mode} mode`}
      data-ground-layer={ground}
      data-compact={compact || undefined}
    >
      <g stroke="var(--color-line)" strokeDasharray="2 4" strokeWidth={1} fill="none">
        {links.map(([a, b]) => {
          const na = byId.get(a)
          const nb = byId.get(b)
          if (!na || !nb) return null
          return <line key={`${a}-${b}`} x1={na.map_x} y1={na.map_y} x2={nb.map_x} y2={nb.map_y} />
        })}
      </g>
      {nodes.map((n) => {
        const fire = n.open_alerts.some((a) => a.kind === 'LOCAL_FIRE')
        const offline = n.status === 'offline'
        const fill = fire ? ALARM : n.band ? BAND_META[n.band].color : OFFLINE_STROKE
        const selected = selectedId === n.id
        const common = {
          fill: offline ? 'none' : fill,
          stroke: offline ? OFFLINE_STROKE : 'rgba(255,255,255,0.2)',
          strokeWidth: offline ? 1.5 : 1,
        }
        return (
          <g
            key={n.id}
            transform={`translate(${n.map_x} ${n.map_y})`}
            onClick={onSelect ? () => onSelect(n.id) : undefined}
            className={clsx(onSelect && 'cursor-pointer')}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter') onSelect(n.id) } : undefined}
            aria-label={n.label}
          >
            {selected && <circle r={10} fill="none" stroke="var(--color-signal)" strokeWidth={1} />}
            {n.is_gateway
              ? <rect x={-DOT_R} y={-DOT_R} width={DOT_R * 2} height={DOT_R * 2} rx={2} {...common} />
              : <circle r={DOT_R} {...common} />}
            <text
              x={DOT_R + 8}
              y={4}
              fontFamily="var(--font-mono)"
              fontSize={11}
              fill={fire ? ALARM : offline ? 'var(--color-ink-4)' : 'var(--color-ink-2)'}
            >
              {n.id}
            </text>
            {mode === 'air' && n.latest && (
              <text x={DOT_R + 8} y={18} fontFamily="var(--font-mono)" fontSize={11} fill={fill}>
                {Math.round(n.latest.pm25)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
