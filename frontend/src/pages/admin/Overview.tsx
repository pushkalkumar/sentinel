import clsx from 'clsx'
import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import { useMeshStore } from '@/store/mesh'
import { useDisplayNodes } from '@/store/select'
import { useIncidentStore, isOpenIncident } from '@/store/incidents'
import { Skeleton } from '@/components/ui/Skeleton'
import { CampusMap } from '@/components/map/CampusMap'
import { DecisionCard } from '@/features/admin/DecisionCard'
import { NodeList } from '@/features/admin/NodeList'
import { OpenIncidents } from '@/features/admin/OpenIncidents'
import { SimControls } from '@/features/admin/SimControls'
import { TimeMachine } from '@/features/novel/TimeMachine'

const LAYERS = [{ value: 'air', label: 'Air' }, { value: 'mesh', label: 'Mesh' }] as const

/**
 * /admin: one hero (the decision), the map under it, one quiet column at the right.
 * Nothing on this page has a border; grouping is by whitespace (DESIGN_V2 §2).
 */
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
    <div className="pb-6 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem] gap-x-14 gap-y-8 items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <DecisionCard />
        <section className="bg-surface rounded-lg overflow-visible" aria-label={ground === 'campus' ? 'Campus map' : 'Floor plan'}>
          {!loaded && !error && <div className="p-panel"><Skeleton className="w-64" /></div>}
          {error && nodes.length === 0 && <p className="p-panel text-sm text-alarm">{error}</p>}
          {nodes.length > 0 && (
            <CampusMap
              nodes={nodes}
              links={links}
              mode={mapMode}
              selectedId={selected}
              onSelect={(id) => { selectNode(id); openExplain(id) }}
              hops={hops}
              ground={ground}
              labels="hover"
              className="w-full max-h-[32rem] p-2"
            />
          )}
        </section>
        <div className="h-9 flex items-center gap-1 px-1">
          <div role="radiogroup" aria-label="Map layer" className="flex items-center gap-1">
            {LAYERS.map((l) => {
              const active = mapMode === l.value
              return (
                <button
                  key={l.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMapMode(l.value)}
                  className={clsx(
                    'h-8 px-3 rounded-md text-sm transition-[color,background-color] duration-[120ms]',
                    active ? 'text-ink bg-raised' : 'text-ink-3 hover:text-ink-2',
                  )}
                >
                  {l.label}
                </button>
              )
            })}
          </div>
          {site?.address && <span className="ml-4 text-xs text-ink-4 truncate hidden md:inline">{site.address}</span>}
          <SimControls className="ml-auto" />
        </div>
        <TimeMachine />
      </div>

      <aside className="min-w-0 flex flex-col gap-stack lg:pt-12">
        <section>
          <h2 className="label-signage mb-2">Nodes</h2>
          <NodeList />
        </section>
        <section>
          <h2 className="label-signage mb-3">
            Incidents{openCount > 0 && <span className="ml-2 font-mono normal-case tracking-normal text-ink-4">{openCount}</span>}
          </h2>
          <OpenIncidents />
        </section>
      </aside>
    </div>
  )
}
