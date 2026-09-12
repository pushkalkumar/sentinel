import { forwardRef, type ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import type { LucideIcon } from 'lucide-react'
import { Loader2 } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'resolve'
export type ButtonSize = 'desktop' | 'phone'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: LucideIcon
  loading?: boolean
}

/** DESIGN_V2 §6: primary is solid bone, secondary is an outline. No teal fills anywhere. */
const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-[#E4DBCD] active:bg-[#CFC4B3]',
  secondary: 'bg-transparent text-ink border border-line-strong hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.18)] active:bg-[rgba(255,255,255,0.06)]',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] active:bg-[rgba(255,255,255,0.06)]',
  danger: 'bg-transparent text-alarm border border-[rgba(224,87,75,0.35)] hover:bg-alarm-dim active:bg-[rgba(224,87,75,0.2)]',
  resolve: 'bg-transparent text-ok border border-[rgba(109,184,122,0.35)] hover:bg-ok-dim active:bg-[rgba(109,184,122,0.2)]',
}

const SIZE: Record<ButtonSize, string> = {
  desktop: 'h-10 px-4 text-base font-medium gap-2 rounded-md',
  phone: 'h-16 px-5 text-[20px] font-semibold gap-2.5 font-field w-full rounded-lg',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'desktop', icon: Icon, loading = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'phone' ? 24 : 18
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center whitespace-nowrap select-none',
        'transition-[background-color,border-color,color,scale] duration-[120ms] ease-[var(--ease-exit)] active:scale-[0.98]',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANT[variant], SIZE[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} strokeWidth={1.5} className="animate-spin" aria-hidden /> : Icon ? <Icon size={iconSize} strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </button>
  )
})
