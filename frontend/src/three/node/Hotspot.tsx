import { Html } from '@react-three/drei'
import clsx from 'clsx'
import { useHardwareStore } from '@/store/hardware'
import type { Part } from './parts'

const SHOW_AT = 0.55

/** Numbered chip (HARDWARE_3D §4.4), DESIGN tokens: Plex Mono 11px on surface with a hairline. */
export function Hotspot({ part }: { part: Part }) {
  const explode = useHardwareStore((s) => s.explode)
  const selected = useHardwareStore((s) => s.selectedPartId === part.id)
  const hovered = useHardwareStore((s) => s.hoverPartId === part.id)
  const visible = explode > SHOW_AT || selected
  return (
    <Html position={[part.hotspot[0], part.hotspot[1], part.hotspot[2]]} center zIndexRange={[20, 0]} pointerEvents={visible ? 'auto' : 'none'}>
      <button
        type="button"
        onClick={() => useHardwareStore.getState().select(part.id)}
        onPointerEnter={() => useHardwareStore.getState().hover(part.id)}
        onPointerLeave={() => useHardwareStore.getState().hover(null)}
        aria-label={`${part.index}. ${part.name}`}
        tabIndex={visible ? 0 : -1}
        className={clsx(
          'h-[22px] min-w-[22px] px-1 rounded-full border font-mono text-2xs tabular-nums leading-none',
          'bg-surface/90 backdrop-blur-[2px] transition-[opacity,transform,border-color,color] duration-200',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
          selected || hovered ? 'border-signal text-signal' : 'border-line-strong text-ink-2 hover:text-ink',
        )}
      >
        {String(part.index).padStart(2, '0')}
      </button>
    </Html>
  )
}
