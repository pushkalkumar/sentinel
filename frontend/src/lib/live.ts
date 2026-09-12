// WebSocket /live client (CONTRACT §6): reconnect 0.5 s → 8 s with jitter, ping every 20 s,
// messages queued and flushed once per animation frame into store/dispatch.ts.
import { useEffect } from 'react'
import type { LiveMessage } from './types'
import { dispatchBatch } from '@/store/dispatch'
import { useSimStore, type WsStatus } from '@/store/sim'
import { useSessionStore } from '@/store/session'
import { getDeviceFp } from './fp'

const BACKOFF_MIN_MS = 500
const BACKOFF_MAX_MS = 8000
const PING_MS = 20_000

export interface ConnectLiveOpts {
  token?: string
  deviceFp?: string
  onMessage: (m: LiveMessage) => void
  onStatus: (s: WsStatus) => void
  /** Fires after every successful (re)connect except the first; shells refetch overview here. */
  onReconnect?: () => void
}

function liveUrl(opts: ConnectLiveOpts): string {
  const base = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')
  const host = base ? base.replace(/^https?:\/\//, '') : location.host
  const secure = base ? base.startsWith('https') : location.protocol === 'https:'
  const proto = secure ? 'wss' : 'ws'
  const sp = new URLSearchParams()
  if (opts.token) sp.set('token', opts.token)
  if (opts.deviceFp) sp.set('device_fp', opts.deviceFp)
  const q = sp.toString()
  return `${proto}://${host}/live${q ? `?${q}` : ''}`
}

export function connectLive(opts: ConnectLiveOpts): () => void {
  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let connections = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let pingTimer: ReturnType<typeof setInterval> | null = null

  const clearTimers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (pingTimer) clearInterval(pingTimer)
    reconnectTimer = null
    pingTimer = null
  }

  const scheduleReconnect = () => {
    if (closed) return
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** attempt)
    const jitter = base * (0.8 + Math.random() * 0.4)
    attempt += 1
    reconnectTimer = setTimeout(open, jitter)
  }

  const open = () => {
    if (closed) return
    opts.onStatus('connecting')
    try {
      ws = new WebSocket(liveUrl(opts))
    } catch {
      scheduleReconnect()
      return
    }
    ws.onopen = () => {
      attempt = 0
      connections += 1
      opts.onStatus('open')
      if (connections > 1) opts.onReconnect?.()
      pingTimer = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, PING_MS)
    }
    ws.onmessage = (ev) => {
      let parsed: unknown
      try {
        parsed = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (parsed && typeof parsed === 'object' && 'type' in parsed) opts.onMessage(parsed as LiveMessage)
    }
    ws.onerror = () => {
      /* onclose follows and handles the reconnect */
    }
    ws.onclose = () => {
      if (pingTimer) clearInterval(pingTimer)
      pingTimer = null
      ws = null
      opts.onStatus('closed')
      scheduleReconnect()
    }
  }

  open()

  return () => {
    closed = true
    clearTimers()
    if (ws) {
      ws.onclose = null
      ws.close()
      ws = null
    }
  }
}

/** Collects messages and flushes them to the stores once per animation frame. */
function createFrameQueue(): { push: (m: LiveMessage) => void; cancel: () => void } {
  let queue: LiveMessage[] = []
  let raf: number | null = null
  const flush = () => {
    raf = null
    const batch = queue
    queue = []
    dispatchBatch(batch)
  }
  return {
    push: (m) => {
      queue.push(m)
      if (raf === null) raf = requestAnimationFrame(flush)
    },
    cancel: () => {
      if (raf !== null) cancelAnimationFrame(raf)
      queue = []
    },
  }
}

export interface UseLiveOpts {
  /** Send the device fingerprint (phone shell). */
  withDeviceFp?: boolean
  onReconnect?: () => void
}

/** One call per shell. Reconnects when the token changes. */
export function useLive(opts: UseLiveOpts = {}): void {
  const token = useSessionStore((s) => s.token)
  const onReconnect = opts.onReconnect
  const withDeviceFp = opts.withDeviceFp ?? false

  useEffect(() => {
    const q = createFrameQueue()
    const setWs = useSimStore.getState().setWs
    const disconnect = connectLive({
      token: token ?? undefined,
      deviceFp: withDeviceFp ? getDeviceFp() : undefined,
      onMessage: q.push,
      onStatus: setWs,
      onReconnect,
    })
    return () => {
      q.cancel()
      disconnect()
    }
  }, [token, withDeviceFp, onReconnect])
}
