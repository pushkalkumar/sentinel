import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import { useDisplayNodes } from '@/store/select'
import { PageHeader } from '@/components/ui/PageHeader'
import { Panel } from '@/components/ui/Panel'
import { SimTag } from '@/components/ui/SimTag'
import { Skeleton } from '@/components/ui/Skeleton'
import { CampusMap } from '@/components/map/CampusMap'
import { NodeTable } from '@/features/admin/NodeTable'

export default function Nodes() {
  const site = useSiteStore((s) => s.site)
  const links = useSiteStore((s) => s.links)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const nodes = useDisplayNodes()
  const selected = useUiStore((s) => s.selectedNodeId)
  const selectNode = useUiStore((s) => s.selectNode)
  const openExplain = useUiStore((s) => s.openExplain)
  const online = nodes.filter((n) => n.status !== 'offline').length
  const picked = nodes.find((n) => n.id === selected) ?? null

  return (
    <>
      <PageHeader eyebrow="Nodes" title={`${online} of ${nodes.length} nodes online`} right={<SimTag kind="nodes" />} />
      <div className="flex flex-col gap-4">
        <Panel title="Fleet" meta={site?.name} padded={false}>
          <NodeTable />
        </Panel>
        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">
          <Panel title="Placement" meta="click a node to inspect" padded={false}>
            {!loaded && !error && <div className="p-5"><Skeleton className="w-64" /></div>}
            {error && nodes.length === 0 && <p className="p-5 text-sm text-alarm">{error}</p>}
            {nodes.length > 0 && (
              <CampusMap
                nodes={nodes}
                links={links}
                mode="air"
                selectedId={selected}
                onSelect={(id) => { selectNode(id); openExplain(id) }}
                ground={site?.kind === 'floorplan' ? 'floorplan' : 'campus'}
              />
            )}
          </Panel>
          <Panel title="Provisioning" meta="display only in the demo">
            {picked ? (
              <dl className="grid grid-cols-[8rem_1fr] gap-y-2 text-sm">
                <dt className="label-signage self-center">SSID</dt><dd className="font-mono text-xs text-ink">SENTINEL-{picked.id}</dd>
                <dt className="label-signage self-center">Label</dt><dd className="text-ink">{picked.label}</dd>
                <dt className="label-signage self-center">Position</dt><dd className="font-mono text-xs text-ink-2">{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</dd>
                <dt className="label-signage self-center">Role</dt><dd className="text-ink-2">{picked.is_gateway ? 'Gateway: uplinks the mesh to the backend' : 'Mesh node: relays to the gateway over UDP'}</dd>
                <dt className="label-signage self-center">Neighbours</dt><dd className="font-mono text-xs text-ink-2">{picked.neighbours.join(', ') || 'none'}</dd>
                <dt className="label-signage self-center">Firmware</dt><dd className="font-mono text-xs text-ink-2">{picked.fw_version}</dd>
              </dl>
            ) : (
              <p className="text-sm text-ink-3">Select a node in the table or on the map to see its provisioning record.</p>
            )}
            <p className="mt-4 text-xs text-ink-3">New nodes join by flashing the firmware with the site key and powering on within radio range of a neighbour. Adding nodes from this page is not part of the demo.</p>
          </Panel>
        </div>
      </div>
    </>
  )
}
