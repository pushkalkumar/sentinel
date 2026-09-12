// Director state for /demo. Chapters are staged server-side (POST /api/demo/chapter); what the
// screen shows always comes from the live WS stores, never from here.
import { create } from 'zustand'
import { DemoApiError, getDemoScript, postDemoChapter, postDemoReset, type DemoChapter, type DemoSource } from './demoApi'
import { stageStubChapter, stubReset, STUB_SCRIPT } from './demoFallback'

export type DemoSpeed = 1 | 2
export type DemoStatus = 'loading' | 'ready' | 'error'

export interface DemoState {
  status: DemoStatus
  source: DemoSource
  error: string | null
  chapters: DemoChapter[]
  index: number
  playing: boolean
  speed: DemoSpeed
  /** A chapter POST is in flight; the clock waits for it. */
  staging: boolean
  /** Wall ms spent in the current chapter before the last pause. */
  accumulatedMs: number
  /** performance.now() when the current play run began; null while paused. */
  runStartedAt: number | null
  /** Bumps whenever a chapter is (re)entered, so effects can react. */
  chapterSeq: number

  load: () => Promise<void>
  goTo: (index: number, opts?: { play?: boolean }) => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
  restart: () => Promise<void>
  togglePlay: () => void
  setSpeed: (speed: DemoSpeed) => void
  /** Called by the ticker when the chapter clock runs out. */
  advance: () => Promise<void>
}

export function chapterDurationMs(c: DemoChapter | undefined, speed: DemoSpeed): number {
  return ((c?.duration_s ?? 8) * 1000) / speed
}

export function elapsedMs(s: Pick<DemoState, 'accumulatedMs' | 'runStartedAt'>, now = performance.now()): number {
  return s.accumulatedMs + (s.runStartedAt === null ? 0 : now - s.runStartedAt)
}

async function stage(source: DemoSource, id: string): Promise<void> {
  if (source === 'api') await postDemoChapter(id)
  else await stageStubChapter(id)
}

export const useDemoStore = create<DemoState>()((set, get) => ({
  status: 'loading',
  source: 'api',
  error: null,
  chapters: [],
  index: 0,
  playing: false,
  speed: 1,
  staging: false,
  accumulatedMs: 0,
  runStartedAt: null,
  chapterSeq: 0,

  load: async () => {
    set({ status: 'loading', error: null })
    try {
      const script = await getDemoScript()
      if (!script.chapters.length) throw new DemoApiError('EMPTY', 'Script has no chapters', 200)
      set({ status: 'ready', source: 'api', chapters: script.chapters })
    } catch (e) {
      // Backend director not deployed yet: drive the existing endpoints from the browser instead.
      if (e instanceof DemoApiError && e.code === 'NETWORK') {
        set({ status: 'error', error: 'Could not reach the server.' })
        return
      }
      set({ status: 'ready', source: 'stub', chapters: STUB_SCRIPT.chapters })
    }
  },

  goTo: async (index, opts) => {
    const { chapters, source, playing } = get()
    if (chapters.length === 0) return
    const i = Math.max(0, Math.min(chapters.length - 1, index))
    const play = opts?.play ?? playing
    set({ index: i, staging: true, accumulatedMs: 0, runStartedAt: null, playing: play, chapterSeq: get().chapterSeq + 1 })
    const seq = get().chapterSeq
    try {
      await stage(source, chapters[i].id)
    } catch {
      /* a failed stage still shows whatever the live stores hold */
    }
    // A newer goTo superseded this one while the POST was in flight.
    if (get().chapterSeq !== seq) return
    set({ staging: false, runStartedAt: get().playing ? performance.now() : null })
  },

  next: async () => {
    const { index, chapters } = get()
    if (index < chapters.length - 1) await get().goTo(index + 1)
  },

  prev: async () => {
    const { index } = get()
    await get().goTo(Math.max(0, index - 1))
  },

  restart: async () => {
    const { source } = get()
    // Show chapter one at once; the reset request can take a few seconds behind a running chapter.
    set({ index: 0, playing: false, runStartedAt: null, accumulatedMs: 0, staging: true, chapterSeq: get().chapterSeq + 1 })
    const seq = get().chapterSeq
    try {
      if (source === 'api') await postDemoReset()
      else await stubReset()
    } catch {
      /* reset is best effort */
    }
    if (get().chapterSeq !== seq) return
    await get().goTo(0, { play: true })
  },

  togglePlay: () => {
    const s = get()
    if (s.status !== 'ready') return
    if (s.playing) {
      set({ playing: false, accumulatedMs: elapsedMs(s), runStartedAt: null })
      return
    }
    // Nothing staged yet: the first Play enters chapter one instead of timing the live state.
    if (s.chapterSeq === 0) {
      void s.goTo(0, { play: true })
      return
    }
    const atEnd = s.index >= s.chapters.length - 1 && elapsedMs(s) >= chapterDurationMs(s.chapters[s.index], s.speed)
    if (atEnd) {
      void s.restart()
      return
    }
    set({ playing: true, runStartedAt: s.staging ? null : performance.now() })
  },

  setSpeed: (speed) => {
    const s = get()
    // Re-base the clock so the progress fraction is preserved across the speed change.
    const frac = elapsedMs(s) / chapterDurationMs(s.chapters[s.index], s.speed)
    const accumulatedMs = frac * chapterDurationMs(s.chapters[s.index], speed)
    set({ speed, accumulatedMs, runStartedAt: s.runStartedAt === null ? null : performance.now() })
  },

  advance: async () => {
    const s = get()
    if (s.index >= s.chapters.length - 1) {
      set({ playing: false, runStartedAt: null, accumulatedMs: chapterDurationMs(s.chapters[s.index], s.speed) })
      return
    }
    await s.goTo(s.index + 1)
  },
}))
