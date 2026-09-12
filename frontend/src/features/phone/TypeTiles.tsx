import clsx from 'clsx'
import type { IncidentType } from '@/lib/types'
import { RING } from './surface'

export interface TypeTilesProps {
  value: IncidentType | null
  onChange: (t: IncidentType) => void
}

/** Tile copy is the spec §7.1 list; the words are the icons (DESIGN §8.7). */
const TILES: { type: IncidentType; label: string }[] = [
  { type: 'safe', label: 'Safe' },
  { type: 'water', label: 'Need water' },
  { type: 'medical', label: 'Need medical' },
  { type: 'trapped', label: 'Trapped' },
  { type: 'fire', label: 'Fire' },
  { type: 'other', label: 'Other' },
]

/** 2x3 grid of white tiles; the selected one is ink filled. No borders, tone does the work. */
export function TypeTiles({ value, onChange }: TypeTilesProps) {
  return (
    <div role="radiogroup" aria-label="What is happening" className="grid grid-cols-2 gap-3">
      {TILES.map((t) => {
        const selected = value === t.type
        return (
          <button
            key={t.type}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(t.type)}
            className={clsx(
              'h-[72px] rounded-lg px-3 text-[19px] font-semibold font-field leading-tight text-center',
              'transition-[background-color,color,scale] duration-[120ms] ease-[var(--ease-exit)] active:scale-[0.98]',
              selected ? 'bg-f-ink text-white' : `bg-f-surface text-f-ink ${RING} active:bg-f-canvas`,
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
