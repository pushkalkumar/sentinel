import clsx from 'clsx'

export interface CharCounterProps {
  count: number
  limit: number
  className?: string
}

const WARN_FRACTION = 0.8

/** `n / limit` in mono: signal from 80 percent, alarm past the limit. */
export function CharCounter({ count, limit, className }: CharCounterProps) {
  const over = count > limit
  const near = !over && count >= limit * WARN_FRACTION
  return (
    <span
      className={clsx('font-mono text-xs tabular-nums', over ? 'text-alarm' : near ? 'text-signal' : 'text-ink-3', className)}
      aria-live="polite"
      aria-label={over ? `${count - limit} characters over the ${limit} limit` : `${count} of ${limit} characters`}
    >
      {count} / {limit}
    </span>
  )
}
