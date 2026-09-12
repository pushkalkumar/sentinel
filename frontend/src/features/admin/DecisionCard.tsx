import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDisplayCard } from '@/store/select'
import { useSiteStore } from '@/store/site'
import { BAND_META, bandIndex } from '@/lib/bands'
import { Skeleton } from '@/components/ui/Skeleton'

const COUNT_MS = 600
const EASE_ENTER: [number, number, number, number] = [0.2, 0, 0, 1]

/** Counts from the previous value to `target` over 600 ms with --ease-enter; instant under reduced motion. */
function useCountUp(target: number, reduced: boolean): number {
  const [value, setValue] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (reduced) { setValue(target); from.current = target; return }
    const start = performance.now()
    const begin = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS)
      const e = 1 - Math.pow(1 - p, 3)
      setValue(begin + (target - begin) * e)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, reduced])
  return value
}

/**
 * The single hero of /admin (DESIGN_V2 §4): the band word, one reading, one sentence.
 * Sits on the canvas with no card chrome; the band dot is the only colour.
 * Guidance strings come from BAND_META, never paraphrased.
 */
export function DecisionCard() {
  const card = useDisplayCard()
  const site = useSiteStore((s) => s.site)
  const zones = useSiteStore((s) => s.zones)
  const nodes = useSiteStore((s) => s.nodes)
  const loaded = useSiteStore((s) => s.loaded)
  const error = useSiteStore((s) => s.error)
  const reduced = useReducedMotion() ?? false
  const shown = useCountUp(card?.pm25 ?? 0, reduced)

  const indoor = site?.kind === 'floorplan'

  if (!card) {
    return (
      <section className="pt-10 pb-6 min-h-[11rem]" aria-busy={!loaded && !error}>
        {error
          ? <p className="text-sm text-alarm">{error}</p>
          : loaded
            ? <p className="text-sm text-ink-3">No readings yet. The decision fills in on the first reading from the site.</p>
            : <Skeleton className="w-64" />}
      </section>
    )
  }

  const meta = BAND_META[card.band]
  const hazardous = bandIndex(card.band) >= bandIndex('hazardous')
  const node = nodes[card.node_id]
  const zone = node ? zones.find((z) => z.id === node.zone_id) : undefined
  const word = indoor && card.band === 'good' ? 'Indoor air OK' : meta.label
  const sentence = card.guidance || meta.guidance

  return (
    <section className="pt-10 pb-6 flex items-end justify-between gap-10 flex-wrap" aria-live="polite">
      <div className="min-w-0 flex-1 basis-[22rem]">
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            <motion.h1
              key={word}
              className="display-hero text-[clamp(2.75rem,5vw,4.25rem)] text-ink flex items-center gap-4"
              initial={reduced ? false : { y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? undefined : { y: -14, opacity: 0 }}
              transition={{ duration: 0.26, ease: EASE_ENTER }}
            >
              <i aria-hidden className="size-3 rounded-full shrink-0 translate-y-[0.04em]" style={{ background: meta.color }} />
              <span className="truncate">{word}</span>
            </motion.h1>
          </AnimatePresence>
        </div>
        <p className="mt-4 text-lg text-ink-2 max-w-[44ch]">{sentence}.</p>
        {hazardous && (
          <p className="mt-2 text-sm text-ink-3">
            SMS sent to {zone?.recipient_count ?? 0} registered phones in {zone?.name ?? card.node_label}.{' '}
            <Link to="/admin/alerts" className="text-ink-2 underline underline-offset-2 decoration-line-strong hover:text-ink">See the outbox</Link>
          </p>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="stat-number text-[clamp(3.5rem,6vw,5.5rem)] leading-none text-ink">{Math.round(shown)}</div>
        <div className="mt-2 text-sm text-ink-3">
          PM2.5 <span className="font-mono text-xs">µg/m³</span>, {card.window_minutes}-min at {card.node_label}
        </div>
      </div>
    </section>
  )
}
