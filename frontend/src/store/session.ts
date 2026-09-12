import { create } from 'zustand'
import type { ClassInfo, MeResponse, NodeId, Role, User } from '@/lib/types'

export const TOKEN_KEY = 'sentinel.token'
export const NODE_KEY = 'sentinel.node'

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeKey(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

export interface SessionState {
  token: string | null
  user: User | null
  role: Role | null
  classInfo: ClassInfo | null
  pickedNodeId: NodeId | null
  setAuth: (me: MeResponse) => void
  logout: () => void
  pickNode: (id: NodeId | null) => void
}

export const useSessionStore = create<SessionState>()((set) => ({
  token: readKey(TOKEN_KEY),
  user: null,
  role: null,
  classInfo: null,
  pickedNodeId: readKey(NODE_KEY),
  setAuth: (me) => {
    writeKey(TOKEN_KEY, me.token)
    set({
      token: me.token,
      user: me.user,
      role: me.role,
      classInfo: me.role === 'teacher' ? me.class : null,
    })
  },
  logout: () => {
    writeKey(TOKEN_KEY, null)
    set({ token: null, user: null, role: null, classInfo: null })
  },
  pickNode: (id) => {
    writeKey(NODE_KEY, id)
    set({ pickedNodeId: id })
  },
}))
