import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import type { ExplainResponse } from '@/lib/types'
import { errorText, getExplain } from '@/lib/api'
import { fmtSim } from '@/lib/time'
import { ALERT_META } from '@/lib/bands'
import { useUiStore } from '@/store/ui'
import { Skeleton } from '@/components/ui/Skeleton'
import { NeighbourBars } from './NeighbourBars'
import { CheckRows } from './CheckRows'
import { RuleSource } from './RuleSource'

const POLL_MS = 2000
const DRAWER_W = 360

const BRANCH_COLOR: Record<ExplainResponse['branch'], { color: string; dim: string }> = {
  LOCAL_FIRE: { color: ALERT_META.LOCAL_FIRE.color, dim: ALERT_META.LOCAL_FIRE.dimColor },
  HAZARDOUS_SMOKE: { color: ALERT_META.HAZARDOUS_SMOKE.color, dim: ALERT_META.HAZARDOUS_SMOKE.dimColor },
  LOCAL_SMOKE_SUSPECT: { color: ALERT_META.LOCAL_SMOKE_SUSPECT.color, dim: ALERT_META.LOCAL_SMOKE_SUSPECT.dimColor },
  CLEAR: { color: '#5AD46E', dim: 'rgba(90,212,110,0.14)' },
}

function VerdictPill({ branch }: { branch: ExplainResponse['branch'] }) {
  const c = BRANCH_COLOR[branch]
  return (
    <span className="inline-flex items-center gap-1.5 h-[22px] pl-1.5 pr-2 rounded-full font-mono text-xs font-medium whitespace-nowrap" style={{ background: c.dim, color: c.color }}>
      <i aria-hidden className={clsx('size-1.5 rounded-full', branch === 'LOCAL_FIRE' && 'pulse-live')} style={{ background: c.color }} />
      {branch}
    </span>
  )
}

function DrawerBody({ nodeId, at }: { nodeId: string; at: string | null }) {
  const [data, setData] = useState<ExplainResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const seq = useRef(0)

  useEffect(() => {
    seq.current += 1
    const mySeq = seq.current
    setLoading(true)
    setError(null)
    setData(null)
    const run = async () => {
      try {
        const res = await getExplain(nodeId, at)
        if (seq.current !== mySeq) return
        setData(res)
        setError(null)
      } catch (e) {
        if (seq.current !== mySeq) return
        setError(errorText(e))
      } finally {
        if (seq.current === mySeq) setLoading(false)
      }
    }
    void run()
    // Live view polls; a historical `at` is a fixed record and needs no refresh.
    if (at) return
    const id = setInterval(() => void run(), POLL_MS)
    return () => clearInterval(id)
  }, [nodeId, at])

  if (loading && !data) return <div className="p-5"><Skeleton className="w-48" /></div>
  if (error && !data) return <p className="p-5 text-sm text-alarm">{error}</p>
  if (!data) return <p className="p-5 text-sm text-ink-3">No evaluation for this node yet.</p>

  const d = data
  return (
    <div className="flex flex-col">
      <div className="px-5 pt-4 pb-4 border-b border-line flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="display-h2 text-md text-ink mr-1">{d.node.label}</span>
          <VerdictPill branch={d.branch} />
          {d.outlier && (
            <span
              className="inline-flex items-center h-[22px] px-2 rounded-full text-xs font-medium bg-warn-dim text-warn"
              title="Sensor drift suspected; cross-check before trusting."
            >
              Outlier?
            </span>
          )}
          <span className="ml-auto font-mono text-2xs text-ink-3" title="Sim clock of this evaluation">{fmtSim(d.at, 'HH:mm:ss')}</span>
        </div>
        <p className="text-base text-ink">{d.verdict}</p>
        {d.outlier && <p className="text-sm text-ink-2">Sensor drift suspected; cross-check before trusting.</p>}
        {error && <p className="text-xs text-ink-3">{error}</p>}
      </div>

      <section className="px-5 py-4 border-b border-line">
        <header className="flex items-baseline gap-3 mb-2">
          <h3 className="label-signage">Sky vs building</h3>
          <span className="font-mono text-2xs text-ink-3">PM2.5 µg/m³ · ratio {d.eval.ratio.toFixed(1)}x</span>
        </header>
        <NeighbourBars explain={d} />
      </section>

      <section className="px-5 py-4 border-b border-line">
        <header className="flex items-baseline gap-3 mb-1">
          <h3 className="label-signage">Checks</h3>
          <span className="font-mono text-2xs text-ink-3">{d.checks.filter((c) => c.pass).length} of {d.checks.length} pass</span>
        </header>
        <CheckRows key={`${d.node.id}-${d.branch}`} checks={d.checks} />
      </section>

      <section className="px-5 py-4">
        <RuleSource branch={d.branch} />
      </section>
    </div>
  )
}

/** 360px right drawer (NOVELTY §3.2). Opens from `ui.openExplain`, closes on Esc and route change. */
export function ExplainDrawer() {
  const nodeId = useUiStore((s) => s.explainNodeId)
  const at = useUiStore((s) => s.explainAt)
  const closeExplain = useUiStore((s) => s.closeExplain)
  const reduced = useReducedMotion() ?? false
  const { pathname } = useLocation()
  const lastPath = useRef(pathname)

  useEffect(() => {
    if (lastPath.current !== pathname) {
      lastPath.current = pathname
      closeExplain()
    }
  }, [pathname, closeExplain])

  useEffect(() => {
    if (!nodeId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeExplain() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nodeId, closeExplain])

  return (
    <AnimatePresence>
      {nodeId && (
        <motion.aside
          key={nodeId}
          role="dialog"
          aria-label={`Why ${nodeId} reads this way`}
          initial={reduced ? false : { x: DRAWER_W }}
          animate={{ x: 0 }}
          exit={reduced ? undefined : { x: DRAWER_W }}
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          className="fixed top-14 right-0 bottom-0 z-30 bg-surface border-l border-line flex flex-col overflow-hidden"
          style={{ width: `min(${DRAWER_W}px, 100vw)` }}
        >
          <header className="h-10 shrink-0 flex items-center gap-3 px-5 border-b border-line">
            <h2 className="label-signage truncate">Node {nodeId}</h2>
            <span className="font-mono text-2xs text-ink-3">Rules, not ML</span>
            {at && <span className="font-mono text-2xs text-ink-3">at {fmtSim(at)}</span>}
            <button type="button" onClick={closeExplain} aria-label="Close" className="ml-auto text-ink-3 hover:text-ink">
              <X size={16} strokeWidth={1.5} />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto min-h-0">
            <DrawerBody nodeId={nodeId} at={at} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
