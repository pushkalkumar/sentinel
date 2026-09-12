import type { ReactNode } from 'react'
import clsx from 'clsx'

export interface EmptyStateProps { text: string; action?: ReactNode; className?: string }

export function EmptyState({ text, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('min-h-24 flex flex-col items-center justify-center gap-3 text-center text-ink-3 text-sm px-4', className)}>
      <p>{text}</p>
      {action}
    </div>
  )
}
