import { create } from 'zustand'
import type { HelloMessage, SimState } from '@/lib/types'

export type WsStatus = 'connecting' | 'open' | 'closed'

export interface SimStoreState {
  simState: SimState | null
  /** True when the last sim_state said the simulator is connected to the backend. */
  connected: boolean
  wsStatus: WsStatus
  hello: HelloMessage | null
  setSim: (s: SimState | { connected: false } | null) => void
  setWs: (status: WsStatus) => void
  setHello: (h: HelloMessage) => void
}

export const useSimStore = create<SimStoreState>()((set) => ({
  simState: null,
  connected: false,
  wsStatus: 'connecting',
  hello: null,

  setSim: (s) => {
    if (!s || !('sim_ts' in s)) {
      set({ connected: false })
      return
    }
    set({ simState: s, connected: s.connected })
  },

  setWs: (status) => set({ wsStatus: status }),

  setHello: (h) => {
    set({ hello: h })
    if (h.sim) set({ simState: h.sim, connected: h.sim.connected })
  },
}))
