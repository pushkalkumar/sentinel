import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import { useMeshStore } from '@/store/mesh'
import { useDisplayNodes } from '@/store/select'
import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { Panel } from '@/components/ui/Panel'
import { Segmented } from '@/components/ui/Segmented'
import { SimTag } from '@/components/ui/SimTag'
import { Skeleton } from '@/components/ui/Skeleton'
import { CampusMap } from '@/components/map/CampusMap'
import { DecisionCard } from '@/features/admin/DecisionCard'
import { NodeList } from '@/features/admin/NodeList'
import { OpenIncidents } from '@/features/admin/OpenIncidents'
import { MeshLog } from '@/features/admin/MeshLog'
import { SimControls } from '@/features/admin/SimControls'
import { TimeMachine } from '@/features/novel/TimeMachine'

export default function Overview() {
  const site = useSiteStore((s) => s.site)
  const links = useSiteStore((s) => s.links)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const nodes = useDisplayNodes()
  const hops = useMeshStore((s) => s.hops)
  const mapMode = useUiStore((s) => s.mapMode)
  const setMapMode = useUiStore((s) => s.setMapMode)
  const selected = useUiStore((s) => s.selectedNodeId)
  const selectNode = useUiStore((s) => s.selectNode)
  const openExplain = useUiStore((s) => s.openExplain)
  const openCount = useIncidentStore((s) => s.order.filter((c) => isOpenIncident(s.byCode[c])).length)

  const ground = site?.kind === 'floorplan' ? 'floorplan' : 'campus'

  return (
    <div className="py-6 grid grid-cols-1 lg:grid-cols-[68fr_32fr] gap-4 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <DecisionCard />
        <Panel
          title={ground === 'campus' ? 'Campus' : 'Floor 1'}
          meta={site?.address}
          padded={false}
          right={(
            <>
              <Segmented
                label="Map layer"
                options={[{ value: 'air', label: 'air' }, { value: 'mesh', label: 'mesh' }]}
                value={mapMode}
                onChange={setMapMode}
                className="h-7"
              />
              <SimTag kind="nodes" />
            </>
          )}
        >
          {!loaded && !error && <div className="p-5"><Skeleton className="w-64" /></div>}
          {error && nodes.length === 0 && <p className="p-5 text-sm text-alarm">{error}</p>}
          {nodes.length > 0 && (
            <CampusMap
              nodes={nodes}
              links={links}
              mode={mapMode}
              selectedId={selected}
              onSelect={(id) => { selectNode(id); openExplain(id) }}
              hops={hops}
              ground={ground}
              className="aspect-[10/7]"
            />
          )}
        </Panel>
        <Panel title="Scenario" padded>
          <SimControls />
        </Panel>
        <TimeMachine />
      </div>
      <aside className="bg-surface hairline rounded-md min-w-0 divide-y divide-line">
        <section>
          <header className="h-10 flex items-center px-5 border-b border-line"><h2 className="label-signage">Nodes</h2></header>
          <NodeList />
        </section>
        <section>
          <header className="h-10 flex items-center gap-3 px-5 border-b border-line">
            <h2 className="label-signage">Open incidents</h2>
            <span className="font-mono text-xs text-ink-3 tabular-nums">{openCount}</span>
          </header>
          <OpenIncidents />
        </section>
        <section>
          <header className="h-10 flex items-center px-5 border-b border-line"><h2 className="label-signage">Mesh log</h2></header>
          <MeshLog lines={8} />
        </section>
      </aside>
    </div>
  )
}
