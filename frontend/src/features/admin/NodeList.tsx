import clsx from 'clsx'
import { useDisplayNodes } from '@/store/select'
import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import { BAND_META } from '@/lib/bands'
import { Skeleton } from '@/components/ui/Skeleton'

const OFFLINE = '#46423D'
const ALARM = '#E0574B'

/** Right column rows (DESIGN_V2 §4): band dot, sans name, reading in ink. Words only when something is wrong. */
export function NodeList() {
  const nodes = useDisplayNodes()
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const selected = useUiStore((s) => s.selectedNodeId)
  const selectNode = useUiStore((s) => s.selectNode)
  const openExplain = useUiStore((s) => s.openExplain)

  if (!loaded && !error) return <div className="py-2"><Skeleton /></div>
  if (error && nodes.length === 0) return <p className="py-2 text-sm text-alarm">{error}</p>
  if (nodes.length === 0) return <p className="py-2 text-sm text-ink-3">No nodes on this site yet.</p>

  const sorted = [...nodes].sort((a, b) => (b.latest?.pm25 ?? -1) - (a.latest?.pm25 ?? -1))
  return (
    <ul>
      {sorted.map((n) => {
        const fire = n.open_alerts.some((a) => a.kind === 'LOCAL_FIRE')
        const offline = n.status === 'offline'
        const lowBattery = n.battery_pct !== null && n.battery_pct < 20
        const color = fire ? ALARM : n.band ? BAND_META[n.band].color : OFFLINE
        const word = fire ? 'Fire' : offline ? 'Offline' : n.open_alerts.length > 0 ? 'Alert' : lowBattery ? 'Low battery' : ''
        const active = selected === n.id
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => { selectNode(n.id); openExplain(n.id) }}
              aria-pressed={active}
              className={clsx(
                'h-9 -mx-2 px-2 w-[calc(100%+1rem)] rounded-md flex items-center gap-3 text-left',
                'transition-[background-color] duration-[120ms] hover:bg-raised',
                active && 'bg-accent-dim shadow-[inset_2px_0_0_var(--color-accent)]',
              )}
            >
              <i
                aria-hidden
                className={clsx('shrink-0 size-1.5', n.is_gateway ? 'rounded-[1px]' : 'rounded-full', offline && 'border border-ink-4')}
                style={{ background: offline ? 'transparent' : color }}
              />
              <span className={clsx('text-sm truncate', offline ? 'text-ink-4' : active ? 'text-ink' : 'text-ink-2')}>{n.label}</span>
              {word && <span className={clsx('text-xs', fire ? 'text-alarm' : 'text-ink-3')}>{word}</span>}
              <span className={clsx('ml-auto font-mono text-sm tabular-nums', offline || !n.latest ? 'text-ink-4' : 'text-ink')}>
                {offline || !n.latest ? '--' : Math.round(n.latest.pm25)}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
