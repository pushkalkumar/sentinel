import clsx from 'clsx'

export interface SegmentedOption<V extends string> { value: V; label: string; disabled?: boolean }

export interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[]
  value: V
  onChange: (v: V) => void
  label?: string
  className?: string
}

export function Segmented<V extends string>({ options, value, onChange, label, className }: SegmentedProps<V>) {
  return (
    <div role="radiogroup" aria-label={label} className={clsx('inline-flex p-0.5 rounded-sm bg-raised hairline', !/\bh-\d/.test(className ?? '') && 'h-9', className)}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={clsx(
              'px-3 rounded-[3px] text-sm font-medium transition-[background-color,color] duration-[120ms] disabled:opacity-45',
              active ? 'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
