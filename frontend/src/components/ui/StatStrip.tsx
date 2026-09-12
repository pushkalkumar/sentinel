import clsx from 'clsx'

export interface StatStripProps {
  items: { value: string; label: string }[]
  className?: string
}

/** DESIGN_V2 §6: no cell borders. Big quiet figures, small sentence-case labels, grouped by whitespace. */
export function StatStrip({ items, className }: StatStripProps) {
  return (
    <dl className={clsx('grid grid-cols-2 md:grid-cols-4 gap-x-10 gap-y-12', className)}>
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dd className="stat-number text-3xl md:text-4xl text-ink truncate">{it.value}</dd>
          <dt className="mt-3 text-sm text-ink-3 normal-case tracking-normal">{it.label}</dt>
        </div>
      ))}
    </dl>
  )
}
