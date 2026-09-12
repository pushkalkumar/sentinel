import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import clsx from 'clsx'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  size?: never
  fieldSize?: 'desktop' | 'phone'
  error?: string | null
  label?: string
  hint?: string
}

const BASE = 'w-full rounded-sm bg-raised hairline text-ink placeholder:text-ink-3 px-3 outline-none focus:border-signal-line transition-[border-color] duration-[120ms]'
const FIELD_BASE = 'w-full rounded-sm bg-f-surface border border-f-line-strong text-f-ink placeholder:text-f-ink-2 px-4 outline-none font-field text-[18px] focus:border-f-signal'

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { fieldSize = 'desktop', error, label, hint, className, id, ...rest }, ref,
) {
  const phone = fieldSize === 'phone'
  const inputId = id ?? (label ? `in-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
  return (
    <label className="block min-w-0" htmlFor={inputId}>
      {label && <span className={clsx('block mb-1.5', phone ? 'text-[16px] text-f-ink-2 font-field' : 'label-signage')}>{label}</span>}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        className={clsx(phone ? `${FIELD_BASE} h-16` : `${BASE} h-9 text-base`, error && (phone ? 'border-f-alarm' : 'border-[rgba(224,87,75,0.6)]'), className)}
        {...rest}
      />
      {error ? (
        <span className={clsx('block mt-1.5', phone ? 'text-[14px] text-f-alarm font-field' : 'text-sm text-alarm')}>{error}</span>
      ) : hint ? (
        <span className={clsx('block mt-1.5', phone ? 'text-[14px] text-f-ink-2 font-field' : 'text-sm text-ink-3')}>{hint}</span>
      ) : null}
    </label>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  fieldSize?: 'desktop' | 'phone'
  error?: string | null
  label?: string
  hint?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { fieldSize = 'desktop', error, label, hint, className, id, rows = 3, ...rest }, ref,
) {
  const phone = fieldSize === 'phone'
  const inputId = id ?? (label ? `ta-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined)
  return (
    <label className="block min-w-0" htmlFor={inputId}>
      {label && <span className={clsx('block mb-1.5', phone ? 'text-[16px] text-f-ink-2 font-field' : 'label-signage')}>{label}</span>}
      <textarea
        ref={ref}
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={clsx(phone ? `${FIELD_BASE} py-3` : `${BASE} py-2 text-base`, 'resize-y', error && (phone ? 'border-f-alarm' : 'border-[rgba(224,87,75,0.6)]'), className)}
        {...rest}
      />
      {error ? (
        <span className={clsx('block mt-1.5', phone ? 'text-[14px] text-f-alarm font-field' : 'text-sm text-alarm')}>{error}</span>
      ) : hint ? (
        <span className={clsx('block mt-1.5', phone ? 'text-[14px] text-f-ink-2 font-field' : 'text-sm text-ink-3')}>{hint}</span>
      ) : null}
    </label>
  )
})
