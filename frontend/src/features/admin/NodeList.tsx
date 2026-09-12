import clsx from 'clsx'
import { useDisplayNodes } from '@/store/select'
import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import { BAND_META } from '@/lib/bands'
import { Skeleton } from '@/components/ui/Skeleton'

const OFFLINE = '#46423D'
const ALARM = '#FF4A3D'

function BatteryBar({ pct }: { pct: number | null }) {
  const p = pct ?? 0
  const color = p < 20 ? ALARM : p < 50 ? '#FFB224' : 'var(--color-ink-3)'
  return (
    <span className="inline-block w-6 h-[3px] bg-raised rounded-xs overflow-hidden align-middle" title={pct === null ? 'battery unknown' : `${Math.round(p)}%`} aria-label={`battery ${Math.round(p)} percent`}>
      <span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, p))}%`, background: color }} />
    </span>
  )
}

/** Right column rows: dot, id, mono reading, battery bar, status word. */
export function NodeList() {
  const nodes = useDisplayNodes()
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const selected = useUiStore((s) => s.selectedNodeId)
  const selectNode = useUiStore((s) => s.selectNode)
  const openExplain = useUiStore((s) => s.openExplain)

  if (!loaded && !error) return <div className="px-5 py-4"><Skeleton /></div>
  if (error && nodes.length === 0) return <p className="px-5 py-4 text-sm text-alarm">{error}</p>
  if (nodes.length === 0) return <p className="px-5 py-4 text-sm text-ink-3">No nodes on this site yet.</p>

  const sorted = [...nodes].sort((a, b) => (b.latest?.pm25 ?? -1) - (a.latest?.pm25 ?? -1))
  return (
    <ul className="py-1">
      {sorted.map((n) => {
        const fire = n.open_alerts.some((a) => a.kind === 'LOCAL_FIRE')
        const offline = n.status === 'offline'
        const color = fire ? ALARM : n.band ? BAND_META[n.band].color : OFFLINE
        const word = fire ? 'fire' : offline ? 'offline' : n.open_alerts.length > 0 ? 'alert' : n.status === 'watch' ? 'watch' : ''
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => { selectNode(n.id); openExplain(n.id) }}
              className={clsx(
                'w-full h-8 px-5 flex items-center gap-3 text-left transition-[background-color] duration-[120ms] hover:bg-raised',
                selected === n.id && 'bg-signal-dim shadow-[inset_2px_0_0_var(--color-signal)]',
              )}
            >
              <i
                aria-hidden
                className={clsx('shrink-0 size-2', n.is_gateway ? 'rounded-[1px]' : 'rounded-full', offline && 'border border-ink-4')}
                style={{ background: offline ? 'transparent' : color }}
              />
              <span className={clsx('font-mono text-xs w-20 truncate', offline ? 'text-ink-4' : 'text-ink-2')}>{n.id}</span>
              <span className="font-mono text-xs tabular-nums w-10 text-right" style={{ color: offline ? 'var(--color-ink-4)' : color }}>
                {offline || !n.latest ? '--' : Math.round(n.latest.pm25)}
              </span>
              <BatteryBar pct={n.battery_pct} />
              <span className={clsx('ml-auto text-xs', fire ? 'text-alarm font-medium' : 'text-ink-3')}>{word}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
