// Two clocks (CONTRACT §0.3): sim timestamps format in UTC so 13:55Z shows as 13:55;
// wall timestamps format in the browser's local zone.
import type { ISO } from './types'

export type ClockFmt = 'HH:mm' | 'HH:mm:ss' | 'HH:mm:ss.SSS'

function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0')
}

function parts(iso: ISO, utc: boolean): { h: number; m: number; s: number; ms: number } | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return utc
    ? { h: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), ms: d.getUTCMilliseconds() }
    : { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), ms: d.getMilliseconds() }
}

function fmtParts(p: { h: number; m: number; s: number; ms: number }, fmt: ClockFmt): string {
  const base = `${pad(p.h)}:${pad(p.m)}`
  if (fmt === 'HH:mm') return base
  if (fmt === 'HH:mm:ss') return `${base}:${pad(p.s)}`
  return `${base}:${pad(p.s)}.${pad(p.ms, 3)}`
}

/** Sim timestamp → demo-day clock (timeZone UTC). */
export function fmtSim(iso: ISO | null | undefined, fmt: ClockFmt = 'HH:mm'): string {
  if (!iso) return '--:--'
  const p = parts(iso, true)
  return p ? fmtParts(p, fmt) : '--:--'
}

/** Wall timestamp → browser local clock. */
export function fmtWall(iso: ISO | null | undefined, fmt: ClockFmt = 'HH:mm'): string {
  if (!iso) return '--:--'
  const p = parts(iso, false)
  return p ? fmtParts(p, fmt) : '--:--'
}

function zoneAbbr(d: Date): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZoneName: 'short' })
      .formatToParts(d)
      .find((x) => x.type === 'timeZoneName')
    return part?.value ?? ''
  } catch {
    return ''
  }
}

/** Wall timestamp with zone, for `title` attributes: "15:12:08 PDT". */
export function fmtWallZoned(iso: ISO | null | undefined, fmt: ClockFmt = 'HH:mm:ss'): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${fmtWall(iso, fmt)} ${zoneAbbr(d)}`.trim()
}

/** "just now", "4 min ago", "2 h ago" relative to wall now. */
export function relative(iso: ISO | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'never'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 'never'
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  return `${d} d ago`
}

/** Seconds → "MM:SS" (or "H:MM:SS" past an hour). */
export function elapsed(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

/** Console clock: "15:12 PDT". */
export function clockNow(now: Date = new Date()): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())} ${zoneAbbr(now)}`.trim()
}

/** Demo-day ISO from seconds since 07:00 (sim_t). Used by Time Machine math. */
export function simIsoFromT(simT: number, day = '2026-09-12'): ISO {
  const midnight = new Date(`${day}T00:00:00.000Z`).getTime()
  return new Date(midnight + (7 * 3600 + simT) * 1000).toISOString()
}
