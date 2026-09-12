import { useSmsStore } from '@/store/sms'
import { useDisplayAlerts } from '@/store/select'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Pill } from '@/components/ui/Pill'
import { fmtSim } from '@/lib/time'
import { Thresholds } from '@/features/admin/Thresholds'
import { Recipients } from '@/features/admin/Recipients'
import { SmsOutbox } from '@/features/admin/SmsOutbox'

export default function Alerts() {
  const count = useSmsStore((s) => s.count)
  const open = useDisplayAlerts()
  return (
    <>
      <PageHeader title="Thresholds, recipients and the outbox" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Panel title="Open alerts" meta={open.length > 0 ? `${open.length}` : undefined}>
          {open.length === 0
            ? <p className="text-sm text-ink-3">No open alerts. The engine opens one when a node crosses a rule.</p>
            : (
              <ul className="flex flex-col gap-2">
                {open.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <Pill kind="alert" value={a.kind} />
                    <span className="text-ink truncate">{a.node_label ?? a.zone_name}</span>
                    <span className="text-ink-3 truncate">{a.reason}</span>
                    <span className="ml-auto font-mono text-xs text-ink-3">{fmtSim(a.started_at, 'HH:mm:ss')}</span>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
        <Panel title="Thresholds">
          <Thresholds />
        </Panel>
        <Panel title="Zones and recipients" className="lg:col-span-2">
          <Recipients />
        </Panel>
        <Panel title="SMS outbox" meta={`${count} messages, provider disabled in demo`} padded={false} className="lg:col-span-2">
          <SmsOutbox />
        </Panel>
      </div>
    </>
  )
}
