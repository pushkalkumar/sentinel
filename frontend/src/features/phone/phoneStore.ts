// Phone-only state: the picked node's detail (banner source) and the node picker sheet.
// The site store only tracks nodes after an overview hydrate, which the phone never does,
// so the shell keeps its own copy and refreshes it on poll and on alert changes.
import { create } from 'zustand'
import type { NodeDetail } from '@/lib/types'
import { getNode, errorText } from '@/lib/api'
import { useSessionStore } from '@/store/session'

const PICKER_SEEN_KEY = 'sentinel.phone.pickerSeen'

function readSeen(): boolean {
  try {
    return localStorage.getItem(PICKER_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

function writeSeen(): void {
  try {
    localStorage.setItem(PICKER_SEEN_KEY, '1')
  } catch {
    /* storage unavailable */
  }
}

export interface PhoneState {
  node: NodeDetail | null
  loading: boolean
  error: string | null
  pickerOpen: boolean
  /** Fetch the picked node's detail; clears the node when nothing is picked. */
  refresh: () => Promise<void>
  openPicker: () => void
  closePicker: () => void
}

let refreshSeq = 0

export const usePhoneStore = create<PhoneState>()((set) => ({
  node: null,
  loading: false,
  error: null,
  pickerOpen: !readSeen() && useSessionStore.getState().pickedNodeId === null,

  refresh: async () => {
    const id = useSessionStore.getState().pickedNodeId
    const seq = ++refreshSeq
    if (!id) {
      set({ node: null, loading: false, error: null })
      return
    }
    set({ loading: true })
    try {
      const node = await getNode(id)
      if (seq !== refreshSeq) return
      set({ node, loading: false, error: null })
    } catch (e) {
      if (seq !== refreshSeq) return
      set({ loading: false, error: errorText(e) })
    }
  },

  openPicker: () => set({ pickerOpen: true }),
  closePicker: () => {
    writeSeen()
    set({ pickerOpen: false })
  },
}))
