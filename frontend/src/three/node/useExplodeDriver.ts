import { useEffect, type RefObject } from 'react'
import { useMotionValueEvent, useScroll } from 'motion/react'
import { useHardwareStore } from '@/store/hardware'

const HOLD_START = 0.08
const HOLD_END = 0.92
const HANDBACK_DELTA = 24

/** 0..0.08 holds at 0, 0.08..0.92 maps to 0..1, 0.92..1 holds at 1. */
export const remapScroll = (v: number) => Math.min(1, Math.max(0, (v - HOLD_START) / (HOLD_END - HOLD_START)))

/** Scroll progress of the sticky hero section drives explode unless the slider owns it (HARDWARE_3D §4.5). */
export function useExplodeDriver(sectionRef: RefObject<HTMLElement | null>, enabled: boolean) {
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] })

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const s = useHardwareStore.getState()
    if (!enabled || s.manual) return
    s.setExplode(remapScroll(v))
  })

  useEffect(() => {
    const el = sectionRef.current
    if (!el || !enabled) return
    let touchY: number | null = null
    const handBack = () => {
      const s = useHardwareStore.getState()
      if (s.manual) {
        s.setManual(false)
        s.setExplode(remapScroll(scrollYProgress.get()))
      }
    }
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > HANDBACK_DELTA) handBack() }
    const onTouchStart = (e: TouchEvent) => { touchY = e.touches[0]?.clientY ?? null }
    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (touchY !== null && y !== undefined && Math.abs(y - touchY) > HANDBACK_DELTA) handBack()
    }
    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
    }
  }, [sectionRef, enabled, scrollYProgress])
}
