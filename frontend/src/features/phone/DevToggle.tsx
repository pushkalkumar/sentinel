import { useCallback, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { isBlockedFpForDemo, setBlockedFpForDemo } from '@/lib/fp'

const LONG_PRESS_MS = 1500

export interface DevToggleProps {
  /** The wordmark; a 1.5 s press on it flips the blocked fingerprint. */
  children: ReactNode
}

/** Hidden demo switch (CONTRACT §4.1): swaps the device fingerprint for `demo-blocked-device`. */
export function DevToggle({ children }: DevToggleProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [blocked, setBlocked] = useState(isBlockedFpForDemo())

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  const start = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    clear()
    timer.current = setTimeout(() => {
      const next = !isBlockedFpForDemo()
      setBlockedFpForDemo(next)
      setBlocked(next)
      timer.current = null
    }, LONG_PRESS_MS)
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onPointerDown={start}
        onPointerUp={clear}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onContextMenu={(e) => e.preventDefault()}
        aria-label={blocked ? 'Sentinel. Demo device is blocked. Press and hold to restore.' : 'Sentinel'}
        className="self-start min-h-12 text-left select-none touch-none [-webkit-touch-callout:none]"
      >
        {children}
      </button>
      {blocked && (
        <p role="status" className="font-field-mono text-[14px] text-f-alarm">
          Demo: this device is blocked. Hold the name again to restore.
        </p>
      )}
    </div>
  )
}
