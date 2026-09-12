// OWNER: fe-drill
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'

export default function DrillReport() {
  return (
    <div data-ground="field" className="min-h-dvh bg-f-canvas text-f-ink px-6"><div className="max-w-[960px] mx-auto">
      <PageHeader title="/drills/:id/report" />
      <Panel title="DrillReport">
        <p className="text-sm text-ink-2">stub</p>
      </Panel>
    </div></div>
  )
}
