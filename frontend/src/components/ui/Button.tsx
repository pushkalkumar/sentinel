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

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-signal text-signal-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-[#5FDBEB] active:bg-[#3BC2D4] active:translate-y-px',
  secondary: 'bg-raised text-ink border border-line-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:bg-overlay active:bg-raised active:border-line',
  ghost: 'bg-transparent text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] active:bg-[rgba(255,255,255,0.06)]',
  danger: 'bg-transparent text-alarm border border-[rgba(255,74,61,0.4)] hover:bg-[rgba(255,74,61,0.10)] active:bg-[rgba(255,74,61,0.16)]',
  resolve: 'bg-ok text-canvas hover:bg-[#6FE082] active:bg-[#4CC860]',
}

const SIZE: Record<ButtonSize, string> = {
  desktop: 'h-9 px-3.5 text-base font-medium gap-2',
  phone: 'h-16 px-5 text-[20px] font-semibold gap-2.5 font-field w-full',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'desktop', icon: Icon, loading = false, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  const iconSize = size === 'phone' ? 24 : 20
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center rounded-sm whitespace-nowrap select-none',
        'transition-[background-color,border-color,transform] duration-[120ms] ease-[var(--ease-exit)]',
        'disabled:opacity-45 disabled:pointer-events-none',
        VARIANT[variant], SIZE[size], className,
      )}
      {...rest}
    >
      {loading ? <Loader2 size={iconSize} strokeWidth={1.5} className="animate-spin" aria-hidden /> : Icon ? <Icon size={iconSize} strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </button>
  )
})
