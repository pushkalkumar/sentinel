import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface PanelProps {
  title: string
  meta?: ReactNode
  /** SIM tag slot. */
  right?: ReactNode
  live?: boolean
  padded?: boolean
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

/** DESIGN §6.3: bg-surface hairline rounded-md, 40px header row with a signage title. */
export function Panel({ title, meta, right, live = false, padded = true, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={clsx('bg-surface rounded-md flex flex-col min-w-0', live ? 'border border-signal-line' : 'hairline', className)}>
      <header className="h-10 shrink-0 flex items-center gap-3 px-5 border-b border-line">
        <h2 className="label-signage truncate">{title}</h2>
        {meta !== undefined && <span className="font-mono text-2xs text-ink-3 truncate">{meta}</span>}
        {right !== undefined && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
      </header>
      <div className={clsx('min-w-0 flex-1', padded && 'p-5', bodyClassName)}>{children}</div>
    </section>
  )
}
