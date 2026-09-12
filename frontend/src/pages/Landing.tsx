// OWNER: fe-landing
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Grain } from '@/components/shell/Grain'
import { SafetyFooter } from '@/components/SafetyFooter'
export default function Landing() {
  return (
    <div className="min-h-dvh bg-canvas text-ink px-6 relative"><Grain /><div className="relative z-[2] max-w-[1600px] mx-auto">
      <PageHeader title="/" />
      <Panel title="Landing">
        <p className="text-sm text-ink-2">stub</p>
      </Panel>
      <SafetyFooter />
    </div></div>
  )
}
