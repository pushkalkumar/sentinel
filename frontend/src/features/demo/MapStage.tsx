import { useSiteStore } from '@/store/site'
import { useMeshStore } from '@/store/mesh'
import { useIncidentStore } from '@/store/incidents'
import { useDisplayNodes } from '@/store/select'
import { CampusView } from '@/components/map/CampusView'
import { Skeleton } from '@/components/ui/Skeleton'
import { PhoneMock } from './PhoneMock'
import { TriageCard } from './TriageCard'
import type { ChapterKind } from './chapterKind'

export interface MapStageProps { kind: ChapterKind }

/** Left 60%: the campus with live node states and the hop animation. Mesh layer while messages fly. */
export function MapStage({ kind }: MapStageProps) {
  const site = useSiteStore((s) => s.site)
  const links = useSiteStore((s) => s.links)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const nodes = useDisplayNodes()
  const hops = useMeshStore((s) => s.hops)
  const lastCode = useIncidentStore((s) => s.lastCreated?.code)

  const mesh = kind === 'fire' || kind === 'report' || kind === 'respond'
  const ground = site?.kind === 'floorplan' ? 'floorplan' : 'campus'

  return (
    <section className="relative bg-surface rounded-lg min-h-0 flex items-center justify-center overflow-hidden" aria-label="Campus map">
      {!loaded && !error && <Skeleton className="w-64" />}
      {error && nodes.length === 0 && <p className="text-sm text-alarm p-panel">{error}</p>}
      {nodes.length > 0 && (
        <CampusView
          nodes={nodes}
          links={links}
          mode={mesh ? 'mesh' : 'air'}
          hops={hops}
          highlightCode={kind === 'report' || kind === 'respond' ? lastCode : undefined}
          ground={ground}
          labels="always"
          className="absolute inset-3 rounded-md overflow-hidden"
        />
      )}
      <PhoneMock visible={kind === 'report'} />
      <TriageCard visible={kind === 'report'} />
    </section>
  )
}
