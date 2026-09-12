import { useEffect, useState } from 'react'
import { useDisplayNodes } from '@/store/select'
import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import type { Node } from '@/lib/types'
import { fmtSim, relative } from '@/lib/time'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Pill } from '@/components/ui/Pill'

const RSSI_FLOOR = -100
const RSSI_CEIL = -40

function RssiBar({ rssi }: { rssi: number | null }) {
  if (rssi === null) return <span className="font-mono text-xs text-ink-4">--</span>
  const pct = Math.max(0, Math.min(1, (rssi - RSSI_FLOOR) / (RSSI_CEIL - RSSI_FLOOR)))
  return (
    <span className="inline-flex items-center gap-2" title={`${rssi} dBm`}>
      <span className="inline-block w-12 h-[3px] bg-raised rounded-xs overflow-hidden">
        <span className="block h-full bg-ink-3" style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="font-mono text-xs text-ink-3 tabular-nums">{rssi}</span>
    </span>
  )
}

/** /admin/nodes table. Provisioning stays display-only for the demo. */
export function NodeTable() {
  const nodes = useDisplayNodes()
  const zones = useSiteStore((s) => s.zones)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const selected = useUiStore((s) => s.selectedNodeId)
  const selectNode = useUiStore((s) => s.selectNode)
  const [, setTick] = useState(0)

  // Relative "last seen" text ages in place.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const zoneName = (id: number) => zones.find((z) => z.id === id)?.name ?? `zone ${id}`

  const columns: Column<Node>[] = [
    { key: 'id', header: 'Node', mono: true, render: (n) => <span className="text-ink">{n.id}{n.is_gateway && <span className="text-ink-3"> ■</span>}</span> },
    { key: 'label', header: 'Label' },
    { key: 'zone_id', header: 'Zone', render: (n) => zoneName(n.zone_id) },
    { key: 'floor', header: 'Floor', align: 'center', mono: true, render: (n) => (n.floor === null ? 'outdoor' : String(n.floor)) },
    { key: 'fw_version', header: 'Firmware', mono: true },
    { key: 'last_seen', header: 'Last seen', mono: true, render: (n) => <span title={n.last_seen ? `sim ${fmtSim(n.last_seen, 'HH:mm:ss')}` : undefined}>{n.last_seen ? (n.status === 'offline' ? relative(n.last_seen) : `sim ${fmtSim(n.last_seen, 'HH:mm:ss')}`) : 'never'}</span> },
    { key: 'battery_pct', header: 'Battery', align: 'right', mono: true, render: (n) => (n.battery_pct === null ? '--' : `${Math.round(n.battery_pct)}%`) },
    { key: 'rssi', header: 'RSSI', render: (n) => <RssiBar rssi={n.rssi} /> },
    { key: 'status', header: 'Status', render: (n) => <Pill kind="node" value={n.status} /> },
  ]

  return (
    <DataTable
      columns={columns}
      rows={[...nodes].sort((a, b) => Number(b.is_gateway) - Number(a.is_gateway) || a.id.localeCompare(b.id))}
      rowKey={(n) => n.id}
      selectedKey={selected}
      onSelect={(n) => selectNode(n.id)}
      loading={!loaded && !error}
      error={nodes.length === 0 ? error : null}
      empty="No nodes on this site yet."
    />
  )
}
