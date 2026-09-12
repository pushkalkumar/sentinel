import { useCallback, useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { errorText, getTimeline } from '@/lib/api'
import { useSiteStore } from '@/store/site'
import { useTimelineStore } from '@/store/timeline'
import { Skeleton } from '@/components/ui/Skeleton'
import { Transport } from './Transport'
import { Track } from './Track'
import { dayBounds } from './timelineMath'

const REFRESH_MS = 60_000
const TIMELINE_STEP_S = 300

/** Bottom strip on /admin (NOVELTY §3.1). DESIGN_V2: thinner and quieter, 80px open, 36px collapsed, no border. */
export function TimeMachine() {
  const siteId = useSiteStore((s) => s.site?.id ?? null)
  const data = useTimelineStore((s) => s.data)
  const load = useTimelineStore((s) => s.load)
  const goLive = useTimelineStore((s) => s.goLive)

  const [collapsed, setCollapsed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTimeline = useCallback(async (id: number) => {
    try {
      const res = await getTimeline(id, TIMELINE_STEP_S)
      load(res)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [load])

  useEffect(() => {
    if (siteId === null) return
    setLoading(true)
    void fetchTimeline(siteId)
    const id = setInterval(() => void fetchTimeline(siteId), REFRESH_MS)
    return () => clearInterval(id)
  }, [siteId, fetchTimeline])

  // Leaving the page returns the console to live so other routes never read a stale frame.
  useEffect(() => () => goLive(), [goLive])

  const bounds = useMemo(() => dayBounds(data), [data])
  const hasReadings = !!data && data.readings.length > 0

  return (
    <section
      aria-label="Time machine"
      className={clsx('bg-surface rounded-lg flex flex-col min-w-0 overflow-visible transition-[height] duration-[200ms] ease-[var(--ease-enter)]', collapsed ? 'h-9' : 'h-20')}
    >
      <Transport collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} disabled={!hasReadings} />
      {!collapsed && (
        <div className="flex-1 px-4 pb-2 min-w-0">
          {loading && !data && <Skeleton className="w-64 pt-1" />}
          {!loading && error && !data && (
            <p className="text-sm text-alarm flex items-center gap-3">
              {error}
              {siteId !== null && (
                <button type="button" onClick={() => void fetchTimeline(siteId)} className="text-xs text-ink-2 hover:text-ink underline">
                  Retry
                </button>
              )}
            </p>
          )}
          {!loading && data && !hasReadings && (
            <p className="text-sm text-ink-3">No stored readings yet. The track fills in as the day runs from 07:00.</p>
          )}
          {data && hasReadings && <Track data={data} bounds={bounds} />}
        </div>
      )}
    </section>
  )
}
