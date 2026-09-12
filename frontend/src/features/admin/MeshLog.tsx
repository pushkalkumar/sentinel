import { useEffect, useRef } from 'react'
import clsx from 'clsx'
import { useMeshStore } from '@/store/mesh'
import { useSiteStore } from '@/store/site'
import { fmtWall } from '@/lib/time'
import type { MeshLogEntry } from '@/lib/types'

const KIND: Record<MeshLogEntry['kind'], string> = { incident: 'inc', alarm: 'alm', telemetry: 'tel' }

export function hopLine(h: MeshLogEntry, gatewayIds: Set<string>): { time: string; what: string; route: string; hop: string; status: string } {
  const code = typeof h.payload?.code === 'string' ? h.payload.code : h.msg_id.slice(0, 9)
  const idx = Math.max(0, h.path.indexOf(h.hop_from)) + 1
  const total = Math.max(1, h.path.length - 1)
  const status = h.status === 'dropped' ? 'DROP'
    : h.status === 'delivered' ? 'delivered'
      : h.status === 'failed' ? 'FAILED'
        : h.attempt > 1 ? 'retry ok' : 'ok'
  return {
    time: fmtWall(h.ts, 'HH:mm:ss.SSS'),
    what: `${KIND[h.kind]} ${code}`,
    route: `${h.hop_from} → ${h.hop_to}${gatewayIds.has(h.hop_to) ? ' ■' : ''}`,
    hop: `hop ${idx}/${total}`,
    status,
  }
}

/** DESIGN §6.6 hop log: mono 12px, newest at the bottom, auto-scroll. */
export function MeshLog({ lines = 8, className }: { lines?: number; className?: string }) {
  const hops = useMeshStore((s) => s.hops)
  const nodes = useSiteStore((s) => s.nodes)
  const ref = useRef<HTMLOListElement>(null)
  const gateways = new Set(Object.values(nodes).filter((n) => n.is_gateway).map((n) => n.id))
  const recent = hops.slice(-lines)

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [hops.length])

  if (recent.length === 0) {
    return <p className={clsx('px-5 py-4 text-sm text-ink-3', className)}>No hops yet. Mesh traffic appears here as nodes relay messages.</p>
  }
  return (
    <ol ref={ref} className={clsx('px-5 py-2 font-mono text-xs leading-5 overflow-y-auto', className)} aria-live="polite" aria-label="Mesh hop log">
      {recent.map((h) => {
        const l = hopLine(h, gateways)
        const drop = h.status === 'dropped' || h.status === 'failed'
        return (
          <li key={h.id} className={clsx('grid grid-cols-[7.5rem_1fr_auto] gap-x-3 whitespace-nowrap', h.kind === 'telemetry' ? 'text-ink-4' : 'text-ink-2')}>
            <span className="text-ink-3 tabular-nums">{l.time}</span>
            <span className="truncate">{l.what} <span className="text-ink">{l.route}</span> <span className="text-ink-3">{l.hop}</span></span>
            <span className={clsx(drop ? 'text-alarm' : h.status === 'delivered' ? 'text-signal' : 'text-ink-3')}>{l.status}</span>
          </li>
        )
      })}
    </ol>
  )
}
