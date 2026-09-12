import clsx from 'clsx'
import type { IncidentType } from '@/lib/types'

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

/** 2x3 grid of 96px outline tiles; the selected one is ink filled. */
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
              'h-24 rounded-md px-3 text-[20px] font-semibold font-field leading-tight text-center',
              selected
                ? 'bg-f-ink text-white border-[1.5px] border-f-ink'
                : 'bg-f-surface text-f-ink border-[1.5px] border-f-line-strong active:bg-f-canvas',
            )}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
