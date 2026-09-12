import { create } from 'zustand'
import type { SmsMessage, SmsOutbox } from '@/lib/types'

export interface SmsState {
  /** Newest first, as the API returns them. */
  messages: SmsMessage[]
  count: number
  label: string
  hydrate: (outbox: SmsOutbox) => void
  push: (m: SmsMessage) => void
}

export const useSmsStore = create<SmsState>()((set, get) => ({
  messages: [],
  count: 0,
  label: 'SMS provider disabled in demo',

  hydrate: (outbox) => set({ messages: outbox.messages, count: outbox.count, label: outbox.label }),

  push: (m) => {
    const { messages, count } = get()
    if (messages.some((x) => x.id === m.id)) return
    set({ messages: [m, ...messages], count: count + 1 })
  },
}))
