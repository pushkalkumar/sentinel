import { useSmsStore } from '@/store/sms'
import { useSiteStore } from '@/store/site'
import type { SmsMessage } from '@/lib/types'
import { fmtSim, fmtWallZoned } from '@/lib/time'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pill } from '@/components/ui/Pill'

const COLUMNS: Column<SmsMessage>[] = [
  { key: 'sim_at', header: 'Time', mono: true, width: 72, render: (m) => <span title={fmtWallZoned(m.sent_at)}>{fmtSim(m.sim_at, 'HH:mm')}</span> },
  { key: 'zone_name', header: 'Zone', width: 140 },
  { key: 'recipient_label', header: 'Recipient', render: (m) => <span className="text-sm">{m.recipient_label} <span className="font-mono text-xs text-ink-3">{m.phone_e164}</span></span> },
  { key: 'alert_kind', header: 'Alert', width: 150, render: (m) => (m.alert_kind === 'ALL_CLEAR' ? <span className="text-xs text-ink-2">All clear</span> : <Pill kind="alert" value={m.alert_kind} />) },
  { key: 'body', header: 'Message', render: (m) => <p className="text-[13px] leading-5 whitespace-normal max-w-[36rem]">{m.body}</p> },
  { key: 'status', header: 'Status', width: 120, render: () => <span className="font-mono text-xs text-ink-3">queued (demo)</span> },
]

/** DESIGN §6.14. The SIM tag lives in the page-level panel header, not here. */
export function SmsOutbox() {
  const messages = useSmsStore((s) => s.messages)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  return (
    <DataTable
      columns={COLUMNS}
      rows={messages}
      rowKey={(m) => m.id}
      loading={!loaded && messages.length === 0}
      error={messages.length === 0 ? error : null}
      empty="No messages yet. The engine writes here when a zone crosses the hazardous threshold or a fire is detected."
      className="max-h-[32rem]"
    />
  )
}
