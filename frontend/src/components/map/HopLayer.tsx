import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import type { MeshLogEntry, Node, NodeId } from '@/lib/types'

/** DESIGN §6.6: 220 ms per hop, dropped dissolves at 60 %, telemetry at 35 % opacity. */
const HOP_MS = 220
const DISSOLVE_MS = 160
const DROP_MARK_MS = 800
const DASH_LEN = 24
const EASE_HOP: [number, number, number, number] = [0.3, 0, 0.2, 1]

interface ActiveHop {
  key: number
  entry: MeshLogEntry
  x1: number; y1: number; x2: number; y2: number
}
interface DropMark { key: number; x: number; y: number }

export interface HopLayerProps {
  hops: MeshLogEntry[]
  byId: Map<NodeId, Node>
  /** Fires when a hop lands on `hop_to` (signal flash on the receiving node). */
  onLanded?: (id: NodeId, delivered: boolean) => void
}

let seq = 0

export function HopLayer({ hops, byId, onLanded }: HopLayerProps) {
  const seen = useRef<Set<number> | null>(null)
  const [active, setActive] = useState<ActiveHop[]>([])
  const [drops, setDrops] = useState<DropMark[]>([])

  useEffect(() => {
    // First render: everything already in the log is history, not a new hop.
    if (seen.current === null) {
      seen.current = new Set(hops.map((h) => h.id))
      return
    }
    const fresh: ActiveHop[] = []
    for (const h of hops) {
      if (seen.current.has(h.id)) continue
      seen.current.add(h.id)
      const a = byId.get(h.hop_from)
      const b = byId.get(h.hop_to)
      if (!a || !b) continue
      seq += 1
      fresh.push({ key: seq, entry: h, x1: a.map_x, y1: a.map_y, x2: b.map_x, y2: b.map_y })
    }
    if (fresh.length === 0) return
    setActive((prev) => [...prev, ...fresh])
    for (const f of fresh) {
      if (f.entry.status === 'dropped') {
        const x = f.x1 + (f.x2 - f.x1) * 0.6
        const y = f.y1 + (f.y2 - f.y1) * 0.6
        const key = f.key
        window.setTimeout(() => setDrops((d) => [...d, { key, x, y }]), HOP_MS * 0.6)
        window.setTimeout(() => setDrops((d) => d.filter((m) => m.key !== key)), HOP_MS * 0.6 + DROP_MARK_MS)
      }
    }
  }, [hops, byId])

  const finish = (h: ActiveHop) => {
    setActive((prev) => prev.filter((x) => x.key !== h.key))
    if (h.entry.status !== 'dropped' && h.entry.status !== 'failed') onLanded?.(h.entry.hop_to, h.entry.status === 'delivered')
  }

  return (
    <g aria-hidden data-layer="hops">
      {active.map((h) => {
        const dx = h.x2 - h.x1
        const dy = h.y2 - h.y1
        const len = Math.hypot(dx, dy) || 1
        const ux = dx / len
        const uy = dy / len
        const dropped = h.entry.status === 'dropped'
        const telemetry = h.entry.kind === 'telemetry'
        const endX = dropped ? h.x1 + dx * 0.6 : h.x2
        const endY = dropped ? h.y1 + dy * 0.6 : h.y2
        const travel = dropped ? HOP_MS * 0.6 : HOP_MS
        const total = dropped ? travel + DISSOLVE_MS : travel
        const split = travel / total
        return (
          <motion.g
            key={h.key}
            className="hop-dash"
            initial={{ x: h.x1, y: h.y1, opacity: telemetry ? 0.35 : 1, scaleX: 1 }}
            animate={dropped
              ? { x: [h.x1, endX, endX], y: [h.y1, endY, endY], opacity: [telemetry ? 0.35 : 1, telemetry ? 0.35 : 1, 0], scaleX: [1, 1, 0.3] }
              : { x: endX, y: endY }}
            transition={dropped
              ? { duration: total / 1000, times: [0, split, 1], ease: EASE_HOP }
              : { duration: total / 1000, ease: EASE_HOP }}
            onAnimationComplete={() => finish(h)}
          >
            <line x1={-ux * DASH_LEN} y1={-uy * DASH_LEN} x2={0} y2={0} stroke="var(--color-signal)" strokeWidth={2} strokeLinecap="round" opacity={0.5} />
            <line x1={-ux * (DASH_LEN / 2)} y1={-uy * (DASH_LEN / 2)} x2={0} y2={0} stroke="var(--color-signal)" strokeWidth={2} strokeLinecap="round" />
          </motion.g>
        )
      })}
      {drops.map((d) => (
        <g key={d.key} transform={`translate(${d.x} ${d.y})`} stroke="var(--color-ink-3)" strokeWidth={1}>
          <line x1={-3} y1={-3} x2={3} y2={3} />
          <line x1={-3} y1={3} x2={3} y2={-3} />
        </g>
      ))}
    </g>
  )
}
