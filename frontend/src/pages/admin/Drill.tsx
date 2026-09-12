import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Drill as DrillT, DrillKind } from '@/lib/types'
import { createDrill, endDrill, errorText, drillCsvUrl, getActiveDrill } from '@/lib/api'
import { elapsed } from '@/lib/time'
import { useDrillStore } from '@/store/drills'
import { useSessionStore } from '@/store/session'
import { useUiStore } from '@/store/ui'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { RollcallGrid } from '@/features/drill/RollcallGrid'
import { drillElapsedS, useNowTick } from '@/features/drill/clock'
import { DRILL_KIND_LABEL } from '@/features/drill/kinds'
import { MissingList } from '@/features/drill/MissingList'
import { ByMuster } from '@/features/drill/ByMuster'
import { StartDrill } from '@/features/drill/StartDrill'

function LiveHeader({ drill, onEnd, ending, onDismiss }: { drill: DrillT; onEnd: () => void; ending: boolean; onDismiss: () => void }) {
  const running = drill.ended_at === null
  const now = useNowTick(1000, running)
  const secs = drillElapsedS(drill, now)
  const s = drill.summary
  return (
    <div className="flex items-end justify-between gap-8 flex-wrap pt-10 pb-8">
      <div className="min-w-0">
        <h1 className="display-h1 text-2xl text-ink tabular-nums">
          {s.submitted} of {s.classes} classes in
        </h1>
        <p className="text-base text-ink-3 mt-2">
          {DRILL_KIND_LABEL[drill.kind]}{running ? ' running' : ' ended'}
          {s.missing_total > 0 && <span className="text-warn">, {s.missing_total} missing</span>}
        </p>
      </div>
      <div className="flex items-center gap-8">
        <div className="text-right">
          <div className="stat-number text-3xl text-ink leading-none">{elapsed(secs)}</div>
          <div className="text-sm text-ink-3 mt-1.5">{running ? 'elapsed' : 'final'}</div>
        </div>
        {running ? (
          <Button variant="primary" onClick={onEnd} loading={ending}>Close drill</Button>
        ) : (
          <Button variant="ghost" onClick={onDismiss}>Start another</Button>
        )}
      </div>
    </div>
  )
}

export default function Drill() {
  const user = useSessionStore((s) => s.user)
  const token = useSessionStore((s) => s.token)
  const active = useDrillStore((s) => s.active)
  const history = useDrillStore((s) => s.history)
  const setActive = useDrillStore((s) => s.setActive)
  const toast = useUiStore((s) => s.toast)
  const siteId = user?.site_id ?? 1

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  /** The drill that just ended stays on screen, frozen, until the admin dismisses it. */
  const [endedView, setEndedView] = useState<DrillT | null>(null)
  const lastActiveId = useRef<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    getActiveDrill(siteId)
      .then((d) => setActive(d))
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false))
  }, [siteId, setActive])

  useEffect(() => { load() }, [load])

  // When the WS says the drill we were watching ended, keep its final grid on screen.
  useEffect(() => {
    if (active) {
      lastActiveId.current = active.id
      setEndedView(null)
      return
    }
    const id = lastActiveId.current
    if (id === null) return
    const done = history.find((h) => h.id === id)
    if (done && done.ended_at) setEndedView(done)
  }, [active, history])

  const start = async (kind: DrillKind) => {
    setError(null)
    try {
      const d = await createDrill(siteId, kind)
      setActive(d)
      setEndedView(null)
    } catch (e) {
      setError(errorText(e))
    }
  }

  const end = async () => {
    if (!active) return
    setEnding(true)
    try {
      const d = await endDrill(active.id)
      lastActiveId.current = d.id
      useDrillStore.getState().ended(d)
      setEndedView(d)
    } catch (e) {
      toast(errorText(e))
    } finally {
      setEnding(false)
    }
  }

  const drill = active ?? endedView

  if (loading && !drill) {
    return (
      <div className="py-10">
        <Skeleton className="w-64" />
      </div>
    )
  }

  if (!drill) {
    return (
      <>
        <div className="pt-10 pb-8">
          <h1 className="display-h1 text-2xl text-ink">Roll call</h1>
        </div>
        <section className="bg-surface rounded-lg">
          <StartDrill onStart={start} error={error} />
        </section>
      </>
    )
  }

  const reportHref = `/drills/${drill.id}/report`
  const csvHref = drillCsvUrl(drill.id)
  const csvName = `sentinel-drill-${drill.id}.csv`

  // A plain <a download> cannot carry the bearer header, so fetch with it and hand the bytes to the browser.
  const downloadCsv = async (e: MouseEvent<HTMLAnchorElement>) => {
    if (!token) return
    e.preventDefault()
    try {
      const res = await fetch(csvHref, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(String(res.status))
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = csvName
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      toast('Could not download the CSV. Try again.')
    }
  }

  return (
    <>
      <LiveHeader drill={drill} onEnd={end} ending={ending} onDismiss={() => { setEndedView(null); lastActiveId.current = null }} />
      <div className="grid gap-stack grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <section className="min-h-[320px]" aria-label="Roll call grid">
          {drill.classes.length === 0 ? (
            <p className="text-sm text-ink-3">No classes at this site yet.</p>
          ) : (
            <RollcallGrid drill={drill} />
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <MissingList missing={drill.missing} />
          <ByMuster classes={drill.classes} />
          <div className="flex items-center gap-1 pt-2">
            <Button variant="ghost" onClick={() => window.open(reportHref, '_blank', 'noopener')}>
              Export report
            </Button>
            <a
              href={csvHref}
              download={csvName}
              onClick={downloadCsv}
              className="inline-flex items-center justify-center h-10 px-4 rounded-md text-base font-medium text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)]"
            >
              CSV
            </a>
          </div>
        </aside>
      </div>
    </>
  )
}
