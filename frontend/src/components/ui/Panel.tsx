import clsx from 'clsx'
import type { ReactNode } from 'react'

export interface PanelProps {
  title: string
  meta?: ReactNode
  /** Right-hand header slot (controls). Do not put a SimTag here; see DESIGN_V2 §2. */
  right?: ReactNode
  live?: boolean
  padded?: boolean
  className?: string
  bodyClassName?: string
  children?: ReactNode
}

/** DESIGN_V2 §6: no border by default, surface background, 24px padding, one quiet signage label, no header rule. */
export function Panel({ title, meta, right, live = false, padded = true, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={clsx('bg-surface rounded-lg flex flex-col min-w-0', className)}>
      <header className="shrink-0 flex items-center gap-3 px-panel pt-5 pb-1">
        {live && <i aria-hidden className="size-1.5 rounded-full bg-signal pulse-live shrink-0" />}
        <h2 className="label-signage truncate">{title}</h2>
        {meta !== undefined && <span className="font-mono text-2xs text-ink-4 truncate">{meta}</span>}
        {right !== undefined && <div className="ml-auto flex items-center gap-2 shrink-0">{right}</div>}
      </header>
      <div className={clsx('min-w-0 flex-1', padded ? 'px-panel pb-panel pt-3' : 'pt-2', bodyClassName)}>{children}</div>
    </section>
  )
}
