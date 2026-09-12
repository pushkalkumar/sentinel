import clsx from 'clsx'
import { Check } from 'lucide-react'

export interface RosterChipsProps {
  roster: string[]
  missing: string[]
  onToggle: (ref: string) => void
  disabled?: boolean
}

/** Roster as tappable chips; a tapped chip marks that student missing. Targets are 48px tall (DESIGN §8.7). */
export function RosterChips({ roster, missing, onToggle, disabled = false }: RosterChipsProps) {
  if (roster.length === 0) {
    return <p className="text-[16px] text-f-ink-2">No roster loaded for this class.</p>
  }
  const missingSet = new Set(missing)
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Roster">
      {roster.map((ref) => {
        const isMissing = missingSet.has(ref)
        return (
          <li key={ref}>
            <button
              type="button"
              disabled={disabled}
              aria-pressed={isMissing}
              onClick={() => onToggle(ref)}
              className={clsx(
                'h-12 min-w-12 px-3 rounded-full border-[1.5px] inline-flex items-center gap-1.5 text-[16px] font-field-mono tabular-nums',
                'disabled:opacity-45',
                isMissing ? 'bg-f-ink text-white border-f-ink' : 'bg-f-surface text-f-ink border-f-line-strong active:bg-f-canvas',
              )}
            >
              {isMissing && <Check size={16} strokeWidth={2} aria-hidden />}
              {ref}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
