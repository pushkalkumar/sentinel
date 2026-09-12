import { useState } from 'react'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { ExplainResponse } from '@/lib/types'

type Branch = ExplainResponse['branch']
type Thresholds = ExplainResponse['thresholds']

interface RuleLine { text: string; branch?: Branch | 'ADVISORY' }

/**
 * spec §6.2 pseudocode with the thresholds the engine is actually running, so editing them on
 * /admin/alerts changes this block too. Lines stay under 40 columns to fit the 384px drawer.
 */
function ruleLines(t: Thresholds): RuleLine[] {
  return [
    { text: 'for each reading r:' },
    { text: '  pm_rise   = r.pm25 - pm25_5min_ago' },
    { text: '  temp_rise = r.temp - temp_2min_ago' },
    { text: '  gas_delta = r.mq2 - mq2_baseline' },
    { text: '  regional  = median(neighbours.pm25)' },
    { text: '' },
    { text: `  if pm_rise > ${t.pm_rise}`, branch: 'LOCAL_FIRE' },
    { text: `  and (temp_rise > ${t.temp_rise} or gas_delta > ${t.gas_delta})`, branch: 'LOCAL_FIRE' },
    { text: `  and r.pm25 > ${t.regional_factor} * regional:`, branch: 'LOCAL_FIRE' },
    { text: '    LOCAL_FIRE, priority 1', branch: 'LOCAL_FIRE' },
    { text: `  elif r.pm25 > ${t.hazardous_pm25}`, branch: 'HAZARDOUS_SMOKE' },
    { text: `  and regional > ${t.hazardous_regional}:`, branch: 'HAZARDOUS_SMOKE' },
    { text: '    HAZARDOUS_SMOKE, priority 2', branch: 'HAZARDOUS_SMOKE' },
    { text: `  elif pm_rise > ${t.pm_rise}`, branch: 'LOCAL_SMOKE_SUSPECT' },
    { text: `  and r.pm25 > ${t.regional_factor} * regional:`, branch: 'LOCAL_SMOKE_SUSPECT' },
    { text: '    LOCAL_SMOKE_SUSPECT, priority 3', branch: 'LOCAL_SMOKE_SUSPECT' },
    { text: '  elif band(r.pm25) worsened:', branch: 'ADVISORY' },
    { text: '    ACTIVITY_ADVISORY, priority 4', branch: 'ADVISORY' },
    { text: '  else:', branch: 'CLEAR' },
    { text: '    CLEAR', branch: 'CLEAR' },
  ]
}

export interface RuleSourceProps {
  branch: Branch
  thresholds: Thresholds
}

/** Collapsed "Show the rule" disclosure; the branch that fired is tinted with accent-dim. */
export function RuleSource({ branch, thresholds }: RuleSourceProps) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-ml-2 h-8 px-2 rounded-sm inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] transition-[color,background-color] duration-[120ms]"
      >
        {open ? <ChevronDown size={16} strokeWidth={1.5} aria-hidden /> : <ChevronRight size={16} strokeWidth={1.5} aria-hidden />}
        {open ? 'Hide the rule' : 'Show the rule'}
      </button>
      {open && (
        <pre className="mt-2 rounded-md bg-raised px-3 py-2.5 font-mono text-2xs leading-4 text-ink-3 whitespace-pre-wrap break-words">
          {ruleLines(thresholds).map((l, i) => (
            <span key={i} className={clsx('block -mx-1 px-1 rounded-xs', l.branch === branch && 'bg-accent-dim text-ink')}>
              {l.text || ' '}
            </span>
          ))}
        </pre>
      )}
    </div>
  )
}
