import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import type { NodeId } from '@/lib/types'
import { ALERT_META } from '@/lib/bands'
import { Skeleton } from '@/components/ui/Skeleton'
import { getAssess, MODEL_CLASSES, type Assessment, type ModelClass } from '@/features/ai/aiApi'

const POLL_MS = 4000
const HONESTY = 'Trained on the simulated day. Rules decide; the model advises.'

const CLASS_LABEL: Record<ModelClass, string> = { fire: 'Fire', sky: 'Sky', clear: 'Clear', suspect: 'Suspect' }
const CLASS_COLOR: Record<ModelClass, string> = {
  fire: ALERT_META.LOCAL_FIRE.color,
  sky: ALERT_META.HAZARDOUS_SMOKE.color,
  clear: '#6DB87A',
  suspect: ALERT_META.LOCAL_SMOKE_SUSPECT.color,
}

const FEATURE_LABEL: Record<string, string> = {
  pm25: 'PM2.5',
  pm_rise_5m: 'PM rise, 5 min',
  temp_rise_2m: 'Temp rise, 2 min',
  gas_delta: 'Gas delta',
  ratio_to_neighbour_median: 'Ratio to neighbours',
  neighbour_spread: 'Neighbour spread',
  rh_drop: 'Humidity drop',
}

function useAssessment(nodeId: NodeId, live: boolean) {
  const [data, setData] = useState<Assessment | null>(null)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  useEffect(() => {
    seq.current += 1
    const mySeq = seq.current
    setData(null)
    setFailed(false)
    const run = async () => {
      try {
        const res = await getAssess(nodeId)
        if (seq.current === mySeq) { setData(res); setFailed(false) }
      } catch {
        if (seq.current === mySeq) setFailed(true)
      }
    }
    void run()
    if (!live) return
    const id = setInterval(() => void run(), POLL_MS)
    return () => clearInterval(id)
  }, [nodeId, live])
  return { data, failed }
}

function ProbBar({ cls, p, top }: { cls: ModelClass; p: number; top: boolean }) {
  return (
    <li className="grid grid-cols-[64px_1fr_40px] items-center gap-3 h-5">
      <span className={clsx('text-xs', top ? 'text-ink' : 'text-ink-3')}>{CLASS_LABEL[cls]}</span>
      <span className="h-[3px] rounded-full bg-[rgba(255,255,255,0.05)] overflow-hidden">
        <span
          className="block h-full rounded-full transition-[width] duration-[400ms]"
          style={{ width: `${Math.max(1, Math.round(p * 100))}%`, background: top ? CLASS_COLOR[cls] : 'var(--color-ink-4)' }}
        />
      </span>
      <span className={clsx('font-mono text-xs tabular-nums text-right', top ? 'text-ink' : 'text-ink-4')}>{(p * 100).toFixed(0)}%</span>
    </li>
  )
}

/**
 * The model's view under the rule checks. Four thin bars, an agreement line, the three features that
 * pushed the winning class, the drift note when flagged. Quiet on purpose: this never opens an alert.
 */
export function SecondOpinion({ nodeId, live }: { nodeId: NodeId; live: boolean }) {
  const { data, failed } = useAssessment(nodeId, live)

  return (
    <section aria-label="Second opinion">
      <header className="flex items-baseline gap-3 mb-3">
        <h3 className="label-signage">Second opinion</h3>
        {!live && <span className="text-xs text-ink-4">live window</span>}
      </header>
      {failed && <p className="text-xs text-ink-4">Model unavailable; the rules above stand on their own.</p>}
      {!failed && !data && <Skeleton className="w-40" />}
      {data && !data.model.p && <p className="text-xs text-ink-4">{data.model.note ?? 'Nothing to assess yet.'}</p>}
      {data && data.model.p && data.model.top_class && (
        <div className="flex flex-col gap-4">
          <ul className="flex flex-col gap-1">
            {MODEL_CLASSES.map((cls) => (
              <ProbBar key={cls} cls={cls} p={data.model.p![cls] ?? 0} top={cls === data.model.top_class} />
            ))}
          </ul>
          <p className="text-sm text-ink-2">
            {data.agreement === false
              ? <>Leans <span className="text-ink">{CLASS_LABEL[data.model.top_class].toLowerCase()}</span>; disagrees with the rule. Worth a look, not an alarm.</>
              : <>Agrees with the rule.</>}
          </p>
          {data.model.top_features.length > 0 && (
            <ul className="flex flex-col">
              {data.model.top_features.map((f) => (
                <li key={f.name} className="h-7 flex items-center gap-3 text-xs">
                  <span className="text-ink-3 truncate">{FEATURE_LABEL[f.name] ?? f.name}</span>
                  <span className="font-mono text-ink-4 tabular-nums">{f.value}</span>
                  <span className={clsx('ml-auto font-mono tabular-nums', f.contribution >= 0 ? 'text-ink-2' : 'text-ink-4')}>
                    {f.contribution >= 0 ? '+' : ''}{f.contribution.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {data.drift.flagged && (
            <p className="text-xs text-warn">Drift: {data.drift.note}. Check the sensor before trusting this node.</p>
          )}
          <p className="text-xs text-ink-4">{HONESTY}</p>
        </div>
      )}
    </section>
  )
}
