import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import type { IncidentCode } from '@/lib/types'
import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { useSiteStore } from '@/store/site'
import { useMeshStore } from '@/store/mesh'
import { useDisplayNodes } from '@/store/select'
import { CampusView } from '@/components/map/CampusView'
import { SplitPane } from '@/features/responder/SplitPane'
import { QueueList } from '@/features/responder/QueueList'
import { SensorStrip } from '@/features/responder/SensorStrip'

/**
 * /responder: queue left, map right, one line of readings under the map (DESIGN_V2 §4).
 * The page fills the shell's remaining height; the shell footer carries the honesty line.
 */
export default function Queue() {
  const navigate = useNavigate()
  const incidents = useIncidentStore(useShallow((s) => s.order.map((c) => s.byCode[c]).filter(isOpenIncident)))
  const siteLoaded = useSiteStore((s) => s.loaded)
  const siteError = useSiteStore((s) => s.error)
  const site = useSiteStore((s) => s.site)
  const links = useSiteStore((s) => s.links)
  const zones = useSiteStore((s) => s.zones)
  const hops = useMeshStore((s) => s.hops)
  const nodes = useDisplayNodes()

  const [selected, setSelected] = useState<IncidentCode | null>(null)

  // Keep a selection: the top row by default, or the next row if the selected one was closed.
  useEffect(() => {
    if (incidents.length === 0) {
      if (selected !== null) setSelected(null)
      return
    }
    if (!selected || !incidents.some((i) => i.code === selected)) setSelected(incidents[0].code)
  }, [incidents, selected])

  const current = useMemo(() => incidents.find((i) => i.code === selected) ?? null, [incidents, selected])
  const node = useMemo(() => (current?.node_id ? nodes.find((n) => n.id === current.node_id) ?? null : null), [nodes, current])

  const open = useCallback((code: IncidentCode) => navigate(`/responder/incident/${code}`), [navigate])

  const left = (
    <div className="flex flex-col min-h-0 h-full">
      <div className="h-12 shrink-0 flex items-center gap-2 px-5">
        <h1 className="label-signage">Incidents</h1>
        <span className="text-xs text-ink-3">{incidents.length === 0 ? 'none open' : `${incidents.length} open`}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <QueueList
          incidents={incidents}
          selected={selected}
          onSelect={setSelected}
          onOpen={open}
          siteName={site?.name ?? null}
          loading={!siteLoaded && !siteError}
          error={siteError}
        />
      </div>
    </div>
  )

  const right = (
    <div className="flex flex-col min-h-0 h-full pl-6">
      <div className="h-12 shrink-0 flex items-center gap-2">
        <h2 className="label-signage">{site?.name ?? 'Map'}</h2>
        {current && (
          <span className="text-xs text-ink-3">
            <span className="font-mono text-ink-2">{current.code}</span> at {current.node_label ?? 'internet'}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center bg-surface rounded-lg p-3">
        {siteError && nodes.length === 0 ? (
          <p className="text-sm text-alarm text-center max-w-sm">{siteError}</p>
        ) : !siteLoaded ? (
          <p className="text-sm text-ink-3">Loading map.</p>
        ) : nodes.length === 0 ? (
          <p className="text-sm text-ink-3">No nodes at this site yet.</p>
        ) : (
          <CampusView
            nodes={nodes}
            links={links}
            zones={zones}
            mode="mesh"
            selectedId={current?.node_id ?? null}
            highlightCode={current?.code}
            hops={hops}
            ground={site?.kind === 'floorplan' ? 'floorplan' : 'campus'}
            labels="always"
            className="w-full h-full rounded-md overflow-hidden"
          />
        )}
      </div>
      <SensorStrip node={node} className="shrink-0 px-1" />
    </div>
  )

  return (
    <div className="h-0 flex-1 min-h-0 -mx-6 px-1 pb-2">
      <SplitPane left={left} right={right} className="h-full" />
    </div>
  )
}
