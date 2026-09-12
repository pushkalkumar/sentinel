import type { ReactNode } from 'react'
import clsx from 'clsx'

export interface PageHeaderProps {
  /** Kept for compatibility; DESIGN_V2 §2 says most pages should not pass one. */
  eyebrow?: string
  title: string
  right?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, right, className }: PageHeaderProps) {
  return (
    <div className={clsx('flex items-end justify-between gap-6 flex-wrap pt-10 pb-8', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="label-signage mb-3">{eyebrow}</div>}
        <h1 className="display-h1 text-2xl text-ink">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  )
}
