import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { DrillKind } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { DRILL_KIND_LABEL, DRILL_KINDS } from './kinds'

export interface StartDrillProps {
  onStart: (kind: DrillKind) => Promise<void>
  error?: string | null
}

/** DESIGN §8.3 empty state: one primary action plus a ghost kind dropdown. */
export function StartDrill({ onStart, error }: StartDrillProps) {
  const [kind, setKind] = useState<DrillKind>('fire')
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      await onStart(kind)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-[320px] flex flex-col items-center justify-center text-center gap-6 px-6">
      <p className="text-md text-ink-2 max-w-sm text-pretty">
        No drill running. Start one and every teacher&apos;s phone switches to roll call.
      </p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <label className="relative inline-flex items-center h-10 rounded-md text-ink-2 hover:text-ink">
          <span className="sr-only">Drill kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DrillKind)}
            className="appearance-none h-10 pl-3 pr-9 bg-transparent text-base font-medium text-inherit outline-none cursor-pointer rounded-md hover:bg-[rgba(255,255,255,0.04)]"
          >
            {DRILL_KINDS.map((k) => (
              <option key={k} value={k} className="bg-surface text-ink">{DRILL_KIND_LABEL[k]}</option>
            ))}
          </select>
          <ChevronDown size={16} strokeWidth={1.5} aria-hidden className="absolute right-3 pointer-events-none" />
        </label>
        <Button variant="primary" onClick={start} loading={busy}>
          Start {DRILL_KIND_LABEL[kind].toLowerCase()}
        </Button>
      </div>
      {error && <p className="text-sm text-alarm">{error}</p>}
    </div>
  )
}
