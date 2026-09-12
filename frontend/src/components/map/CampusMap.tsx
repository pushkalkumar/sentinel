import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { IncidentCode, MeshLogEntry, Node, NodeId, Zone } from '@/lib/types'
import { CampusGround } from './CampusGround'
import { FloorplanGround } from './FloorplanGround'
import { HopLayer } from './HopLayer'
import { NodeDot } from './NodeDot'

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

const FLASH_MS = 160
const NO_HOPS: MeshLogEntry[] = []

/** DESIGN §6.5 / §6.6: static footprints, dashed hairline links, band-coloured dots, signal hop dashes. */
export function CampusMap({
  nodes, links, zones, mode, selectedId = null, onSelect, hops = NO_HOPS, highlightCode, ground, compact = false, className,
}: CampusMapProps) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const [flashes, setFlashes] = useState<Record<NodeId, number>>({})
  const timers = useRef<number[]>([])

  useEffect(() => () => { for (const t of timers.current) window.clearTimeout(t) }, [])

  const onLanded = useCallback((id: NodeId) => {
    setFlashes((f) => ({ ...f, [id]: Date.now() }))
    timers.current.push(window.setTimeout(() => {
      setFlashes((f) => {
        const { [id]: _gone, ...rest } = f
        return rest
      })
    }, FLASH_MS))
  }, [])

  // The incident's origin node comes from the hop log payload (CONTRACT §3.7).
  const highlightNode = useMemo(() => {
    if (!highlightCode) return null
    for (let i = hops.length - 1; i >= 0; i -= 1) {
      if (hops[i].payload?.code === highlightCode) return hops[i].origin_node
    }
    return null
  }, [hops, highlightCode])

  return (
    <svg
      viewBox="0 0 1000 700"
      className={clsx('w-full h-auto max-w-full block', className)}
      role="img"
      aria-label={`${ground === 'campus' ? 'Campus' : 'Floor plan'} map, ${mode} mode`}
      data-ground-layer={ground}
      data-compact={compact || undefined}
    >
      {ground === 'campus' ? <CampusGround /> : <FloorplanGround />}
      {zones && zones.length > 0 && (
        <g fill="none" stroke="var(--color-line-faint)" strokeWidth={1} strokeDasharray="6 6" aria-hidden>
          {zones.map((z) => (
            <polygon key={z.id} points={z.map_poly.map(([x, y]) => `${x},${y}`).join(' ')} />
          ))}
        </g>
      )}
      <g stroke="var(--color-line)" strokeDasharray="2 4" strokeWidth={1} fill="none" aria-hidden>
        {links.map(([a, b]) => {
          const na = byId.get(a)
          const nb = byId.get(b)
          if (!na || !nb) return null
          return <line key={`${a}-${b}`} x1={na.map_x} y1={na.map_y} x2={nb.map_x} y2={nb.map_y} />
        })}
      </g>
      <HopLayer hops={hops} byId={byId} onLanded={onLanded} />
      {nodes.map((n) => (
        <NodeDot
          key={n.id}
          node={n}
          mode={mode}
          selected={selectedId === n.id}
          highlighted={highlightNode === n.id}
          flash={n.id in flashes}
          compact={compact}
          onSelect={onSelect}
        />
      ))}
    </svg>
  )
}
