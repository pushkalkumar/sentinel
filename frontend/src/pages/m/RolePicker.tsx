import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { useSessionStore } from '@/store/session'
import { usePhoneStore } from '@/features/phone/phoneStore'
import { FieldButton } from '@/features/phone/FieldButton'
import { DevToggle } from '@/features/phone/DevToggle'
import { RING, SLAB } from '@/features/phone/surface'

/** CONTRACT §4.4 alphabet: no 0/O/1/I/L. */
const CODE_CHARS = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g
const CODE_LEN = 4

export default function RolePicker() {
  const navigate = useNavigate()
  const pickedNodeId = useSessionStore((s) => s.pickedNodeId)
  const node = usePhoneStore((s) => s.node)
  const openPicker = usePhoneStore((s) => s.openPicker)
  const [code, setCode] = useState('')

  const siteLine = node ? node.site.name : pickedNodeId ? `Node ${pickedNodeId}` : 'No node picked'
  const placeLine = node ? node.label : null

  const submitCode = (e: FormEvent) => {
    e.preventDefault()
    if (code.length !== CODE_LEN) return
    navigate(`/m/status?code=SN-${code}`)
  }

  return (
    <div className="flex flex-col gap-8 pt-8 font-field">
      <div>
        <DevToggle>
          <span className="block text-[30px] font-semibold leading-none tracking-[-0.01em] text-f-ink">Sentinel</span>
        </DevToggle>
        <p className="text-[17px] text-f-ink-2 mt-2">
          {siteLine}
          {placeLine && <span className="text-f-ink"> {placeLine}</span>}
        </p>
        <button type="button" onClick={openPicker} className="min-h-12 -ml-1 px-1 text-[16px] font-medium text-f-signal">
          {pickedNodeId ? 'Change node' : 'Pick the node next to you'}
        </button>
      </div>

      <nav className="flex flex-col gap-3" aria-label="Who are you">
        <FieldButton height={72} variant="ink" onClick={() => navigate('/m/report')}>I need help</FieldButton>
        <FieldButton height={64} onClick={() => navigate('/m/staff')}>I'm staff</FieldButton>
        <FieldButton height={64} onClick={() => navigate('/m/responder')}>I'm a responder</FieldButton>
      </nav>

      <form onSubmit={submitCode} className="flex flex-col gap-3" noValidate>
        <label htmlFor="have-code" className="text-[17px] text-f-ink">Have a code?</label>
        <div className="flex gap-2">
          <div className={`flex-1 min-w-0 flex items-center h-16 px-4 ${SLAB} rounded-lg ${RING} focus-within:shadow-[0_0_0_2px_var(--color-f-signal)]`}>
            <span aria-hidden className="font-field-mono text-[22px] text-f-ink-2/60 tabular-nums">SN-</span>
            <input
              id="have-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(CODE_CHARS, '').slice(0, CODE_LEN))}
              placeholder="7K3F"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              maxLength={CODE_LEN}
              aria-describedby="code-hint"
              className="flex-1 min-w-0 h-full bg-transparent outline-none font-field-mono text-[22px] tracking-[0.18em] text-f-ink placeholder:text-f-ink-2/40 placeholder:tracking-[0.18em] uppercase tabular-nums"
            />
          </div>
          <FieldButton type="submit" block={false} className="w-24 shrink-0" disabled={code.length !== CODE_LEN}>Check</FieldButton>
        </div>
        <p id="code-hint" className="text-[14px] text-f-ink-2">Four letters or numbers. No zero, no letter O.</p>
      </form>
    </div>
  )
}
