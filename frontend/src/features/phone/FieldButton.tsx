import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { RING } from './surface'

export type FieldButtonVariant = 'ink' | 'surface' | 'ghost'
export type FieldButtonHeight = 48 | 56 | 64 | 72

export interface FieldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: FieldButtonVariant
  height?: FieldButtonHeight
  loading?: boolean
  /** Full width by default; false for inline placements like the code Check button. */
  block?: boolean
}

/** Light-ground button for /m/*. `ink` is the one solid button per screen (DESIGN_V2 §4). */
const VARIANT: Record<FieldButtonVariant, string> = {
  ink: 'bg-f-ink text-white active:bg-[#2A2724]',
  surface: `bg-f-surface text-f-ink ${RING} active:bg-f-canvas`,
  ghost: 'bg-transparent text-f-ink-2 active:bg-[rgba(11,10,9,0.04)]',
}

const HEIGHT: Record<FieldButtonHeight, string> = {
  48: 'h-12 text-[17px]',
  56: 'h-14 text-[17px]',
  64: 'h-16 text-[19px]',
  72: 'h-[72px] text-[20px]',
}

export const FieldButton = forwardRef<HTMLButtonElement, FieldButtonProps>(function FieldButton(
  { variant = 'surface', height = 64, loading = false, block = true, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2.5 px-5 rounded-lg font-field font-semibold select-none',
        'transition-[background-color,scale] duration-[120ms] ease-[var(--ease-exit)] active:scale-[0.98]',
        block && 'w-full',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant], HEIGHT[height], className,
      )}
      {...rest}
    >
      {loading && <Loader2 size={22} strokeWidth={1.5} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})
