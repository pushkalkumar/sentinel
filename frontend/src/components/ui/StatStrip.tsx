import clsx from 'clsx'

export interface StatStripProps {
  items: { value: string; label: string }[]
  className?: string
}

/** Archivo 56px `stat-number` figures with signage labels; 2×2 under 900px. */
export function StatStrip({ items, className }: StatStripProps) {
  return (
    <dl className={clsx('grid grid-cols-2 md:grid-cols-4 gap-px bg-line hairline rounded-md overflow-hidden', className)}>
      {items.map((it) => (
        <div key={it.label} className="bg-surface px-6 py-5 min-w-0">
          <dd className="stat-number text-3xl text-ink truncate">{it.value}</dd>
          <dt className="label-signage mt-2">{it.label}</dt>
        </div>
      ))}
    </dl>
  )
}
