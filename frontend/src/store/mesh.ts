import { create } from 'zustand'
import type { MeshLogEntry } from '@/lib/types'

export const HOP_RING = 200

export interface MeshState {
  /** Oldest first, capped at HOP_RING (DESIGN §6.6: newest at the bottom). */
  hops: MeshLogEntry[]
  lastHop: MeshLogEntry | null
  hopSeq: number
  dropCount: number
  push: (entry: MeshLogEntry) => void
  hydrate: (entries: MeshLogEntry[]) => void
}

export const useMeshStore = create<MeshState>()((set, get) => ({
  hops: [],
  lastHop: null,
  hopSeq: 0,
  dropCount: 0,

  push: (entry) => {
    const { hops, hopSeq, dropCount } = get()
    if (hops.some((h) => h.id === entry.id)) return
    const next = hops.length >= HOP_RING ? [...hops.slice(hops.length - HOP_RING + 1), entry] : [...hops, entry]
    set({
      hops: next, lastHop: entry, hopSeq: hopSeq + 1,
      dropCount: entry.status === 'dropped' ? dropCount + 1 : dropCount,
    })
  },

  /** Accepts the API's newest-first list and stores oldest-first. */
  hydrate: (entries) => {
    const asc = [...entries].sort((a, b) => a.id - b.id).slice(-HOP_RING)
    set({
      hops: asc,
      lastHop: asc[asc.length - 1] ?? null,
      dropCount: asc.filter((h) => h.status === 'dropped').length,
    })
  },
}))
