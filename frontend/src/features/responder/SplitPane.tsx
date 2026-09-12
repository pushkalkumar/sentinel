import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import clsx from 'clsx'

export interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  /** Initial left share, 0..1. */
  initial?: number
  minLeft?: number
  minRight?: number
  className?: string
}

const STORAGE_KEY = 'sentinel.responder.split'

function readStored(fallback: number): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY))
    return v > 0.2 && v < 0.8 ? v : fallback
  } catch {
    return fallback
  }
}

/** DESIGN §8.5: queue left, map right, draggable hairline between them (min 360px left). */
export function SplitPane({ left, right, initial = 0.4, minLeft = 360, minRight = 360, className }: SplitPaneProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [share, setShare] = useState(() => readStored(initial))
  const [dragging, setDragging] = useState(false)

  const clamp = useCallback((px: number, width: number) => {
    const lo = minLeft / width
    const hi = 1 - minRight / width
    return Math.min(hi, Math.max(lo, px / width))
  }, [minLeft, minRight])

  useEffect(() => {
    if (!dragging) return
    const move = (e: PointerEvent) => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setShare(clamp(e.clientX - r.left, r.width))
    }
    const up = () => {
      setDragging(false)
      try { localStorage.setItem(STORAGE_KEY, String(share)) } catch { /* storage unavailable */ }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up, { once: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragging, clamp, share])

  const onKey = (e: React.KeyboardEvent) => {
    const el = ref.current
    if (!el) return
    const w = el.getBoundingClientRect().width
    const step = 24 / w
    if (e.key === 'ArrowLeft') setShare((s) => clamp((s - step) * w, w))
    if (e.key === 'ArrowRight') setShare((s) => clamp((s + step) * w, w))
  }

  return (
    <div
      ref={ref}
      className={clsx('flex min-w-0 w-full', dragging && 'select-none cursor-col-resize', className)}
    >
      <div className="min-w-0 flex flex-col" style={{ flex: `0 0 ${share * 100}%` }}>{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(share * 100)}
        aria-valuemin={20}
        aria-valuemax={80}
        tabIndex={0}
        onPointerDown={(e) => { e.preventDefault(); setDragging(true) }}
        onKeyDown={onKey}
        className="relative w-px shrink-0 bg-line cursor-col-resize group"
        title="Drag to resize"
      >
        <span className="absolute inset-y-0 -left-1.5 -right-1.5" />
        <span className={clsx('absolute inset-y-0 left-0 w-px transition-[background-color] duration-[120ms]', dragging ? 'bg-signal' : 'group-hover:bg-line-strong')} />
      </div>
      <div className="min-w-0 flex-1 flex flex-col">{right}</div>
    </div>
  )
}
