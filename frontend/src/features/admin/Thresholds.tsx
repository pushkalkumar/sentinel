import { useEffect, useState } from 'react'
import { useSiteStore } from '@/store/site'
import { useSessionStore } from '@/store/session'
import { useUiStore } from '@/store/ui'
import { errorText, getThresholds, putThresholds } from '@/lib/api'
import type { PolicyPack } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'

type NumericKey = 'pm_rise' | 'temp_rise' | 'gas_delta' | 'regional_factor' | 'hazardous_pm25'

/** CONTRACT §3.5 validation ranges, checked client-side before the PUT. */
const FIELDS: { key: NumericKey; label: string; hint: string; min: number; max: number; step: number }[] = [
  { key: 'pm_rise', label: 'PM2.5 rise in 5 min', hint: 'Fire branch, µg/m³. 5 to 200.', min: 5, max: 200, step: 1 },
  { key: 'temp_rise', label: 'Temperature rise in 2 min', hint: 'Fire branch, °C. 0.5 to 20.', min: 0.5, max: 20, step: 0.1 },
  { key: 'gas_delta', label: 'MQ-2 gas delta', hint: 'Fire branch, raw counts over baseline. 20 to 1000.', min: 20, max: 1000, step: 10 },
  { key: 'regional_factor', label: 'Local vs regional ratio', hint: 'Used by both the fire and the smoke-suspect branches. 1.1 to 5.', min: 1.1, max: 5, step: 0.1 },
  { key: 'hazardous_pm25', label: 'Hazardous SMS threshold', hint: 'PM2.5 in µg/m³. Fan-out to registered phones above this level.', min: 50, max: 1000, step: 5 },
]

export function Thresholds() {
  const tenantId = useSiteStore((s) => s.tenant?.id) ?? useSessionStore.getState().user?.tenant.id ?? null
  const toast = useUiStore((s) => s.toast)
  const [pack, setPack] = useState<PolicyPack | null>(null)
  const [draft, setDraft] = useState<Record<NumericKey, string>>({ pm_rise: '', temp_rise: '', gas_delta: '', regional_factor: '', hazardous_pm25: '' })
  const [errors, setErrors] = useState<Partial<Record<NumericKey, string>>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (tenantId === null) return
    getThresholds(tenantId)
      .then((p) => {
        setPack(p)
        setDraft({
          pm_rise: String(p.pm_rise), temp_rise: String(p.temp_rise), gas_delta: String(p.gas_delta),
          regional_factor: String(p.regional_factor), hazardous_pm25: String(p.hazardous_pm25),
        })
      })
      .catch((e) => setLoadError(errorText(e)))
  }, [tenantId])

  if (tenantId === null) return <p className="text-sm text-ink-3">Sign in as a site admin to edit thresholds.</p>
  if (loadError) return <p className="text-sm text-alarm">{loadError}</p>
  if (!pack) return <Skeleton className="w-64" />

  const validate = (): Partial<PolicyPack> | null => {
    const next: Partial<Record<NumericKey, string>> = {}
    const patch: Partial<PolicyPack> = {}
    for (const f of FIELDS) {
      const v = Number(draft[f.key])
      if (draft[f.key].trim() === '' || Number.isNaN(v)) next[f.key] = 'Enter a number.'
      else if (v < f.min || v > f.max) next[f.key] = `Use a value between ${f.min} and ${f.max}.`
      else if (v !== pack[f.key]) patch[f.key] = v
    }
    setErrors(next)
    return Object.keys(next).length === 0 ? patch : null
  }

  const save = async () => {
    const patch = validate()
    if (!patch) return
    if (Object.keys(patch).length === 0) { toast('No changes to save'); return }
    setSaving(true)
    try {
      const p = await putThresholds(tenantId, patch)
      setPack(p)
      toast('Thresholds saved. They apply on the next reading.')
    } catch (e) {
      setErrors({ pm_rise: errorText(e) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save() }}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sentence-case field labels: the panel's one signage label is its title (DESIGN_V2 §2.2). */}
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-1.5 min-w-0">
            <label htmlFor={`th-${f.key}`} className="text-[13px] text-ink-2">{f.label}</label>
            <Input
              id={`th-${f.key}`}
              hint={f.hint}
              error={errors[f.key]}
              type="number"
              inputMode="decimal"
              step={f.step}
              value={draft[f.key]}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" loading={saving}>Save thresholds</Button>
        <span className="text-sm text-ink-3">Band breakpoints follow EPA PM2.5 and are fixed in the demo.</span>
      </div>
    </form>
  )
}
