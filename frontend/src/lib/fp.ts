// Device fingerprint per CONTRACT §4.1.
const FP_KEY = 'sentinel.fp'
const FP_COOKIE = 'sentinel_fp'
const BLOCKED_FP = 'demo-blocked-device'
const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

let blockedForDemo = false

function readStored(): string | null {
  try {
    return localStorage.getItem(FP_KEY)
  } catch {
    return null
  }
}

function writeStored(fp: string): void {
  try {
    localStorage.setItem(FP_KEY, fp)
  } catch {
    /* storage unavailable: fp lives for this page only */
  }
  try {
    document.cookie = `${FP_COOKIE}=${encodeURIComponent(fp)}; max-age=${COOKIE_MAX_AGE_S}; path=/; SameSite=Lax`
  } catch {
    /* cookies blocked */
  }
}

function randomFp(): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}`
  return 'fp-' + uuid.replace(/-/g, '').slice(0, 24)
}

/** Stable device fingerprint; the hidden dev toggle swaps it for the blocked demo device. */
export function getDeviceFp(): string {
  if (blockedForDemo) return BLOCKED_FP
  const stored = readStored()
  if (stored) return stored
  const fp = randomFp()
  writeStored(fp)
  return fp
}

export function setBlockedFpForDemo(on: boolean): void {
  blockedForDemo = on
}

export function isBlockedFpForDemo(): boolean {
  return blockedForDemo
}
