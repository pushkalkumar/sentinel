import { create } from 'zustand'
import type { NodeId } from '@/lib/types'

export type MapMode = 'air' | 'mesh'

export interface Toast { id: number; text: string; at: number }

export const TOAST_MS = 4000

export interface UiState {
  selectedNodeId: NodeId | null
  mapMode: MapMode
  explainNodeId: NodeId | null
  /** Sim timestamp for a historical explain; null means "now". */
  explainAt: string | null
  weaAlertId: number | null
  toasts: Toast[]
  audioUnlocked: boolean
  selectNode: (id: NodeId | null) => void
  setMapMode: (mode: MapMode) => void
  openExplain: (id: NodeId, at?: string | null) => void
  closeExplain: () => void
  openWea: (alertId: number) => void
  closeWea: () => void
  toast: (text: string) => void
  dismiss: (id: number) => void
  unlockAudio: () => void
}

let toastSeq = 0

export const useUiStore = create<UiState>()((set, get) => ({
  selectedNodeId: null,
  mapMode: 'air',
  explainNodeId: null,
  explainAt: null,
  weaAlertId: null,
  toasts: [],
  audioUnlocked: false,

  selectNode: (id) => set({ selectedNodeId: id }),
  setMapMode: (mapMode) => set({ mapMode }),
  openExplain: (id, at = null) => set({ explainNodeId: id, explainAt: at }),
  closeExplain: () => set({ explainNodeId: null, explainAt: null }),
  openWea: (alertId) => set({ weaAlertId: alertId }),
  closeWea: () => set({ weaAlertId: null }),

  toast: (text) => {
    toastSeq += 1
    const id = toastSeq
    set({ toasts: [...get().toasts, { id, text, at: Date.now() }] })
    setTimeout(() => get().dismiss(id), TOAST_MS)
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  unlockAudio: () => set({ audioUnlocked: true }),
}))
