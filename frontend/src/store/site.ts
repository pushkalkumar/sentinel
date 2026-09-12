import { create } from 'zustand'
import type {
  Alert, DecisionCard, Node, NodeId, NodeStatusEvent, Reading, ReadingEvent, Site, SiteOverview, SiteStats, Tenant, Zone,
} from '@/lib/types'

/** Readings kept per node: 240 = two sim hours at a 30 s tick (CONTRACT §3.9). */
export const READING_CAP = 240

export interface SiteState {
  site: Site | null
  tenant: Tenant | null
  zones: Zone[]
  nodes: Record<NodeId, Node>
  links: [NodeId, NodeId][]
  readings: Record<NodeId, Reading[]>
  decisionCard: DecisionCard | null
  openAlerts: Alert[]
  stats: SiteStats | null
  loaded: boolean
  error: string | null
  hydrate: (overview: SiteOverview) => void
  setError: (error: string | null) => void
  applyReading: (ev: ReadingEvent) => void
  applyNodeStatus: (ev: NodeStatusEvent) => void
  applyAlert: (a: Alert) => void
  applyAlertCleared: (a: Alert) => void
  applyDecisionCard: (c: DecisionCard) => void
}

function toReading(ev: ReadingEvent): Reading {
  return {
    ts: ev.ts, pm1: ev.pm1, pm25: ev.pm25, pm10: ev.pm10,
    temp_c: ev.temp_c, rh: ev.rh, mq2_raw: ev.mq2_raw, rssi: ev.rssi, battery_pct: ev.battery_pct,
  }
}

export const useSiteStore = create<SiteState>()((set, get) => ({
  site: null,
  tenant: null,
  zones: [],
  nodes: {},
  links: [],
  readings: {},
  decisionCard: null,
  openAlerts: [],
  stats: null,
  loaded: false,
  error: null,

  hydrate: (o) => {
    const nodes: Record<NodeId, Node> = {}
    const readings: Record<NodeId, Reading[]> = { ...get().readings }
    for (const n of o.nodes) {
      nodes[n.id] = n
      if (!readings[n.id]) readings[n.id] = n.latest ? [n.latest] : []
    }
    set({
      site: o.site, tenant: o.tenant, zones: o.zones, nodes, links: o.links, readings,
      decisionCard: o.decision_card, openAlerts: o.open_alerts, stats: o.stats, loaded: true, error: null,
    })
  },

  setError: (error) => set({ error }),

  applyReading: (ev) => {
    const { nodes, readings } = get()
    const node = nodes[ev.node_id]
    if (!node) return
    const reading = toReading(ev)
    const prev = readings[ev.node_id] ?? []
    const next = prev.length >= READING_CAP ? [...prev.slice(prev.length - READING_CAP + 1), reading] : [...prev, reading]
    set({
      nodes: {
        ...nodes,
        [ev.node_id]: {
          ...node, latest: reading, band: ev.band, last_seen: ev.ts,
          battery_pct: ev.battery_pct, rssi: ev.rssi,
          status: node.status === 'offline' ? 'ok' : node.status,
        },
      },
      readings: { ...readings, [ev.node_id]: next },
    })
  },

  applyNodeStatus: (ev) => {
    const { nodes } = get()
    const node = nodes[ev.node_id]
    if (!node) return
    set({
      nodes: {
        ...nodes,
        [ev.node_id]: { ...node, status: ev.status, band: ev.band, battery_pct: ev.battery_pct, rssi: ev.rssi, last_seen: ev.last_seen },
      },
    })
  },

  applyAlert: (a) => {
    const { openAlerts, nodes } = get()
    const others = openAlerts.filter((x) => x.id !== a.id)
    const patch: Record<NodeId, Node> = {}
    if (a.node_id && nodes[a.node_id]) {
      const n = nodes[a.node_id]
      patch[a.node_id] = { ...n, open_alerts: [...n.open_alerts.filter((x) => x.id !== a.id), a] }
    }
    set({ openAlerts: [a, ...others], nodes: { ...nodes, ...patch } })
  },

  applyAlertCleared: (a) => {
    const { openAlerts, nodes } = get()
    const patch: Record<NodeId, Node> = {}
    if (a.node_id && nodes[a.node_id]) {
      const n = nodes[a.node_id]
      patch[a.node_id] = { ...n, open_alerts: n.open_alerts.filter((x) => x.id !== a.id) }
    }
    set({ openAlerts: openAlerts.filter((x) => x.id !== a.id), nodes: { ...nodes, ...patch } })
  },

  applyDecisionCard: (c) => set({ decisionCard: c }),
}))
