import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import schematicUrl from '@hardware/schematic.svg'
import { Grain } from '@/components/shell/Grain'
import { SafetyFooter } from '@/components/SafetyFooter'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { SimTag } from '@/components/ui/SimTag'
import { StatStrip } from '@/components/ui/StatStrip'
import { useLive } from '@/lib/live'
import { getMeshLog, listNodes } from '@/lib/api'
import { useMeshStore } from '@/store/mesh'
import { useSessionStore } from '@/store/session'
import { useSiteStore } from '@/store/site'
import { useHardwareStore } from '@/store/hardware'
import type { Node, NodeId } from '@/lib/types'
import { isPartId } from '@/three/node/parts'
import { NodeScene } from '@/three/node/NodeScene'
import { MeshScene } from '@/three/mesh/MeshScene'
import { useExplodeDriver } from '@/three/node/useExplodeDriver'
import { useIntroExplode } from '@/three/node/useIntroExplode'
import { useDeviceTier, useReducedMotion } from '@/three/shared/motionPrefs'
import { HardwareBar } from '@/features/hardware/HardwareBar'
import { SpecRail } from '@/features/hardware/SpecRail'
import { BomTable } from '@/features/hardware/BomTable'
import { PinMap } from '@/features/hardware/PinMap'
import { HopLog3d } from '@/features/hardware/HopLog3d'

const SITE_ID = 1
const DEEP_LINK_EXPLODE = 0.85
const SLIDER_MAX = 1000
const IN_VIEW_THRESHOLD = 0.15
const HINT_MS = 3000
/** The headline dissolves as the stack opens so the part labels have the left margin to themselves. */
const HEADLINE_FADE = { from: 0.3, to: 0.62 } as const

const STATS = [
  { value: '$31', label: 'per node at 1,000 units' },
  { value: '3 days', label: 'on one 18650, no sun' },
  { value: '2 km', label: 'per LoRa hop with line of sight' },
  { value: '18 h', label: 'in full disaster mode, 12 h worst case' },
]

const ALIVE = [
  'Solar or USB comes in and is ORed through Schottky diodes to one input rail.',
  'A TP4056 charges the 18650 behind a DW01 protection IC, so a bad cell cannot take the node with it.',
  'The 3.3 V rail for the ESP32-S3 and the LoRa radio never switches off.',
  'An MT3608 makes 5 V for the fan and the gas heater, and a MOSFET cuts it in sleep.',
]

function useInView(ref: React.RefObject<HTMLElement | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: IN_VIEW_THRESHOLD })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return inView
}

/** Public page: no shell, so it opens its own live socket and seeds node bands from the public node list. */
function useHardwareData() {
  useLive()
  useEffect(() => {
    let alive = true
    listNodes(SITE_ID).then((nodes) => {
      if (!alive || useSiteStore.getState().loaded) return
      const map: Record<NodeId, Node> = Object.fromEntries(nodes.map((n) => [n.id, n]))
      useSiteStore.setState({ nodes: map })
    }).catch(() => undefined)
    // The hop log needs a session; skip it for anonymous visitors instead of logging a 401.
    if (useSessionStore.getState().token) {
      getMeshLog(100).then((r) => { if (alive) useMeshStore.getState().hydrate(r.entries) }).catch(() => undefined)
    }
    return () => { alive = false }
  }, [])
}

const RANGE =
  'w-44 h-5 appearance-none bg-transparent cursor-pointer ' +
  '[&::-webkit-slider-runnable-track]:h-px [&::-webkit-slider-runnable-track]:bg-accent-line [&::-webkit-slider-runnable-track]:rounded-full ' +
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:-mt-[5.5px] ' +
  '[&::-moz-range-track]:h-px [&::-moz-range-track]:bg-accent-line [&::-moz-range-thumb]:size-3 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent'

function ExplodeControls() {
  const explode = useHardwareStore((s) => s.explode)
  const inputRef = useRef<HTMLInputElement>(null)

  // Uncontrolled input with a native listener so keyboard, pointer and synthetic `input` events all reach the store.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onInput = () => {
      const s = useHardwareStore.getState()
      s.setManual(true)
      s.setExplode(Number(el.value) / SLIDER_MAX)
    }
    const onPointerDown = () => { useHardwareStore.getState().setManual(true); useHardwareStore.getState().markInteracted() }
    el.addEventListener('input', onInput)
    el.addEventListener('pointerdown', onPointerDown)
    return () => {
      el.removeEventListener('input', onInput)
      el.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const next = String(Math.round(explode * SLIDER_MAX))
    if (el.value !== next) el.value = next
  }, [explode])

  return (
    <div className="flex items-center gap-5">
      <label className="flex items-center gap-4">
        <span className="text-xs text-ink-3">Explode</span>
        <input
          ref={inputRef}
          type="range" min={0} max={SLIDER_MAX} step={1} defaultValue={0}
          aria-label="Explode" aria-valuetext={`${Math.round(explode * 100)} percent`}
          className={RANGE}
        />
      </label>
      <Button variant="ghost" onClick={() => useHardwareStore.getState().resetView()}>Reset view</Button>
    </div>
  )
}

/** One 3 s hint after the first drag, wheel or slider touch. Never again this visit. */
function HintToast() {
  const interacted = useHardwareStore((s) => s.interacted)
  const [phase, setPhase] = useState<'idle' | 'shown' | 'done'>('idle')
  useEffect(() => {
    if (!interacted || phase !== 'idle') return
    setPhase('shown')
    const t = setTimeout(() => setPhase('done'), HINT_MS)
    return () => clearTimeout(t)
  }, [interacted, phase])
  return (
    <div
      aria-live="polite"
      className={
        'absolute left-1/2 bottom-7 -translate-x-1/2 h-10 px-4 rounded-md bg-overlay text-sm text-ink flex items-center whitespace-nowrap pointer-events-none ' +
        'transition-[opacity,translate] duration-[200ms] ease-[var(--ease-enter)] ' +
        (phase === 'shown' ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1')
      }
      style={{ boxShadow: 'var(--shadow-overlay)' }}
    >
      {phase === 'shown' ? 'Drag to orbit. Scroll to open it up.' : ''}
    </div>
  )
}

function Headline({ full }: { full: boolean }) {
  const explode = useHardwareStore((s) => s.explode)
  const t = Math.min(1, Math.max(0, (explode - HEADLINE_FADE.from) / (HEADLINE_FADE.to - HEADLINE_FADE.from)))
  const opacity = full ? 1 - t * t : 1
  return (
    <div
      className={full ? 'absolute left-8 top-10 max-w-[30ch] pointer-events-none' : 'px-6 pt-10 pb-6'}
      style={full ? { opacity, transform: `translateY(${(-8 * t).toFixed(1)}px)` } : undefined}
    >
      <h1 className="display-hero text-ink" style={{ fontSize: 'clamp(36px, 4.1vw, 60px)' }}>
        Thirteen parts.<br />Thirty-one dollars.<br />No internet required.
      </h1>
      <p className="text-md text-ink-2 mt-6 max-w-[38ch]">
        Designed for this submission, not yet fabricated; every part is off the shelf.
      </p>
    </div>
  )
}

function Hero({ tier, intro }: { tier: 'full' | 'static'; intro: boolean }) {
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef)
  const full = tier === 'full'
  useExplodeDriver(sectionRef, full)
  useIntroExplode(full && intro)

  return (
    <section ref={sectionRef} className={full ? 'h-[320vh]' : ''}>
      <div className={full ? 'sticky top-14 h-[calc(100dvh-56px)] flex' : 'flex flex-col'}>
        {!full && <Headline full={false} />}
        <div className={full ? 'relative flex-1 min-w-0' : 'relative w-full aspect-[4/5] sm:aspect-[4/3]'}>
          <NodeScene inView={inView} tier={tier} />
          {full && (
            <>
              <Headline full />
              <div className="absolute left-8 bottom-7"><ExplodeControls /></div>
              <HintToast />
            </>
          )}
        </div>
        <SpecRail className={full ? 'w-[320px] shrink-0' : 'w-full'} compact={!full} />
      </div>
    </section>
  )
}

function MeshSection({ tier, reducedMotion }: { tier: 'full' | 'static'; reducedMotion: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  return (
    <section ref={ref}>
      <h2 className="display-h1 text-xl text-ink">Eight boxes, one radio channel, no tower.</h2>
      <div className="grid lg:grid-cols-[1fr_360px] gap-6 mt-10">
        <Panel title="Campus mesh" meta="Roosevelt High School" padded={false}>
          <div className="aspect-[16/10] w-full">
            <MeshScene inView={inView} tier={tier} reducedMotion={reducedMotion} />
          </div>
        </Panel>
        <Panel title="Hop log" padded={false} bodyClassName="min-h-[320px] lg:min-h-0" className="lg:max-h-none">
          <HopLog3d />
        </Panel>
      </div>
      <div className="mt-6"><SimTag kind="mesh" /></div>
    </section>
  )
}

export default function Hardware() {
  const tier = useDeviceTier()
  const reducedMotion = useReducedMotion()
  const [params] = useSearchParams()
  useHardwareData()

  useEffect(() => { useHardwareStore.getState().setTier(tier) }, [tier])
  useEffect(() => { useHardwareStore.getState().setReducedMotion(reducedMotion) }, [reducedMotion])

  useEffect(() => {
    const part = params.get('part')
    if (!isPartId(part)) return
    const s = useHardwareStore.getState()
    s.setManual(true)
    s.setExplode(DEEP_LINK_EXPLODE)
    if (s.selectedPartId !== part) s.select(part)
  }, [params])

  return (
    <div className="min-h-dvh bg-canvas text-ink relative">
      <Grain />
      <div className="relative z-[2]">
        <HardwareBar />
        <Hero tier={tier} intro={!reducedMotion && !isPartId(params.get('part'))} />
        <main className="max-w-[1200px] mx-auto px-6 py-section-sm md:py-section space-y-section-sm md:space-y-section">
          <StatStrip items={STATS} />

          <section className="grid lg:grid-cols-[280px_1fr] gap-x-16 gap-y-8">
            <h2 className="display-h1 text-xl text-ink">How it stays alive</h2>
            <div className="space-y-5 max-w-[60ch]">
              {ALIVE.map((line) => (
                <p key={line} className="text-md text-ink-2">{line}</p>
              ))}
            </div>
          </section>

          <section>
            <h2 className="display-h1 text-xl text-ink">Bill of materials</h2>
            <p className="text-md text-ink-2 mt-3 max-w-[60ch]">Spec §4.1, per node. Hover a row to find the part in the model.</p>
            <div className="mt-10"><BomTable /></div>
          </section>

          <section>
            <div className="flex items-end justify-between gap-6 flex-wrap">
              <div>
                <h2 className="display-h1 text-xl text-ink">Schematic</h2>
                <p className="text-md text-ink-2 mt-3 max-w-[60ch]">Block level, rev A. Pin numbers per spec §3.2.</p>
              </div>
              <a
                href={schematicUrl} download="sentinel-node-schematic.svg"
                className="inline-flex items-center h-10 px-4 rounded-md border border-line-strong text-base font-medium text-ink hover:bg-[rgba(255,255,255,0.04)] transition-colors duration-[120ms]"
              >
                Download SVG
              </a>
            </div>
            <figure className="mt-10 rounded-lg overflow-hidden bg-surface" style={{ outline: '1px solid rgba(255,255,255,0.06)', outlineOffset: -1 }}>
              <img src={schematicUrl} alt="Sentinel Node block schematic, rev A" className="w-full h-auto block" />
            </figure>
            <div className="mt-8"><PinMap /></div>
          </section>

          <MeshSection tier={tier} reducedMotion={reducedMotion} />
        </main>
        <SafetyFooter />
      </div>
    </div>
  )
}
