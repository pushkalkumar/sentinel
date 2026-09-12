import { useEffect, useState } from 'react'
import { useSiteStore } from '@/store/site'
import { addRecipient, errorText, isApiError, listRecipients } from '@/lib/api'
import type { Recipient } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DataTable, type Column } from '@/components/ui/DataTable'

/** CONTRACT §3.5: `^\+[1-9]\d{7,14}$`. */
const E164 = /^\+[1-9]\d{7,14}$/

const COLUMNS: Column<Recipient>[] = [
  { key: 'zone_name', header: 'Zone' },
  { key: 'phone_e164', header: 'Phone', mono: true },
  { key: 'label', header: 'Label' },
  { key: 'opted_out_at', header: 'Status', render: (r) => <span className="text-xs text-ink-3">{r.opted_out_at ? 'opted out' : 'consented'}</span> },
]

export function Recipients() {
  const zones = useSiteStore((s) => s.zones)
  const [rows, setRows] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoneId, setZoneId] = useState<number | null>(null)
  const [phone, setPhone] = useState('')
  const [label, setLabel] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [counts, setCounts] = useState<Record<number, number>>({})

  useEffect(() => {
    listRecipients()
      .then((r) => { setRows(r); setError(null) })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (zoneId === null && zones.length > 0) setZoneId(zones[0].id)
  }, [zones, zoneId])

  const countFor = (id: number) => counts[id] ?? zones.find((z) => z.id === id)?.recipient_count ?? 0

  const submit = async () => {
    if (zoneId === null) return
    const p = phone.trim()
    if (!E164.test(p)) { setFormError('Use the international format, like +12065550123.'); return }
    if (!label.trim()) { setFormError('Add a label so staff know who this is.'); return }
    setSaving(true)
    setFormError(null)
    try {
      const r = await addRecipient(zoneId, p, label.trim())
      setRows([r, ...rows])
      setCounts({ ...counts, [zoneId]: countFor(zoneId) + 1 })
      setPhone('')
      setLabel('')
    } catch (e) {
      setFormError(isApiError(e, 'CONFLICT') || isApiError(e, 'DUPLICATE') ? 'That phone is already registered in this zone.' : errorText(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-wrap gap-2">
        {zones.map((z) => (
          <li key={z.id}>
            <button
              type="button"
              onClick={() => setZoneId(z.id)}
              aria-pressed={zoneId === z.id}
              className={`h-8 px-3 rounded-sm text-sm flex items-center gap-2 transition-[background-color,border-color] duration-[120ms] ${zoneId === z.id ? 'bg-raised border border-line-strong text-ink' : 'hairline text-ink-2 hover:text-ink'}`}
            >
              {z.name}
              <span className="font-mono text-xs text-ink-3 tabular-nums">{countFor(z.id)}</span>
            </button>
          </li>
        ))}
        {zones.length === 0 && <li className="text-sm text-ink-3">No zones on this site.</li>}
      </ul>
      <form className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <Input label="Phone (E.164)" placeholder="+12065550123" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} error={formError} />
        <Input label="Label" placeholder="Parent · 4B" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button type="submit" variant="secondary" loading={saving} disabled={zoneId === null}>Add recipient</Button>
      </form>
      <DataTable
        columns={COLUMNS}
        rows={zoneId === null ? rows : rows.filter((r) => r.zone_id === zoneId)}
        rowKey={(r) => r.id}
        loading={loading}
        error={error}
        empty="No recipients in this zone yet. Add a phone above to receive simulated alerts."
        className="max-h-72"
      />
    </div>
  )
}
