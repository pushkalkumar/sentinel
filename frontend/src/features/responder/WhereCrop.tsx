import { useMemo } from 'react'
import clsx from 'clsx'
import type { Incident, Node, NodeId } from '@/lib/types'
import { CampusMap } from '@/components/map/CampusMap'
import { useSiteStore } from '@/store/site'
import { useDisplayNodes } from '@/store/select'

export interface WhereCropProps {
  incident: Incident
  className?: string
}

const VIEW_W = 1000
const VIEW_H = 700
const ZOOM = 2.2
const METRES_PER_DEG_LAT = 111_320
const RING_M = 100

interface Fit { x: (lng: number) => number; y: (lat: number) => number; pxPerMetre: number }

/**
 * Least-squares line through the node set so a GPS fix can sit on the same picture as the dots.
 * Only used for the reporter's GPS dot; node dots always come from map_x/map_y (CONTRACT §0.6).
 */
function fitProjection(nodes: Node[]): Fit | null {
  if (nodes.length < 2) return null
  const line = (xs: number[], ys: number[]) => {
    const n = xs.length
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let num = 0
    let den = 0
    for (let i = 0; i < n; i += 1) {
      num += (xs[i] - mx) * (ys[i] - my)
      den += (xs[i] - mx) ** 2
    }
    if (den === 0) return null
    const k = num / den
    return { k, b: my - k * mx }
  }
  const fx = line(nodes.map((n) => n.lng), nodes.map((n) => n.map_x))
  const fy = line(nodes.map((n) => n.lat), nodes.map((n) => n.map_y))
  if (!fx || !fy) return null
  return {
    x: (lng) => fx.k * lng + fx.b,
    y: (lat) => fy.k * lat + fy.b,
    pxPerMetre: Math.abs(fy.k) / METRES_PER_DEG_LAT,
  }
}

/** DESIGN §8.6 WHERE: compact map crop centred on the incident's node, GPS dot and 100 m ring if shared. */
export function WhereCrop({ incident, className }: WhereCropProps) {
  const nodes = useDisplayNodes()
  const links = useSiteStore((s) => s.links)
  const zones = useSiteStore((s) => s.zones)
  const site = useSiteStore((s) => s.site)
  const loaded = useSiteStore((s) => s.loaded)

  const nodeId: NodeId | null = incident.node_id
  const node = nodes.find((n) => n.id === nodeId) ?? null
  const fit = useMemo(() => fitProjection(nodes), [nodes])

  const gps = incident.lat !== null && incident.lng !== null && fit
    ? { x: fit.x(incident.lng), y: fit.y(incident.lat), r: fit.pxPerMetre * RING_M }
    : null

  if (!loaded) {
    return <div className={clsx('h-48 flex items-center justify-center text-sm text-ink-3', className)}>Loading map.</div>
  }
  if (nodes.length === 0) {
    return <div className={clsx('h-48 flex items-center justify-center text-sm text-ink-3', className)}>Map not available for this site.</div>
  }

  // Centre on the node (or the GPS fix for internet-only reports); fall back to the whole map.
  const cx = node?.map_x ?? gps?.x ?? VIEW_W / 2
  const cy = node?.map_y ?? gps?.y ?? VIEW_H / 2
  const zoom = node || gps ? ZOOM : 1
  const originX = (Math.min(Math.max(cx, 0), VIEW_W) / VIEW_W) * 100
  const originY = (Math.min(Math.max(cy, 0), VIEW_H) / VIEW_H) * 100

  return (
    <div className={clsx('relative overflow-hidden rounded-sm bg-canvas hairline', className)} style={{ aspectRatio: '10 / 7' }}>
      <div
        className="absolute inset-0"
        style={{ transform: `scale(${zoom})`, transformOrigin: `${originX}% ${originY}%` }}
      >
        <CampusMap
          nodes={nodes}
          links={links}
          zones={zones}
          mode="mesh"
          selectedId={nodeId}
          highlightCode={incident.code}
          ground={site?.kind === 'floorplan' ? 'floorplan' : 'campus'}
          compact
          className="absolute inset-0 w-full h-full"
        />
        {gps && (
          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden>
            <circle cx={gps.x} cy={gps.y} r={gps.r} fill="rgba(70,210,228,0.08)" stroke="var(--color-signal)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={gps.x} cy={gps.y} r={4} fill="var(--color-signal)" stroke="var(--color-canvas)" strokeWidth={1.5} />
          </svg>
        )}
      </div>
      <div className="absolute left-3 bottom-2 font-mono text-2xs text-ink-3 flex items-center gap-3">
        <span>{node ? `node ${node.id}` : 'no node'}</span>
        {gps ? <span className="text-signal">GPS shared · 100 m ring</span> : <span>no GPS shared</span>}
      </div>
    </div>
  )
}
