// OWNER: fe-responder
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { WeaDraftModal } from '@/features/novel/WeaDraftModal'
export default function IncidentDetail() {
  return (
    <>
      <PageHeader title="/responder/incident/:code" />
      <Panel title="IncidentDetail">
        <p className="text-sm text-ink-2">stub</p>
      </Panel>
      <WeaDraftModal />
    </>
  )
}
