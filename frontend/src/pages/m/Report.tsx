import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import type { CreateIncidentResponse, IncidentType } from '@/lib/types'
import { createIncident, errorText, isApiError } from '@/lib/api'
import { Stepper } from '@/components/ui/Stepper'
import { TypeTiles } from '@/features/phone/TypeTiles'
import { CodeScreen } from '@/features/phone/CodeScreen'
import { FieldButton } from '@/features/phone/FieldButton'
import { FIELD_INPUT } from '@/features/phone/surface'

const TEXT_MAX = 280
const GEO_TIMEOUT_MS = 8000

type Geo = { state: 'off' } | { state: 'asking' } | { state: 'on'; lat: number; lng: number } | { state: 'failed' }

export default function Report() {
  const [type, setType] = useState<IncidentType | null>(null)
  const [count, setCount] = useState(1)
  const [text, setText] = useState('')
  const [geo, setGeo] = useState<Geo>({ state: 'off' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateIncidentResponse | null>(null)

  if (result) return <CodeScreen result={result} />

  const toggleGeo = (on: boolean) => {
    if (!on) {
      setGeo({ state: 'off' })
      return
    }
    if (!('geolocation' in navigator)) {
      setGeo({ state: 'failed' })
      return
    }
    setGeo({ state: 'asking' })
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({ state: 'on', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGeo({ state: 'failed' }),
      { timeout: GEO_TIMEOUT_MS, maximumAge: 60_000 },
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!type) {
      setError('Pick what is happening first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await createIncident({
        type,
        count,
        text: text.trim() || undefined,
        lat: geo.state === 'on' ? geo.lat : undefined,
        lng: geo.state === 'on' ? geo.lng : undefined,
      })
      setResult(res)
    } catch (err) {
      if (isApiError(err, 'DEVICE_BLOCKED')) setError('This device has been blocked after repeated false reports. Find a staff member.')
      else if (isApiError(err, 'RATE_LIMITED')) setError('You already have 3 open reports. Check their status instead.')
      else if (isApiError(err, 'VALIDATION')) setError('Check the count and the note, then send again.')
      else setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  const geoChecked = geo.state === 'on' || geo.state === 'asking'

  return (
    <form onSubmit={submit} className="flex flex-col gap-8 pt-2 font-field" noValidate>
      <Link to="/m" className="inline-flex items-center gap-1.5 min-h-12 -ml-1 px-1 text-[16px] text-f-ink-2 self-start">
        <ArrowLeft size={20} strokeWidth={1.5} aria-hidden /> Back
      </Link>

      <section className="flex flex-col gap-4">
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink">What is happening?</h1>
        <TypeTiles value={type} onChange={(t) => { setType(t); if (error) setError(null) }} />
      </section>

      <section className="flex items-center justify-between gap-4">
        <span className="text-[17px] text-f-ink">How many people?</span>
        <Stepper value={count} onChange={setCount} min={1} max={500} label="How many people" />
      </section>

      <label className="block">
        <span className="block text-[17px] text-f-ink mb-2">Anything else?</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, TEXT_MAX))}
          rows={2}
          maxLength={TEXT_MAX}
          placeholder="Room, floor, what you see"
          className={`${FIELD_INPUT} py-3.5 resize-none`}
        />
        <span className="block mt-1.5 text-[14px] text-f-ink-2 tabular-nums text-right">{text.length} / {TEXT_MAX}</span>
      </label>

      <label className="flex items-center gap-4 min-h-12 cursor-pointer">
        <input
          type="checkbox"
          checked={geoChecked}
          onChange={(e) => toggleGeo(e.target.checked)}
          className="size-7 shrink-0 accent-[var(--color-f-ink)]"
        />
        <span className="text-[17px] text-f-ink">
          Share my location
          <span className="block text-[14px] leading-5 text-f-ink-2">
            {geo.state === 'asking' && 'Asking your phone'}
            {geo.state === 'on' && 'Location attached.'}
            {geo.state === 'failed' && 'Location not available. The report still works without it.'}
            {geo.state === 'off' && 'Optional. Helps responders find you.'}
          </span>
        </span>
      </label>

      {error && <p role="alert" className="text-[16px] text-f-alarm">{error}</p>}

      {/* The one action on the screen stays reachable without scrolling, whatever the form is doing. */}
      <div className="sticky bottom-0 -mx-6 px-6 pt-4 pb-3 bg-gradient-to-t from-f-canvas via-f-canvas to-transparent">
        <FieldButton type="submit" variant="ink" loading={busy} disabled={!type}>Send report</FieldButton>
      </div>
    </form>
  )
}
