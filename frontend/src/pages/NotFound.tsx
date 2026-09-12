import { Link } from 'react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Grain } from '@/components/shell/Grain'

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-canvas text-ink px-6">
      <Grain />
      <div className="max-w-[720px] mx-auto relative z-[2]">
        <PageHeader eyebrow="404" title="Page not found" />
        <Panel title="Nothing here">
          <p className="text-sm text-ink-2">
            That address does not exist. <Link to="/" className="underline decoration-line-strong hover:decoration-signal text-ink">Back to Sentinel</Link>
          </p>
        </Panel>
      </div>
    </div>
  )
}
