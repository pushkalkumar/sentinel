import clsx from 'clsx'

export interface CodeCellsProps {
  code: string
  size: 'phone' | 'desktop'
  className?: string
}

/** DESIGN §6.9: the code as cells a person can copy onto skin. SN cells dimmed, hyphen is plain text. */
export function CodeCells({ code, size, className }: CodeCellsProps) {
  const clean = code.trim().toUpperCase()
  const body = clean.startsWith('SN-') ? clean.slice(3) : clean.startsWith('SN') ? clean.slice(2) : clean
  const phone = size === 'phone'
  const cell = clsx(
    'flex items-center justify-center shrink-0 font-bold tabular-nums',
    phone
      ? 'w-14 h-[72px] rounded-sm border border-f-line-strong bg-f-surface text-f-ink font-field-mono text-[48px]'
      : 'w-16 h-[88px] rounded-sm hairline bg-surface text-ink font-mono text-3xl font-semibold',
  )
  return (
    <div className={clsx('flex items-center gap-1.5', className)} aria-label={`Code ${clean}`}>
      {['S', 'N'].map((ch, i) => (
        <span key={`p${i}`} className={clsx(cell, 'opacity-50')} aria-hidden>{ch}</span>
      ))}
      <span aria-hidden className={clsx('px-1 font-semibold', phone ? 'text-f-ink-2 text-[32px] font-field' : 'text-ink-3 text-xl')}>-</span>
      {body.split('').map((ch, i) => (
        <span key={`c${i}`} className={cell} aria-hidden>{ch}</span>
      ))}
    </div>
  )
}
