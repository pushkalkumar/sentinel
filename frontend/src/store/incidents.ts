import { create } from 'zustand'
import type { Incident, IncidentCode, IncidentEventMessage } from '@/lib/types'

export interface IncidentsState {
  byCode: Record<IncidentCode, Incident>
  order: IncidentCode[]
  lastCreated: Incident | null
  /** Increments on every incident_created; Toasts plays the ping when it changes. */
  pingSeq: number
  hydrate: (list: Incident[]) => void
  upsert: (inc: Incident) => void
  applyEvent: (msg: IncidentEventMessage) => void
  /** Called by dispatch on incident_created. */
  created: (inc: Incident) => void
}

function sortCodes(byCode: Record<IncidentCode, Incident>): IncidentCode[] {
  return Object.values(byCode)
    .sort((a, b) =>
      a.priority - b.priority || b.trust_score - a.trust_score || b.created_at.localeCompare(a.created_at))
    .map((i) => i.code)
}

export const useIncidentStore = create<IncidentsState>()((set, get) => ({
  byCode: {},
  order: [],
  lastCreated: null,
  pingSeq: 0,

  hydrate: (list) => {
    const byCode: Record<IncidentCode, Incident> = {}
    for (const inc of list) byCode[inc.code] = inc
    set({ byCode, order: sortCodes(byCode) })
  },

  upsert: (inc) => {
    const byCode = { ...get().byCode, [inc.code]: inc }
    set({ byCode, order: sortCodes(byCode) })
  },

  applyEvent: (msg) => {
    const byCode = { ...get().byCode, [msg.code]: msg.incident }
    set({ byCode, order: sortCodes(byCode) })
  },

  created: (inc) => {
    const byCode = { ...get().byCode, [inc.code]: inc }
    set({ byCode, order: sortCodes(byCode), lastCreated: inc, pingSeq: get().pingSeq + 1 })
  },
}))

/** Open = received | acknowledged | en_route (CONTRACT §3.6). */
export function isOpenIncident(inc: Incident): boolean {
  return inc.status === 'received' || inc.status === 'acknowledged' || inc.status === 'en_route'
}
