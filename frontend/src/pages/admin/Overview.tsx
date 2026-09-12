// OWNER: fe-admin
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { TimeMachine } from '@/features/novel/TimeMachine'
export default function Overview() {
  return (
    <>
      <PageHeader title="/admin" />
      <Panel title="Overview">
        <p className="text-sm text-ink-2">stub</p>
      </Panel>
      <TimeMachine />
    </>
  )
}
