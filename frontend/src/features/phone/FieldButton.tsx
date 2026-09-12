import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'

export type FieldButtonVariant = 'ink' | 'outline' | 'signal' | 'ghost'
export type FieldButtonHeight = 48 | 56 | 64 | 72

export interface FieldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FieldButtonVariant
  height?: FieldButtonHeight
  loading?: boolean
  /** Full width by default; false for inline placements like the code Check button. */
  block?: boolean
}

/** Light-ground button for /m/*. `signal` is the one accent fill per screen (DESIGN §8.7). */
const VARIANT: Record<FieldButtonVariant, string> = {
  ink: 'bg-f-ink text-white active:bg-[#2A2724]',
  outline: 'bg-f-surface text-f-ink border-[1.5px] border-f-line-strong active:bg-f-canvas',
  signal: 'bg-f-signal text-white active:bg-[#0B6A78]',
  ghost: 'bg-transparent text-f-ink-2 active:bg-f-canvas',
}

const HEIGHT: Record<FieldButtonHeight, string> = {
  48: 'h-12 text-[18px]',
  56: 'h-14 text-[18px]',
  64: 'h-16 text-[20px]',
  72: 'h-[72px] text-[22px]',
}

export const FieldButton = forwardRef<HTMLButtonElement, FieldButtonProps>(function FieldButton(
  { variant = 'outline', height = 64, loading = false, block = true, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2.5 px-5 rounded-sm font-field font-semibold select-none',
        block && 'w-full',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANT[variant], HEIGHT[height], className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={24} strokeWidth={1.5} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
