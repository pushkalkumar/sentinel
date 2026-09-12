import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useShallow } from 'zustand/react/shallow'
import type { IncidentCode } from '@/lib/types'
import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { useSiteStore } from '@/store/site'
import { useMeshStore } from '@/store/mesh'
import { useDisplayNodes } from '@/store/select'
import { CampusMap } from '@/components/map/CampusMap'
import { SimTag } from '@/components/ui/SimTag'
import { SplitPane } from '@/features/responder/SplitPane'
import { QueueList } from '@/features/responder/QueueList'
import { SensorStrip } from '@/features/responder/SensorStrip'
import { SoundToggle } from '@/features/responder/SoundToggle'

/** The bar is 56px and the shell's main has 48px bottom padding; the pane fills the rest. */
const PANE_HEIGHT = 'calc(100dvh - 56px - 48px)'

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
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-line">
        <h1 className="label-signage">Incidents</h1>
        <span className="font-mono text-xs text-ink-2 tabular-nums">{incidents.length} open</span>
        <span className="ml-auto font-mono text-2xs text-ink-3">sort: priority, then trust</span>
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
    <div className="flex flex-col min-h-0 h-full">
      <div className="h-12 shrink-0 flex items-center gap-3 px-4 border-b border-line">
        <h2 className="label-signage">{site?.name ?? 'Map'}</h2>
        {current && <span className="font-mono text-xs text-ink-2">{current.code} at {current.node_label ?? 'internet'}</span>}
        <div className="ml-auto flex items-center gap-2">
          <SoundToggle />
          <SimTag kind="nodes" />
        </div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-canvas/40">
        {siteError && nodes.length === 0 ? (
          <p className="text-sm text-alarm text-center max-w-sm">{siteError}</p>
        ) : !siteLoaded ? (
          <p className="text-sm text-ink-3">Loading map.</p>
        ) : nodes.length === 0 ? (
          <p className="text-sm text-ink-3">No nodes at this site yet.</p>
        ) : (
          <CampusMap
            nodes={nodes}
            links={links}
            zones={zones}
            mode="mesh"
            selectedId={current?.node_id ?? null}
            highlightCode={current?.code}
            hops={hops}
            ground={site?.kind === 'floorplan' ? 'floorplan' : 'campus'}
            className="max-h-full"
          />
        )}
      </div>
      <SensorStrip node={node} heading="sensors" className="shrink-0" />
    </div>
  )

  return (
    <div className="-mx-6 bg-surface border-x border-line" style={{ height: PANE_HEIGHT }}>
      <SplitPane left={left} right={right} className="h-full" />
    </div>
  )
}
