import { useCallback, useEffect, useState } from 'react'
import { useSiteStore } from '@/store/site'
import { useSessionStore } from '@/store/session'
import { useUiStore } from '@/store/ui'
import { errorText, getAir } from '@/lib/api'
import type { AirResponse } from '@/lib/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Segmented'
import { SimTag } from '@/components/ui/SimTag'
import { Skeleton } from '@/components/ui/Skeleton'
import { AirChart } from '@/features/admin/AirChart'
import { BandHistory } from '@/features/admin/BandHistory'
import { DecisionLog } from '@/features/admin/DecisionLog'

type Range = '60' | '180' | '480'
const RANGES: { value: Range; label: string; step: number }[] = [
  { value: '60', label: '1 h', step: 1 }, { value: '180', label: '3 h', step: 5 }, { value: '480', label: '8 h', step: 10 },
]
const REFRESH_MS = 15_000

export default function Air() {
  const siteId = useSiteStore((s) => s.site?.id) ?? useSessionStore.getState().user?.site_id ?? 1
  const selected = useUiStore((s) => s.selectedNodeId)
  const selectNode = useUiStore((s) => s.selectNode)
  const [range, setRange] = useState<Range>('180')
  const [data, setData] = useState<AirResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    const r = RANGES.find((x) => x.value === range) ?? RANGES[1]
    getAir(siteId, Number(r.value), r.step)
      .then((d) => { setData(d); setError(null) })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false))
  }, [siteId, range])

  useEffect(() => {
    setLoading(true)
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const rangeOptions = RANGES.map(({ value, label }) => ({ value, label }))

  return (
    <>
      <PageHeader
        eyebrow="Air · today"
        title="PM2.5 by node"
        right={(
          <>
            <Segmented label="Range" options={rangeOptions} value={range} onChange={setRange} />
            <SimTag kind="nodes" />
          </>
        )}
      />
      <div className="flex flex-col gap-4">
        <Panel title="PM2.5 µg/m³" meta={data ? `${data.step}-min steps · ${data.series.length} nodes` : undefined}>
          {loading && !data && <Skeleton className="w-64" />}
          {error && !data && <p className="text-sm text-alarm">{error}</p>}
          {data && <AirChart data={data} selected={selected} onSelect={selectNode} />}
        </Panel>
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 items-start">
          <Panel title="Band history" meta={data ? `last ${data.minutes} min` : undefined}>
            {loading && !data && <Skeleton />}
            {error && !data && <p className="text-sm text-alarm">{error}</p>}
            {data && <BandHistory data={data} />}
          </Panel>
          <Panel title="Decision log" meta="newest first" padded={false}>
            <DecisionLog entries={data?.band_history ?? []} loading={loading && !data} error={!data ? error : null} />
          </Panel>
        </div>
      </div>
    </>
  )
}
