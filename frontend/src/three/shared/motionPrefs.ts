import { useEffect, useState } from 'react'
import type { DeviceTier } from '@/store/hardware'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
const MIN_FULL_WIDTH = 900
const MIN_MEMORY_GB = 4

function readReduced(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(REDUCED_QUERY).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(readReduced)
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(REDUCED_QUERY)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function hasWebGL2(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!c.getContext('webgl2')
  } catch {
    return false
  }
}

function readTier(): DeviceTier {
  if (typeof window === 'undefined') return 'static'
  const finePointer = window.matchMedia?.('(pointer: fine)').matches ?? true
  const wide = window.innerWidth >= MIN_FULL_WIDTH
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  const enoughMemory = mem === undefined || mem >= MIN_MEMORY_GB
  return finePointer && wide && enoughMemory && hasWebGL2() ? 'full' : 'static'
}

/** HARDWARE_3D §6 tiers. Evaluated once on mount and again on resize. */
export function useDeviceTier(): DeviceTier {
  const [tier, setTier] = useState<DeviceTier>(readTier)
  useEffect(() => {
    const onResize = () => setTier(readTier())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return tier
}
