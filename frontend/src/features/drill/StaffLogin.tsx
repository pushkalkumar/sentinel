import { useState, type FormEvent } from 'react'
import type { StaffLoginResponse } from '@/lib/types'
import { isApiError, staffLogin } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { FieldButton } from '@/features/phone/FieldButton'
import { RING } from '@/features/phone/surface'

export interface StaffLoginProps {
  onSuccess: (res: StaffLoginResponse) => void
}

const CODE_SHAPE = /^T-[A-Z0-9]{1,4}-[A-Z0-9]{3,6}$/

/** Phone staff-code entry. Light ground, 64px input, one ink-filled action (DESIGN §8.7). */
export function StaffLogin({ onSuccess }: StaffLoginProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const clean = code.trim().toUpperCase()
    if (!CODE_SHAPE.test(clean)) {
      setError('Codes look like T-3B-7Q2: a T, your class, then the code on your badge.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      onSuccess(await staffLogin(clean))
    } catch (err) {
      if (isApiError(err, 'UNAUTHORIZED')) setError('That code is not on file. Check the letters against your badge and try again.')
      else if (isApiError(err, 'NETWORK')) setError('Could not reach the server. Try again in a moment.')
      else setError('Something went wrong. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 pt-8" noValidate>
      <div>
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink">Staff sign in</h1>
        <p className="text-[17px] leading-6 text-f-ink-2 mt-1 text-pretty">Enter the code from your staff badge. Your class loads with it.</p>
      </div>
      <Input
        fieldSize="phone"
        label="Staff code"
        value={code}
        onChange={(e) => { setCode(e.target.value); if (error) setError(null) }}
        placeholder="T-3B-7Q2"
        autoCapitalize="characters"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        inputMode="text"
        error={error}
        className={`border-transparent ${RING} rounded-lg font-field-mono text-[20px] tracking-wider uppercase`}
      />
      <FieldButton type="submit" variant="ink" loading={busy} disabled={code.trim().length === 0}>Continue</FieldButton>
    </form>
  )
}
