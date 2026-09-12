import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useDisplayCard } from '@/store/select'
import { useSiteStore } from '@/store/site'
import { BAND_META, bandIndex } from '@/lib/bands'
import { fmtSim } from '@/lib/time'
import { Pill } from '@/components/ui/Pill'
import { LiveDot } from '@/components/ui/LiveDot'
import { Skeleton } from '@/components/ui/Skeleton'

const COUNT_MS = 600

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

/** DESIGN §6.7. Headline strings come from BAND_META, never paraphrased. */
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
  const eyebrow = indoor ? 'INDOOR AIR' : 'OUTDOOR ACTIVITY'

  if (!card) {
    return (
      <section className="bg-surface hairline rounded-lg p-8" aria-busy={!loaded && !error}>
        <div className="label-signage mb-4">{eyebrow}</div>
        {error
          ? <p className="text-sm text-alarm">{error}</p>
          : loaded
            ? <p className="text-sm text-ink-3">No readings yet. The card fills in on the first reading from the site.</p>
            : <Skeleton className="w-64" />}
      </section>
    )
  }

  const meta = BAND_META[card.band]
  const hazardous = bandIndex(card.band) >= bandIndex('hazardous')
  const last = card.log[0]
  const node = nodes[card.node_id]
  const zone = node ? zones.find((z) => z.id === node.zone_id) : undefined
  const headline = indoor && card.band === 'good' ? 'Indoor air: OK' : card.headline || meta.headline
  const guidance = card.guidance || meta.guidance

  return (
    <section className="bg-surface hairline rounded-lg p-8" aria-live="polite">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="label-signage">{eyebrow} · {card.node_label.toUpperCase()}</span>
        <span className="ml-auto font-mono text-xs text-ink-3">since {fmtSim(card.changed_at, 'HH:mm')}</span>
        <LiveDot />
      </div>
      <div className="mt-6 flex items-start gap-8 flex-wrap">
        <div className="flex-1 min-w-[16rem]">
          <div className="relative min-h-[2.6rem] overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.h2
                key={headline}
                className="display-h1 text-[40px] text-ink"
                initial={reduced ? false : { y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduced ? undefined : { y: -12, opacity: 0 }}
                transition={{ duration: 0.24, ease: [0.2, 0, 0, 1] }}
              >
                {headline}
              </motion.h2>
            </AnimatePresence>
          </div>
          <p className="mt-3 text-lg text-ink-2">{guidance}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-[56px] leading-none tabular-nums" style={{ color: meta.color }}>
            {Math.round(shown)}
          </div>
          <div className="mt-2 font-mono text-2xs text-ink-3">PM2.5 µg/m³ {card.window_minutes}-min</div>
          <div className="mt-3 flex justify-end">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={card.band}
                initial={reduced ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? undefined : { opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Pill kind="band" value={card.band} />
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-line font-mono text-xs text-ink-3">
        {last
          ? `Rule: band ${last.band_from && bandIndex(last.band_from) < bandIndex(last.band_to) ? 'worsened' : 'changed'} ${last.band_from ? BAND_META[last.band_from].label : 'none'} → ${BAND_META[last.band_to].label} at ${fmtSim(last.at, 'HH:mm:ss')} (${last.node_id})`
          : `Rule: site band is ${meta.label} from the ${card.window_minutes}-min rolling PM2.5 at ${card.node_label}`}
      </div>
      {hazardous && (
        <div className="mt-2 text-sm text-ink-2">
          SMS sent to {zone?.recipient_count ?? 0} registered phones in zone {zone?.name ?? card.node_label}.{' '}
          <Link to="/admin/alerts" className="underline decoration-line-strong hover:decoration-signal">See the outbox</Link>
        </div>
      )}
    </section>
  )
}
