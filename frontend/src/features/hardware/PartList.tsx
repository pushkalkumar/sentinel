import clsx from 'clsx'
import { useHardwareStore } from '@/store/hardware'
import { NUMBERED_PARTS } from '@/three/node/parts'

/** 13 rows, two-way bound to the 3D hover and selection through the store. Keyboard path for the hotspots. */
export function PartList({ className }: { className?: string }) {
  const hover = useHardwareStore((s) => s.hoverPartId)
  const selected = useHardwareStore((s) => s.selectedPartId)
  return (
    <ol className={clsx('divide-y divide-line', className)} onPointerLeave={() => useHardwareStore.getState().hover(null)}>
      {NUMBERED_PARTS.map((p) => {
        const active = hover === p.id || selected === p.id
        return (
          <li key={p.id}>
            <button
              type="button"
              onPointerEnter={() => useHardwareStore.getState().hover(p.id)}
              onFocus={() => useHardwareStore.getState().hover(p.id)}
              onBlur={() => useHardwareStore.getState().hover(null)}
              onClick={() => useHardwareStore.getState().select(p.id)}
              aria-pressed={selected === p.id}
              className={clsx(
                'w-full h-8 px-2 flex items-center gap-3 text-left rounded-xs transition-colors duration-[120ms]',
                active ? 'bg-signal-dim text-ink' : 'text-ink-2 hover:bg-raised',
              )}
            >
              <span className={clsx('font-mono text-2xs tabular-nums w-5', active ? 'text-signal' : 'text-ink-3')}>{String(p.index).padStart(2, '0')}</span>
              <span className="text-sm truncate">{p.name}</span>
              <span className="font-mono text-2xs tabular-nums ml-auto text-ink-3">{p.cost1k > 0 ? `$${p.cost1k.toFixed(2)}` : 'incl.'}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
