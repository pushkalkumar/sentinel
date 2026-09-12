import { create } from 'zustand'
import type { Drill, RollcallMessage } from '@/lib/types'

export interface DrillsState {
  active: Drill | null
  history: Drill[]
  hydrate: (history: Drill[], active?: Drill | null) => void
  setActive: (d: Drill | null) => void
  applyRollcall: (msg: RollcallMessage) => void
  ended: (d: Drill) => void
}

export const useDrillStore = create<DrillsState>()((set, get) => ({
  active: null,
  history: [],

  hydrate: (history, active) => set({ history, ...(active !== undefined ? { active } : {}) }),

  setActive: (d) => set({ active: d }),

  applyRollcall: (msg) => {
    const active = get().active
    if (!active || active.id !== msg.drill_id) return
    const classes = active.classes.map((c) => {
      if (c.class_id !== msg.class_id) return c
      const state = msg.rollcall.missing_refs.length > 0 ? 'missing' : 'matched'
      return { ...c, rollcall: msg.rollcall, state } as typeof c
    })
    set({ active: { ...active, classes, summary: msg.summary, missing: msg.missing } })
  },

  ended: (d) => {
    const { active, history } = get()
    const rest = history.filter((h) => h.id !== d.id)
    set({ active: active && active.id === d.id ? null : active, history: [d, ...rest] })
  },
}))
