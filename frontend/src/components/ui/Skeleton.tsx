import clsx from 'clsx'

/** DESIGN §6.4 loading: three 12px bars at 60 / 40 / 70 percent, opacity 0.6, no shimmer. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('flex flex-col gap-2', className)} aria-busy="true" aria-label="Loading">
      {['60%', '40%', '70%'].map((w) => (
        <div key={w} className="h-3 rounded-xs bg-raised opacity-60" style={{ width: w }} />
      ))}
    </div>
  )
}
