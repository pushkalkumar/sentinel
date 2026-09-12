import clsx from 'clsx'

export type SimTagKind = 'nodes' | 'sms' | 'phone' | 'mesh'

/** One honesty line per page, footer level. Not a badge, not per panel (DESIGN_V2 §2). */
export const SIM_TAG_TEXT: Record<SimTagKind, string> = {
  nodes: 'Simulated: 8 virtual nodes, schematic in submission',
  sms: 'Simulated: SMS provider disabled in demo',
  phone: 'In production this page is served by the node itself',
  mesh: 'Simulated mesh over local UDP, 15% drop. Dedup and retry are real',
}

export interface SimTagProps {
  kind: SimTagKind
  /** Light ground variant for /m. */
  ground?: 'dark' | 'light'
  className?: string
}

export function SimTag({ kind, ground = 'dark', className }: SimTagProps) {
  return (
    <span
      className={clsx(
        'inline-block max-w-full truncate',
        ground === 'light' ? 'text-f-ink-2 font-field text-[13px]' : 'text-ink-4 text-xs',
        className,
      )}
    >
      {SIM_TAG_TEXT[kind]}
    </span>
  )
}
