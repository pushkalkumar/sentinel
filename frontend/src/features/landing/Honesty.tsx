import clsx from 'clsx'

// Spec §10.1: what is real, what is simulated, what is designed only. Said once, densely, where a judge reads it.
interface Column {
  id: string
  label: string
  glyph: string
  tone: string
  items: string[]
}

const COLUMNS: Column[] = [
  {
    id: 'real', label: 'Real today', glyph: 'OK', tone: 'text-ok',
    items: [
      'Alert engine: rate-of-rise, neighbour median, sky-vs-room rule',
      'Trust score, incident codes, responder-only close',
      'Store-and-forward dedup and retry on every hop',
      'Drill roll call, audit log, decision card',
    ],
  },
  {
    id: 'sim', label: 'Simulated today', glyph: 'SIM', tone: 'text-signal',
    items: [
      'Sensors: 8 virtual nodes from a scripted smoke day',
      'Mesh radio: local UDP with a 15 percent drop',
      'SMS: provider disabled, outbox shows queued',
      'Labelled on screen wherever it appears',
    ],
  },
  {
    id: 'designed', label: 'Designed, not fabricated', glyph: 'REV A', tone: 'text-ink-2',
    items: [
      'Schematic, BOM and pin map in the repo',
      'Power budget: 3 days on one 18650, no sun',
      'Firmware sketch for ESP32 and SX1262',
      'Per organizer guidance for this event',
    ],
  },
]

export function Honesty({ className }: { className?: string }) {
  return (
    <section className={clsx('hairline rounded-md bg-surface overflow-hidden', className)} aria-labelledby="honesty-title">
      <header className="h-9 px-5 flex items-center gap-3 border-b border-line">
        <h2 id="honesty-title" className="label-signage shrink-0 whitespace-nowrap">What is real</h2>
        <span className="font-mono text-2xs text-ink-3 truncate hidden sm:inline">one honest line per claim, nothing hidden in a footer</span>
        <span className="ml-auto font-mono text-2xs text-ink-4 hidden sm:inline tabular-nums">spec §10.1</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 md:divide-x divide-line">
        {COLUMNS.map((c, i) => (
          <div key={c.id} className={clsx('px-5 py-4 min-w-0', i > 0 && 'border-t md:border-t-0 border-line')}>
            <div className="flex items-baseline gap-3">
              <span className={clsx('font-mono text-2xs tabular-nums w-10 shrink-0', c.tone)}>{c.glyph}</span>
              <h3 className="label-signage text-ink">{c.label}</h3>
            </div>
            <ul className="mt-3 space-y-1.5 font-mono text-xs leading-4">
              {c.items.map((it, k) => (
                <li key={it} className="grid grid-cols-[2.5rem_1fr] gap-x-3 min-w-0">
                  <span className="text-ink-4 tabular-nums">{String(k + 1).padStart(2, '0')}</span>
                  <span className="text-ink-2 min-w-0">{it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
