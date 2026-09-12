import clsx from 'clsx'
import { useHardwareStore } from '@/store/hardware'
import { NUMBERED_PARTS } from '@/three/node/parts'

/** 13 rows, two-way bound to the 3D hover and selection through the store. Keyboard path for the model. */
export function PartList({ className }: { className?: string }) {
  const hover = useHardwareStore((s) => s.hoverPartId)
  const selected = useHardwareStore((s) => s.selectedPartId)
  return (
    <ol className={className} onPointerLeave={() => useHardwareStore.getState().hover(null)}>
      {NUMBERED_PARTS.map((p) => {
        const isSelected = selected === p.id
        const isHover = hover === p.id
        return (
          <li key={p.id}>
            <button
              type="button"
              onPointerEnter={() => useHardwareStore.getState().hover(p.id)}
              onFocus={() => useHardwareStore.getState().hover(p.id)}
              onBlur={() => useHardwareStore.getState().hover(null)}
              onClick={() => useHardwareStore.getState().select(p.id)}
              aria-pressed={isSelected}
              className={clsx(
                'relative w-full h-9 pl-4 pr-3 flex items-center gap-3 text-left rounded-sm transition-colors duration-[120ms]',
                'before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-0.5 before:rounded-full before:bg-accent before:transition-opacity before:duration-[120ms]',
                isSelected ? 'bg-accent-dim text-ink before:opacity-100' : 'before:opacity-0',
                !isSelected && (isHover ? 'bg-raised text-ink' : 'text-ink-2'),
              )}
            >
              <span className="text-sm truncate">{p.name}</span>
              <span className={clsx('font-mono text-xs tabular-nums ml-auto', isSelected || isHover ? 'text-ink-2' : 'text-ink-3')}>
                {p.cost1k > 0 ? `$${p.cost1k.toFixed(2)}` : 'incl.'}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
