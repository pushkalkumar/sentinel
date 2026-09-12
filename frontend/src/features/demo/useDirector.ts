import { useEffect } from 'react'
import { chapterDurationMs, elapsedMs, useDemoStore } from './demoStore'

const TICK_MS = 100

/** Loads the script once and advances chapters when their clock runs out. Mount once per page. */
export function useDirector(): void {
  const load = useDemoStore((s) => s.load)
  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const id = window.setInterval(() => {
      const s = useDemoStore.getState()
      if (!s.playing || s.staging || s.status !== 'ready') return
      if (elapsedMs(s) >= chapterDurationMs(s.chapters[s.index], s.speed)) void s.advance()
    }, TICK_MS)
    return () => window.clearInterval(id)
  }, [])
}

/** Keyboard: space play/pause, arrows prev/next, R restart, F fullscreen. */
export function useDemoKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // A focused button handles space itself; do not toggle twice.
      if (e.key === ' ' && tag === 'BUTTON') return
      const s = useDemoStore.getState()
      switch (e.key) {
        case ' ':
          e.preventDefault()
          s.togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          void s.next()
          break
        case 'ArrowLeft':
          e.preventDefault()
          void s.prev()
          break
        case 'r':
        case 'R':
          void s.restart()
          break
        case 'f':
        case 'F':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen?.()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
