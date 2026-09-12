import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { useSmsStore } from '@/store/sms'
import { useSiteStore } from '@/store/site'
import type { SmsMessage } from '@/lib/types'
import { fmtSim } from '@/lib/time'
import { ALERT_META } from '@/lib/bands'
import { Skeleton } from '@/components/ui/Skeleton'

interface Group {
  key: string
  simAt: string
  zones: string[]
  kindLabel: string
  body: string
  recipients: SmsMessage[]
}

/** One row per alert, not per phone: "12 recipients in Campus South" (design item 12, ux item 36). */
function group(messages: SmsMessage[]): Group[] {
  const out = new Map<string, Group>()
  for (const m of messages) {
    const key = `${m.alert_id}-${m.alert_kind}`
    const g = out.get(key)
    if (!g) {
      out.set(key, {
        key,
        simAt: m.sim_at,
        zones: [m.zone_name],
        kindLabel: m.alert_kind === 'ALL_CLEAR' ? 'All clear' : ALERT_META[m.alert_kind].label,
        body: m.body,
        recipients: [m],
      })
      continue
    }
    g.recipients.push(m)
    if (!g.zones.includes(m.zone_name)) g.zones.push(m.zone_name)
    if (m.sim_at < g.simAt) g.simAt = m.sim_at
  }
  return [...out.values()].sort((a, b) => b.simAt.localeCompare(a.simAt))
}

function zoneText(zones: string[]): string {
  if (zones.length === 1) return `in ${zones[0]}`
  if (zones.length === 2) return `in ${zones[0]} and ${zones[1]}`
  return `in ${zones.length} zones`
}

/** DESIGN_V2 §4: the outbox collapses to a count with a disclosure. */
export function SmsOutbox() {
  const messages = useSmsStore((s) => s.messages)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const [open, setOpen] = useState<string | null>(null)
  const groups = useMemo(() => group(messages), [messages])

  if (!loaded && messages.length === 0) return <div className="px-panel pb-5"><Skeleton /></div>
  if (error && messages.length === 0) return <p className="px-panel pb-5 text-sm text-alarm">{error}</p>
  if (groups.length === 0) {
    return (
      <p className="px-panel pt-2 pb-5 text-sm text-ink-3">
        Nothing sent yet. The engine writes here when a zone crosses the hazardous threshold or a fire is detected.
      </p>
    )
  }

  return (
    <ul className="px-panel pb-4">
      {groups.map((g) => {
        const expanded = open === g.key
        const n = g.recipients.length
        return (
          <li key={g.key} className="border-b border-line last:border-b-0 py-3">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : g.key)}
              className="w-full flex items-baseline gap-3 text-left group"
            >
              <span className="font-mono text-xs text-ink-3 tabular-nums shrink-0 w-12">{fmtSim(g.simAt, 'HH:mm')}</span>
              <span className="text-sm text-ink min-w-0 truncate">
                {g.kindLabel}, {n} {n === 1 ? 'recipient' : 'recipients'} {zoneText(g.zones)}
              </span>
              <span className="ml-auto shrink-0 flex items-center gap-2 text-xs text-ink-3">
                {expanded ? 'hide' : 'who'}
                <ChevronDown size={14} strokeWidth={1.5} aria-hidden className={clsx('transition-transform duration-[160ms]', expanded && 'rotate-180')} />
              </span>
            </button>
            <p className="mt-2 text-[13px] leading-5 text-ink-2 max-w-[48rem]">{g.body}</p>
            {expanded && (
              <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-y-1">
                {g.recipients.map((m) => (
                  <li key={m.id} className="flex items-baseline gap-2 text-sm">
                    <span className="text-ink-2 truncate">{m.recipient_label}</span>
                    <span className="font-mono text-xs text-ink-3">{m.phone_e164}</span>
                    <span className="ml-auto text-xs text-ink-4 truncate">{m.zone_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
