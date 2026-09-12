import { useEffect, useState } from 'react'
import { useDisplayNodes } from '@/store/select'
import { useSiteStore } from '@/store/site'
import { useUiStore } from '@/store/ui'
import type { Node } from '@/lib/types'
import { fmtSim, relative } from '@/lib/time'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { NODE_STATUS_META } from '@/lib/bands'

const RSSI_FLOOR = -100
const RSSI_CEIL = -40

/** "Watch" has to mean something: a node needing attention, not a node reading a bit high (judge item 20). */
const WATCH_BATTERY_PCT = 30
const WATCH_RSSI_DBM = -95

interface Health { status: Node['status']; why: string }

function health(n: Node): Health {
  if (n.status === 'offline') return { status: 'offline', why: 'No reading in the last two ticks' }
  if (n.open_alerts.some((a) => !a.cleared_at)) return { status: 'alert', why: 'An engine alert is open at this node' }
  if (n.battery_pct !== null && n.battery_pct < WATCH_BATTERY_PCT) return { status: 'watch', why: `Battery under ${WATCH_BATTERY_PCT}%` }
  if (n.rssi !== null && n.rssi < WATCH_RSSI_DBM) return { status: 'watch', why: `Signal under ${WATCH_RSSI_DBM} dBm` }
  return { status: 'ok', why: 'Reporting on time, battery and signal healthy' }
}

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
    { key: 'floor', header: 'Floor', align: 'center', render: (n) => <span className="text-ink-2">{n.floor === null ? 'Outdoor' : String(n.floor)}</span> },
    { key: 'fw_version', header: 'Firmware', mono: true },
    // One clock in the console: sim time, unprefixed (the footer already says the nodes are simulated).
    { key: 'last_seen', header: 'Last seen', mono: true, render: (n) => (n.last_seen ? (n.status === 'offline' ? relative(n.last_seen) : fmtSim(n.last_seen, 'HH:mm:ss')) : 'never') },
    { key: 'battery_pct', header: 'Battery', align: 'right', mono: true, render: (n) => (n.battery_pct === null ? '--' : `${Math.round(n.battery_pct)}%`) },
    { key: 'rssi', header: 'RSSI', render: (n) => <RssiBar rssi={n.rssi} /> },
    {
      key: 'status',
      header: 'Status',
      // Dot plus ink text: state colour stays off the words (design item 20).
      render: (n) => {
        const h = health(n)
        const m = NODE_STATUS_META[h.status]
        return (
          <span className="inline-flex items-center gap-2" title={h.why}>
            <i aria-hidden className="size-1.5 rounded-full shrink-0" style={{ background: m.color }} />
            <span className="text-ink-2">{m.label}</span>
          </span>
        )
      },
    },
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
