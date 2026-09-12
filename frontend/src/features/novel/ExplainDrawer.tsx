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
import { SecondOpinion } from './SecondOpinion'

const POLL_MS = 2000
const DRAWER_W = 384

const BRANCH_COLOR: Record<ExplainResponse['branch'], { color: string; dim: string }> = {
  LOCAL_FIRE: { color: ALERT_META.LOCAL_FIRE.color, dim: ALERT_META.LOCAL_FIRE.dimColor },
  HAZARDOUS_SMOKE: { color: ALERT_META.HAZARDOUS_SMOKE.color, dim: ALERT_META.HAZARDOUS_SMOKE.dimColor },
  LOCAL_SMOKE_SUSPECT: { color: ALERT_META.LOCAL_SMOKE_SUSPECT.color, dim: ALERT_META.LOCAL_SMOKE_SUSPECT.dimColor },
  CLEAR: { color: '#6DB87A', dim: 'rgba(109,184,122,0.14)' },
}

const BRANCH_LABEL: Record<ExplainResponse['branch'], string> = {
  LOCAL_FIRE: 'Local fire',
  HAZARDOUS_SMOKE: 'Hazardous smoke',
  LOCAL_SMOKE_SUSPECT: 'Smoke suspected',
  CLEAR: 'Clear',
}

function VerdictPill({ branch }: { branch: ExplainResponse['branch'] }) {
  const c = BRANCH_COLOR[branch]
  return (
    <span className="inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ background: c.dim, color: c.color }}>
      <i aria-hidden className={clsx('size-1.5 rounded-full', branch === 'LOCAL_FIRE' && 'pulse-live')} style={{ background: c.color }} />
      {BRANCH_LABEL[branch]}
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

  if (loading && !data) return <div className="p-6"><Skeleton className="w-48" /></div>
  if (error && !data) return <p className="p-6 text-sm text-alarm">{error}</p>
  if (!data) return <p className="p-6 text-sm text-ink-3">No evaluation for this node yet.</p>

  const d = data
  const passed = d.checks.filter((c) => c.pass).length
  return (
    <div className="flex flex-col gap-8 px-6 pt-2 pb-8">
      {/* The verdict is the headline; everything under it is evidence. */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-ink-2">{d.node.label}</span>
          <VerdictPill branch={d.branch} />
          {d.outlier && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium bg-warn-dim text-warn" title="Sensor drift suspected; cross-check before trusting.">
              Outlier?
            </span>
          )}
        </div>
        <p className="display-h2 text-xl text-ink text-balance">{d.verdict}</p>
        {d.outlier && <p className="text-sm text-ink-2">Sensor drift suspected; cross-check before trusting.</p>}
        {error && <p className="text-xs text-ink-3">{error}</p>}
      </div>

      {/* Checks come straight after the verdict: the sentence has to be reconstructible from these rows. */}
      <section>
        <header className="flex items-baseline gap-3 mb-2">
          <h3 className="label-signage">Checks</h3>
          <span className="text-xs text-ink-3"><span className="font-mono">{passed}</span> of <span className="font-mono">{d.checks.length}</span> pass</span>
        </header>
        <CheckRows key={`${d.node.id}-${d.branch}`} checks={d.checks} />
      </section>

      <SecondOpinion nodeId={d.node.id} live={at === null} />

      <section>
        <header className="flex items-baseline gap-3 mb-3">
          <h3 className="label-signage">Sky vs building</h3>
          <span className="text-xs text-ink-3">PM2.5, <span className="font-mono">{d.eval.ratio.toFixed(1)}x</span> the neighbours</span>
        </header>
        <NeighbourBars explain={d} />
      </section>

      <div className="flex flex-col gap-2">
        <RuleSource branch={d.branch} thresholds={d.thresholds} />
        <p className="text-xs text-ink-3">Rules decide: every threshold is on this screen.</p>
      </div>
    </div>
  )
}

/** 384px right drawer (NOVELTY §3.2). Opens from `ui.openExplain`, closes on Esc and route change. */
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
          className="fixed top-14 right-0 bottom-0 z-30 bg-surface flex flex-col overflow-hidden"
          style={{ width: `min(${DRAWER_W}px, 100vw)`, boxShadow: '-1px 0 0 var(--color-line), -24px 0 48px -24px rgba(0,0,0,0.6)' }}
        >
          <header className="h-12 shrink-0 flex items-center gap-3 px-6">
            <h2 className="label-signage truncate">Why this reading</h2>
            <span className="font-mono text-2xs text-ink-4 tabular-nums">{at ? fmtSim(at) : 'live'}</span>
            <button type="button" onClick={closeExplain} aria-label="Close" className="ml-auto -mr-2 size-8 inline-flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] transition-[color,background-color] duration-[120ms]">
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
