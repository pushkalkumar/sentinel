import type { Node, NodeId, Zone } from '@/lib/types'

export interface PolygonPreviewProps {
  zone: Zone | null
  nodes: Node[]
  affectedIds: NodeId[]
  /** Vertex count of the WEA polygon ring (the GeoJSON sent to IPAWS), shown against the 100 cap. */
  vertexCount: number
  viewBox?: string
}

export const WEA_VERTEX_CAP = 100

/** Zone polygon on the campus viewBox with affected nodes highlighted. Pure SVG; no tiles, no basemap. */
export function PolygonPreview({ zone, nodes, affectedIds, vertexCount, viewBox = '0 0 1000 700' }: PolygonPreviewProps) {
  const affected = new Set(affectedIds)
  const points = zone?.map_poly.map(([x, y]) => `${x},${y}`).join(' ') ?? ''
  const inZone = new Set(zone?.node_ids ?? [])
  const overCap = vertexCount > WEA_VERTEX_CAP

  return (
    <div className="flex flex-col gap-2 min-w-0">
      <svg viewBox={viewBox} role="img" aria-label={zone ? `${zone.name} polygon with ${affectedIds.length} affected nodes` : 'No zone polygon'} className="w-full rounded-lg bg-canvas">
        <defs>
          <pattern id="wea-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M50 0H0V50" fill="none" stroke="var(--color-line-faint)" strokeWidth={1} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wea-grid)" />
        {points && (
          <polygon points={points} fill="var(--color-alarm-dim)" stroke="var(--color-alarm)" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        )}
        {nodes.map((n) => {
          const hot = affected.has(n.id)
          const member = inZone.has(n.id)
          return (
            <g key={n.id}>
              {hot && <circle cx={n.map_x} cy={n.map_y} r={22} fill="none" stroke="var(--color-alarm)" strokeOpacity={0.45} strokeWidth={2} />}
              <circle cx={n.map_x} cy={n.map_y} r={hot ? 10 : 7} fill={hot ? 'var(--color-alarm)' : member ? 'var(--color-ink-2)' : 'var(--color-ink-4)'} />
              <text x={n.map_x} y={n.map_y + (hot ? 34 : 26)} textAnchor="middle" fontSize={hot ? 22 : 18} fontFamily="var(--font-mono)" fill={hot ? 'var(--color-ink)' : 'var(--color-ink-3)'}>
                {n.id}
              </text>
            </g>
          )
        })}
      </svg>
      <div className="flex items-center gap-4 text-xs text-ink-3">
        <span className="text-ink-2">{zone?.name ?? 'No zone polygon for this alert'}</span>
        <span className={overCap ? 'text-alarm' : undefined}><span className="font-mono">{vertexCount}</span> of <span className="font-mono">{WEA_VERTEX_CAP}</span> vertices</span>
        <span className="ml-auto"><span className="font-mono">{affectedIds.length}</span> node{affectedIds.length === 1 ? '' : 's'} affected</span>
      </div>
    </div>
  )
}
