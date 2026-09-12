import { useState, type FormEvent } from 'react'
import { Send } from 'lucide-react'
import clsx from 'clsx'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export interface MessageBoxProps {
  /** Resolves when the message event landed; rejects with an ApiClientError otherwise. */
  onSend: (text: string) => Promise<void>
  disabled?: boolean
  disabledReason?: string
  className?: string
}

const MAX = 280

/** Inline "message the reporter" row under the timeline. The reporter sees it on /m/status. */
export function MessageBox({ onSend, disabled = false, disabledReason, className }: MessageBoxProps) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const trimmed = text.trim()
  const over = trimmed.length > MAX

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy || disabled || !trimmed || over) return
    setBusy(true)
    setError(null)
    try {
      await onSend(trimmed)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the message. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className={clsx('flex flex-col gap-1.5', className)}>
      <div className="flex items-start gap-2">
        <Input
          aria-label="Message to reporter"
          placeholder={disabled ? (disabledReason ?? 'Messages are closed for this incident.') : 'Message the reporter'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled || busy}
          maxLength={MAX + 20}
          error={error ?? (over ? `Keep it under ${MAX} characters.` : null)}
        />
        <Button type="submit" icon={Send} loading={busy} disabled={disabled || !trimmed || over} className="shrink-0">
          Send
        </Button>
      </div>
      {!disabled && trimmed.length > MAX * 0.7 && (
        <span className={clsx('font-mono text-2xs self-end', over ? 'text-alarm' : 'text-ink-3')}>{trimmed.length}/{MAX}</span>
      )}
    </form>
  )
}
