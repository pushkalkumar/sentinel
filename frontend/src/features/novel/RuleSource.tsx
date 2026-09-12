import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ExplainResponse } from '@/lib/types'

type Branch = ExplainResponse['branch']

interface RuleLine { text: string; branch?: Branch | 'ADVISORY' }

/** spec §6.2 pseudocode, with each branch's lines tagged so the fired one can be highlighted. */
const RULE: RuleLine[] = [
  { text: 'for each node reading r:' },
  { text: '    pm_rise   = r.pm25 - pm25_5min_ago' },
  { text: '    temp_rise = r.temp - temp_2min_ago' },
  { text: '    gas_delta = r.mq2 - mq2_baseline' },
  { text: '    regional  = median(neighbours.pm25)' },
  { text: '' },
  { text: '    if pm_rise > 40 and (temp_rise > 3 or gas_delta > threshold)', branch: 'LOCAL_FIRE' },
  { text: '       and r.pm25 > 2 * regional:', branch: 'LOCAL_FIRE' },
  { text: '        LOCAL_FIRE (priority 1)          # this node, this spot', branch: 'LOCAL_FIRE' },
  { text: '    elif r.pm25 > 225.5 and regional > 150:', branch: 'HAZARDOUS_SMOKE' },
  { text: '        HAZARDOUS_SMOKE (priority 2)     # regional event', branch: 'HAZARDOUS_SMOKE' },
  { text: '    elif pm_rise > 40 and r.pm25 > 2 * regional:', branch: 'LOCAL_SMOKE_SUSPECT' },
  { text: '        LOCAL_SMOKE_SUSPECT (priority 3) # one node spiking, no heat', branch: 'LOCAL_SMOKE_SUSPECT' },
  { text: '    elif band(r.pm25) worsened since last decision:', branch: 'ADVISORY' },
  { text: '        ACTIVITY_ADVISORY (priority 4)   # update the decision card', branch: 'ADVISORY' },
  { text: '    else:', branch: 'CLEAR' },
  { text: '        CLEAR', branch: 'CLEAR' },
]

export interface RuleSourceProps {
  branch: Branch
}

/** Collapsed "Show rule" block; the fired branch is highlighted in signal-dim. */
export function RuleSource({ branch }: RuleSourceProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="hairline rounded-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full h-8 px-3 flex items-center gap-2 text-xs text-ink-2 hover:text-ink"
      >
        {open ? <ChevronDown size={16} strokeWidth={1.5} aria-hidden /> : <ChevronRight size={16} strokeWidth={1.5} aria-hidden />}
        {open ? 'Hide rule' : 'Show rule'}
        <span className="ml-auto font-mono text-2xs text-ink-3">spec §6.2</span>
      </button>
      {open && (
        <pre className="border-t border-line px-3 py-2 font-mono text-2xs leading-4 text-ink-3 overflow-x-auto">
          {RULE.map((l, i) => (
            <span key={i} className={clsx('block -mx-1 px-1 rounded-xs', l.branch === branch && 'bg-signal-dim text-ink')}>
              {l.text || ' '}
            </span>
          ))}
        </pre>
      )}
    </div>
  )
}
