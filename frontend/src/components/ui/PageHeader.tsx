import type { ReactNode } from 'react'
import clsx from 'clsx'

export interface PageHeaderProps {
  eyebrow?: string
  title: string
  right?: ReactNode
  className?: string
}

export function PageHeader({ eyebrow, title, right, className }: PageHeaderProps) {
  return (
    <div className={clsx('flex items-end justify-between gap-4 flex-wrap py-6', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="label-signage mb-2">{eyebrow}</div>}
        <h1 className="display-h1 text-xl text-ink">{title}</h1>
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
  )
}
