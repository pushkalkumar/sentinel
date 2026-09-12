// The Time Machine seam. fe-admin, fe-responder and fe-landing read nodes, card and alerts ONLY through
// these hooks, so fe-novel can override them from `timeline.frame` while `timeline.active` is true.
import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Alert, DecisionCard, ISO, Node } from '@/lib/types'
import { useSiteStore } from './site'
import { useTimelineStore } from './timeline'
import { useSimStore } from './sim'

export function useDisplayNodes(): Node[] {
  const nodes = useSiteStore(useShallow((s) => Object.values(s.nodes)))
  const active = useTimelineStore((s) => s.active)
  const frame = useTimelineStore((s) => s.frame)
  return useMemo(() => {
    if (!active || !frame) return nodes
    return nodes.map((n) => {
      const f = frame.nodes[n.id]
      if (!f) return n
      const latest = n.latest
        ? { ...n.latest, pm25: f.pm25, temp_c: f.temp_c }
        : { ts: '', pm1: 0, pm25: f.pm25, pm10: 0, temp_c: f.temp_c, rh: 0, mq2_raw: 0, rssi: n.rssi ?? 0, battery_pct: n.battery_pct ?? 0 }
      const alerting = frame.alerts.some((a) => a.node_id === n.id && a.priority <= 2)
      const watching = frame.alerts.some((a) => a.node_id === n.id && a.priority === 3)
      const status = n.status === 'offline' ? 'offline' : alerting ? 'alert' : watching ? 'watch' : 'ok'
      return { ...n, latest, band: f.band, status, open_alerts: frame.alerts.filter((a) => a.node_id === n.id) }
    })
  }, [nodes, active, frame])
}

export function useDisplayCard(): DecisionCard | null {
  const live = useSiteStore((s) => s.decisionCard)
  const active = useTimelineStore((s) => s.active)
  const frame = useTimelineStore((s) => s.frame)
  return active && frame ? frame.card : live
}

export function useDisplayAlerts(): Alert[] {
  const live = useSiteStore((s) => s.openAlerts)
  const active = useTimelineStore((s) => s.active)
  const frame = useTimelineStore((s) => s.frame)
  return active && frame ? frame.alerts : live
}

/** Sim clock to display: the scrub position while replaying, else the live sim_ts. */
export function useDisplayClock(): ISO | null {
  const liveTs = useSimStore((s) => s.simState?.sim_ts ?? null)
  const active = useTimelineStore((s) => s.active)
  const t = useTimelineStore((s) => s.t)
  return active && t ? t : liveTs
}

export function useTimelineActive(): boolean {
  return useTimelineStore((s) => s.active)
}
