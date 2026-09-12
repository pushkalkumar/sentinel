import clsx from 'clsx'
import { useSimStore } from '@/store/sim'

/** DESIGN §6.16: 6px signal dot pulsing 2s; ink-4 and RECONNECTING when the socket is down. */
export function LiveDot({ className }: { className?: string }) {
  const status = useSimStore((s) => s.wsStatus)
  const open = status === 'open'
  return (
    <span className={clsx('inline-flex items-center gap-2', className)} role="status" aria-live="polite">
      <i aria-hidden className={clsx('size-1.5 rounded-full', open ? 'bg-signal pulse-live' : 'bg-ink-4')} />
      <span className="label-signage">{open ? 'LIVE' : 'RECONNECTING'}</span>
    </span>
  )
}
