import { useEffect } from 'react'
import { useHardwareStore } from '@/store/hardware'

const DURATION_MS = 2400
const PEAK = 0.45
/** Frames longer than this (first WebGL compile, tab hidden) count as one normal frame so the intro is never skipped. */
const MAX_FRAME_MS = 50
/** Scrolling this far (or any slider/orbit input) hands the model back to the user. */
const SCROLL_CANCEL_PX = 4

/** Smooth 0 -> 1 -> 0 bump with zero slope at both ends. */
const bump = (u: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * u)

/**
 * One-shot intro: eases explode 0 -> 0.45 -> 0 over 2.4 s on mount so the page shows what scrolling does.
 * Skipped when disabled (static tier, reduced motion, deep link) and cancelled by any user input.
 */
export function useIntroExplode(enabled: boolean) {
  useEffect(() => {
    if (!enabled || window.scrollY > SCROLL_CANCEL_PX) return
    const store = useHardwareStore.getState()
    if (store.manual || store.explode !== 0) return

    let raf = 0
    let last: number | null = null
    let elapsed = 0
    let cancelled = false

    const finish = () => {
      if (cancelled) return
      cancelled = true
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      unsubscribe()
      const s = useHardwareStore.getState()
      if (!s.manual) s.setExplode(0)
    }
    const onScroll = () => { if (window.scrollY > SCROLL_CANCEL_PX) finish() }
    const unsubscribe = useHardwareStore.subscribe((s) => { if (s.manual) finish() })

    const tick = (now: number) => {
      if (cancelled) return
      if (last !== null) elapsed += Math.min(now - last, MAX_FRAME_MS)
      last = now
      const u = Math.min(1, elapsed / DURATION_MS)
      useHardwareStore.getState().setExplode(PEAK * bump(u))
      if (u >= 1) { finish(); return }
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(tick)
    return finish
  }, [enabled])
}
