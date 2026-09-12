// Scratch preview for the 3D campus scene: served at /preview.html, never routed in the app.
import { useEffect, useMemo, useState } from 'react'
import topology from '@shared/topology.json'
import type { Alert, BandKey, MeshLogEntry, Node, NodeId } from '@/lib/types'
import { CampusScene } from '@/components/map/CampusScene'

interface TopoNode { id: string; label: string; zone_id: number; lat: number; lng: number; map_x: number; map_y: number; indoor: boolean; is_gateway: boolean; floor: number | null; neighbours: string[] }
const NODE_IDS = ['hub', 'library', 'science', 'cafeteria', 'arts', 'gym', 'field', 'parking']
const site = (() => {
  const s = (topology as unknown as { sites: { id: number; nodes: TopoNode[] }[] }).sites[0]
  return { ...s, nodes: s.nodes.filter((n) => NODE_IDS.includes(n.id)) }
})()

const BANDS: Record<string, BandKey> = { hub: 'good', library: 'good', science: 'moderate', cafeteria: 'good', arts: 'moderate', gym: 'unhealthy', field: 'good', parking: 'good' }
const PM: Record<string, number> = { hub: 6, library: 7, science: 14, cafeteria: 8, arts: 12, gym: 162, field: 5, parking: 6 }

const fireAlert: Alert = {
  id: 1, tenant_id: 1, site_id: 1, zone_id: 2, node_id: 'gym', kind: 'LOCAL_FIRE', priority: 1,
  band_from: 'moderate', band_to: 'unhealthy', reason: 'PM2.5 rise with temperature rise',
  metrics: { pm25: 162, pm_rise: 120, temp_rise: 9, gas_delta: 300, regional: 6 },
  started_at: '2026-09-12T14:41:00.000Z', cleared_at: null, node_label: 'Gymnasium', zone_name: 'Campus South',
}

const nodes: Node[] = site.nodes.map((n) => ({
  id: n.id, site_id: 1, zone_id: n.zone_id, label: n.label, lat: n.lat, lng: n.lng, map_x: n.map_x, map_y: n.map_y,
  floor: n.floor, indoor: n.indoor, is_gateway: n.is_gateway, neighbours: n.neighbours,
  fw_version: '0.9.2', last_seen: '2026-09-12T14:45:00.000Z', battery_pct: 88, rssi: -71,
  status: n.id === 'gym' ? 'alert' : 'ok', band: BANDS[n.id] ?? 'good',
  latest: { ts: '2026-09-12T14:45:00.000Z', pm1: 3, pm25: PM[n.id] ?? 6, pm10: 9, temp_c: 21, rh: 44, mq2_raw: 180, rssi: -71, battery_pct: 88 },
  open_alerts: n.id === 'gym' ? [fireAlert] : [],
}))

const links: [NodeId, NodeId][] = (() => {
  const seen = new Set<string>()
  const out: [NodeId, NodeId][] = []
  for (const n of site.nodes) for (const m of n.neighbours) {
    if (!NODE_IDS.includes(m)) continue
    const key = [n.id, m].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    out.push([n.id, m])
  }
  return out
})()

/** gym → science → hub, plus one dropped cafeteria → field, looping every 2.4 s. */
const ROUTE: [NodeId, NodeId, MeshLogEntry['status']][] = [['gym', 'science', 'ok'], ['science', 'hub', 'delivered'], ['cafeteria', 'field', 'dropped']]
let hopSeq = 100

export default function MapPreview() {
  const [hops, setHops] = useState<MeshLogEntry[]>([])
  const [selected, setSelected] = useState<NodeId | null>(null)
  const [mode, setMode] = useState<'air' | 'mesh'>('mesh')
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const still = params.get('still') === '1'

  useEffect(() => {
    if (still) return
    let i = 0
    const push = () => {
      const [from, to, status] = ROUTE[i % ROUTE.length]
      i += 1
      hopSeq += 1
      const entry: MeshLogEntry = {
        id: hopSeq, msg_id: `m-${hopSeq}`, origin_node: 'gym', kind: 'alarm', hop_from: from, hop_to: to, attempt: 1, status,
        path: ['gym'], ttl: 6, payload: { code: 'SN-7K3F' }, ts: new Date().toISOString(),
      }
      setHops((h) => [...h.slice(-20), entry])
    }
    const t = window.setInterval(push, 800)
    return () => window.clearInterval(t)
  }, [still])

  return (
    <div className="fixed inset-0 bg-canvas">
      <CampusScene
        nodes={nodes} links={links} mode={mode} ground="campus" hops={hops}
        selectedId={selected} onSelect={setSelected} highlightCode="SN-7K3F" labels={params.get('labels') === 'always' ? 'always' : 'hover'}
        compact={params.get('compact') === '1'}
        className="absolute inset-0"
      />
      <button type="button" className="absolute top-4 left-4 font-mono text-2xs text-ink-3" onClick={() => setMode((m) => (m === 'air' ? 'mesh' : 'air'))}>
        mode: {mode}
      </button>
    </div>
  )
}
