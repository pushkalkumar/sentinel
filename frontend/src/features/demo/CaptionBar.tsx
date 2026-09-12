import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react'
import { chapterDurationMs, elapsedMs, useDemoStore, type DemoSpeed } from './demoStore'

const SPEEDS: DemoSpeed[] = [1, 2]
const PROGRESS_FPS_MS = 50

/** Fraction of the current chapter elapsed, polled while playing. */
function useChapterProgress(): number {
  const [frac, setFrac] = useState(0)
  useEffect(() => {
    const tick = () => {
      const s = useDemoStore.getState()
      const d = chapterDurationMs(s.chapters[s.index], s.speed)
      setFrac(d > 0 ? Math.min(1, elapsedMs(s) / d) : 0)
    }
    tick()
    const id = window.setInterval(tick, PROGRESS_FPS_MS)
    return () => window.clearInterval(id)
  }, [])
  return frac
}

function ProgressLine() {
  const chapters = useDemoStore((s) => s.chapters)
  const index = useDemoStore((s) => s.index)
  const goTo = useDemoStore((s) => s.goTo)
  const frac = useChapterProgress()
  return (
    <div className="flex items-center gap-1.5 h-4" role="list" aria-label="Chapters">
      {chapters.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="listitem"
          aria-label={`Chapter ${i + 1}: ${c.title}`}
          aria-current={i === index ? 'step' : undefined}
          onClick={() => { void goTo(i) }}
          className="group flex-1 h-4 flex items-center outline-none"
          title={c.title}
        >
          <span className="relative block w-full h-px bg-line-strong group-hover:bg-ink-3 group-focus-visible:bg-ink-3 transition-colors duration-[120ms]">
            <span
              className="absolute inset-y-0 left-0 bg-accent"
              style={{ width: i < index ? '100%' : i === index ? `${frac * 100}%` : '0%' }}
            />
          </span>
        </button>
      ))}
    </div>
  )
}

const CTRL = 'size-9 inline-flex items-center justify-center rounded-md text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.98] transition-[color,background-color,scale] duration-[120ms] disabled:opacity-40 disabled:pointer-events-none'

/** Slim bar: chapter title with its narration under it, the progress line, transport and speed. */
export function CaptionBar() {
  const status = useDemoStore((s) => s.status)
  const error = useDemoStore((s) => s.error)
  const chapters = useDemoStore((s) => s.chapters)
  const index = useDemoStore((s) => s.index)
  const playing = useDemoStore((s) => s.playing)
  const staging = useDemoStore((s) => s.staging)
  const speed = useDemoStore((s) => s.speed)
  const togglePlay = useDemoStore((s) => s.togglePlay)
  const next = useDemoStore((s) => s.next)
  const prev = useDemoStore((s) => s.prev)
  const restart = useDemoStore((s) => s.restart)
  const setSpeed = useDemoStore((s) => s.setSpeed)
  const chapter = chapters[index]
  const ready = status === 'ready'

  return (
    <footer className="flex flex-col gap-3 px-8 pb-5 shrink-0">
      <ProgressLine />
      <div className="min-h-12 flex items-center gap-8">
        <div className="min-w-0 flex-1 flex items-start gap-3">
          {status === 'error' ? (
            <span className="text-sm text-alarm">{error}</span>
          ) : chapter ? (
            <>
              <span className="font-mono text-xs text-ink-4 tabular-nums shrink-0 pt-[3px]">{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="text-base text-ink leading-tight">{chapter.title}</span>
                <span className="text-sm text-ink-2 leading-snug text-pretty line-clamp-2" aria-live="polite">{chapter.caption}</span>
              </div>
            </>
          ) : (
            <span className="text-sm text-ink-4">Loading the script</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0" aria-label="Transport">
          <button type="button" className={CTRL} onClick={() => { void restart() }} disabled={!ready} aria-label="Restart" title="Restart (R)">
            <RotateCcw size={16} strokeWidth={1.5} />
          </button>
          <button type="button" className={CTRL} onClick={() => { void prev() }} disabled={!ready || index === 0} aria-label="Previous chapter" title="Previous (←)">
            <SkipBack size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!ready}
            aria-label={playing ? 'Pause' : 'Play'}
            aria-pressed={playing}
            title={playing ? 'Pause (space)' : 'Play (space)'}
            className={clsx(
              'h-9 px-4 inline-flex items-center gap-2 rounded-md text-sm font-medium active:scale-[0.98] transition-[background-color,scale] duration-[120ms] disabled:opacity-40 disabled:pointer-events-none',
              'bg-accent text-accent-ink hover:bg-[#E4DBCD]',
            )}
          >
            {playing ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button type="button" className={CTRL} onClick={() => { void next() }} disabled={!ready || index >= chapters.length - 1} aria-label="Next chapter" title="Next (→)">
            <SkipForward size={16} strokeWidth={1.5} />
          </button>
          <div role="radiogroup" aria-label="Speed" className="ml-3 h-8 p-0.5 rounded-md bg-raised flex items-center">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={speed === s}
                onClick={() => setSpeed(s)}
                className={clsx('h-7 px-2.5 rounded-[6px] font-mono text-xs transition-[color,background-color] duration-[120ms]', speed === s ? 'bg-overlay text-ink' : 'text-ink-3 hover:text-ink-2')}
              >
                {s}×
              </button>
            ))}
          </div>
          <span className={clsx('ml-3 w-14 text-xs text-ink-4 transition-opacity duration-[200ms]', staging ? 'opacity-100' : 'opacity-0')} aria-live="polite">
            {staging ? 'staging' : ''}
          </span>
        </div>
      </div>
    </footer>
  )
}
