import { useEffect, useState } from 'react'
import { listNodes } from '@/lib/api'
import { XENON_FIELD } from './xenonPress'

const SITE_ID = 1
const POLL_MS = 5000
const FRESH_MS = 60_000

/**
 * True while xenon-a has reported in the last minute. `last_seen` changes with every reading, so the
 * change is timed in wall clock here; a wall-stamped `last_seen` inside the window counts as well.
 */
export function useXenonAlive(): boolean {
  const [alive, setAlive] = useState(false)
  useEffect(() => {
    let active = true
    let lastSeen: string | null = null
    let changedAt = 0
    const poll = async () => {
      try {
        const nodes = await listNodes(SITE_ID)
        if (!active) return
        const seen = nodes.find((n) => n.id === XENON_FIELD)?.last_seen ?? null
        const now = Date.now()
        if (seen && seen !== lastSeen) { lastSeen = seen; changedAt = now }
        const stamped = seen ? now - Date.parse(seen) : Infinity
        setAlive(!!seen && (now - changedAt < FRESH_MS || (stamped >= 0 && stamped < FRESH_MS)))
      } catch { /* backend down: keep the last state */ }
    }
    void poll()
    const id = window.setInterval(() => void poll(), POLL_MS)
    return () => { active = false; window.clearInterval(id) }
  }, [])
  return alive
}
