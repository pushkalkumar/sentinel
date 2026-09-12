import clsx from 'clsx'

export type SimTagKind = 'nodes' | 'sms' | 'phone' | 'mesh'

/** Exact strings from DESIGN §6.13. One per view. */
export const SIM_TAG_TEXT: Record<SimTagKind, string> = {
  nodes: '8 virtual nodes · schematic in submission',
  sms: 'SMS provider disabled in demo',
  phone: 'in production this page is served by the node itself',
  mesh: 'mesh over local UDP, 15% drop · dedup and retry are real',
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
        'inline-flex items-center gap-2 h-[22px] px-1.5 rounded-sm border border-dashed text-2xs whitespace-nowrap max-w-full',
        ground === 'light' ? 'border-f-line-strong text-f-ink-2 font-field-mono text-[13px]' : 'border-line-strong text-ink-3 font-mono',
        className,
      )}
    >
      <span className="font-semibold tracking-wider">SIM</span>
      <span className="truncate">{SIM_TAG_TEXT[kind]}</span>
    </span>
  )
}
