// OWNER: fe-responder
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Grain } from '@/components/shell/Grain'
export default function Login() {
  return (
    <div className="min-h-dvh bg-canvas text-ink px-6 relative"><Grain /><div className="relative z-[2] max-w-[1600px] mx-auto">
      <PageHeader title="/login" />
      <Panel title="Login">
        <p className="text-sm text-ink-2">stub</p>
      </Panel>
    </div></div>
  )
}
