import { Minus, Plus } from 'lucide-react'
import clsx from 'clsx'

export interface StepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
  size?: 'desktop' | 'phone'
  className?: string
}

/** Count stepper. Phone variant is 64px tall with 64px targets (DESIGN §8.7). */
export function Stepper({ value, onChange, min = 0, max = 500, label, size = 'phone', className }: StepperProps) {
  const phone = size === 'phone'
  const dec = () => onChange(Math.max(min, value - 1))
  const inc = () => onChange(Math.min(max, value + 1))
  const btn = clsx(
    'flex items-center justify-center shrink-0 disabled:opacity-40',
    phone ? 'size-16 rounded-sm border border-f-line-strong bg-f-surface text-f-ink active:bg-f-canvas' : 'size-9 rounded-sm bg-raised hairline text-ink hover:bg-overlay',
  )
  return (
    <div className={clsx('inline-flex items-center', phone ? 'gap-3 font-field' : 'gap-2', className)} role="group" aria-label={label}>
      <button type="button" className={btn} onClick={dec} disabled={value <= min} aria-label="Decrease">
        <Minus size={phone ? 24 : 16} strokeWidth={1.5} />
      </button>
      <output className={clsx('text-center tabular-nums', phone ? 'min-w-16 text-[32px] font-semibold text-f-ink font-field-mono' : 'min-w-10 font-mono text-md text-ink')}>
        {value}
      </output>
      <button type="button" className={btn} onClick={inc} disabled={value >= max} aria-label="Increase">
        <Plus size={phone ? 24 : 16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
