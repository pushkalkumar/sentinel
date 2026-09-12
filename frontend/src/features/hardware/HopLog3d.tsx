import clsx from 'clsx'
import { useMeshStore } from '@/store/mesh'
import type { MeshLogEntry } from '@/lib/types'

const SHOW = 12

const hhmmss = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '--:--:--' : d.toISOString().slice(11, 19)
}

const code = (h: MeshLogEntry) => (typeof h.payload.code === 'string' ? h.payload.code : h.msg_id.slice(0, 7))

/** Last 12 hops from the mesh store; drops in alarm red. */
export function HopLog3d() {
  const hops = useMeshStore((s) => s.hops)
  const dropCount = useMeshStore((s) => s.dropCount)
  const recent = hops.slice(-SHOW).reverse()
  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="flex items-baseline gap-4 px-6 pb-3 text-sm">
        <span className="text-ink-3">{hops.length} hops seen</span>
        <span className={clsx('tabular-nums', dropCount > 0 ? 'text-alarm' : 'text-ink-3')}>{dropCount} dropped</span>
      </div>
      <ol className="font-mono text-xs overflow-y-auto min-h-0 flex-1">
        {recent.length === 0 && <li className="px-6 h-9 flex items-center text-ink-3">Waiting for the first hop.</li>}
        {recent.map((h) => {
          const dropped = h.status === 'dropped'
          return (
            <li key={h.id} className={clsx('px-6 h-9 flex items-center gap-3 whitespace-nowrap border-t border-line', dropped ? 'text-alarm' : 'text-ink-2')}>
              <span className="text-ink tabular-nums">{code(h)}</span>
              <span>{h.hop_from} → {h.hop_to}</span>
              <span className="text-ink-3">hop {Math.max(1, h.path.length - 1)}</span>
              {dropped && <span>dropped</span>}
              <span className="ml-auto text-ink-3 tabular-nums">{hhmmss(h.ts)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
