import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Download } from 'lucide-react'
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
import { useSiteStore } from '@/store/site'
import { useHardwareStore } from '@/store/hardware'
import type { Node, NodeId } from '@/lib/types'
import { isPartId } from '@/three/node/parts'
import { NodeScene } from '@/three/node/NodeScene'
import { MeshScene } from '@/three/mesh/MeshScene'
import { useExplodeDriver } from '@/three/node/useExplodeDriver'
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

const STATS = [
  { value: '$31', label: 'per node at 1k' },
  { value: '3 days', label: 'battery, no sun' },
  { value: '1 to 2 km', label: 'LoRa line of sight' },
  { value: '12 to 18 h', label: 'full disaster mode' },
]

const ALIVE = [
  'Solar or USB in, ORed through Schottky diodes to one VIN.',
  'TP4056 charges the 18650 behind a DW01 protection IC.',
  '3.3 V stays on for the ESP32-S3 and the LoRa radio, always.',
  'MT3608 makes 5 V for the fan and heater, cut by a MOSFET in sleep.',
]

const BLOCK_DIAGRAM = `                     +----------------------------------------+
   6 V 2 W solar --->| TP4056 charger + protection            |
                     |      |                                 |
   18650 3400 mAh <--+------+                                 |
        |                                                     |
        v                                                     |
   3.3 V buck/LDO ---> ESP32-S3 (WiFi AP + BLE + MCU)         |
                          |  UART2 <-- PMS5003 (PM1/2.5/10)   |
                          |  I2C   <-- BME280 (temp/RH/press) |
                          |  ADC   <-- MQ-2 (smoke/LPG/CO-ish)|
                          |  SPI   <-> SX1262 LoRa 915 MHz    |
                          |  GPIO  <-- tactile button         |
                          |  GPIO  --> WS2812 RGB LED         |
                          |  GPIO  --> piezo buzzer           |
                     +----------------------------------------+
                     IP65 enclosure, vented sensor chamber, wall mount`

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
    getMeshLog(100).then((r) => { if (alive) useMeshStore.getState().hydrate(r.entries) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
}

function ExplodeControls() {
  const explode = useHardwareStore((s) => s.explode)
  const pct = Math.round(explode * 100)
  return (
    <div className="flex items-center gap-3">
      <label className="font-mono text-2xs text-ink-2 tabular-nums flex items-center gap-3">
        <span>EXPLODE {String(pct).padStart(3, '0')}</span>
        <input
          type="range" min={0} max={SLIDER_MAX} value={Math.round(explode * SLIDER_MAX)}
          aria-label="Explode"
          onPointerDown={() => useHardwareStore.getState().setManual(true)}
          onChange={(e) => {
            const s = useHardwareStore.getState()
            s.setManual(true)
            s.setExplode(Number(e.target.value) / SLIDER_MAX)
          }}
          className="w-40 accent-signal"
        />
      </label>
      <Button variant="ghost" onClick={() => useHardwareStore.getState().resetView()}>Reset view</Button>
    </div>
  )
}

function Hero({ tier }: { tier: 'full' | 'static' }) {
  const sectionRef = useRef<HTMLElement>(null)
  const inView = useInView(sectionRef)
  const full = tier === 'full'
  useExplodeDriver(sectionRef, full)

  return (
    <section ref={sectionRef} className={full ? 'h-[320vh]' : ''}>
      <div className={full ? 'sticky top-14 h-[calc(100dvh-56px)] flex' : 'flex flex-col lg:flex-row'}>
        <div className={full ? 'relative flex-1 min-w-0' : 'relative w-full aspect-[4/3] lg:flex-1 lg:aspect-auto lg:min-h-[70vh]'}>
          <div className="absolute inset-0">
            <NodeScene inView={inView} tier={tier} />
          </div>
          <div className="absolute left-6 top-6 max-w-[34ch] pointer-events-none">
            <div className="label-signage mb-3">Hardware · Sentinel Node</div>
            <h1 className="display-hero text-ink" style={{ fontSize: 'clamp(36px, 4.4vw, 64px)' }}>
              Thirteen parts.<br />Thirty-one dollars.<br />No internet required.
            </h1>
            <p className="text-sm text-ink-2 mt-4 max-w-[48ch]">
              Designed today, not fabricated, per organiser guidance. Every sensor and radio on this page is simulated in the demo.
            </p>
          </div>
          {full && (
            <>
              <div className="absolute left-6 bottom-6"><ExplodeControls /></div>
              <div className="absolute right-6 bottom-6 font-mono text-2xs text-ink-3">drag to orbit · scroll to explode</div>
            </>
          )}
        </div>
        <SpecRail className={full ? 'w-[320px] shrink-0' : 'w-full lg:w-[320px]'} compact={!full} />
      </div>
    </section>
  )
}

function MeshSection({ tier, reducedMotion }: { tier: 'full' | 'static'; reducedMotion: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const inView = useInView(ref)
  return (
    <section ref={ref} className="space-y-6">
      <h2 className="display-h1 text-2xl text-ink">Eight boxes, one radio channel, no tower.</h2>
      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <Panel title="Campus mesh" meta="Roosevelt High School" padded={false} right={<SimTag kind="mesh" />}>
          <div className="aspect-[16/10] w-full">
            <MeshScene inView={inView} tier={tier} reducedMotion={reducedMotion} />
          </div>
        </Panel>
        <Panel title="Hop log" padded={false} bodyClassName="min-h-[320px] lg:min-h-0" className="lg:max-h-none">
          <HopLog3d />
        </Panel>
      </div>
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
        <Hero tier={tier} />
        <main className="max-w-[1600px] mx-auto px-6 py-16 space-y-20">
          <StatStrip items={STATS} />

          <section className="grid lg:grid-cols-[320px_1fr] gap-8">
            <h2 className="display-h1 text-xl text-ink">How it stays alive</h2>
            <ol className="divide-y divide-line">
              {ALIVE.map((line, i) => (
                <li key={i} className="flex items-baseline gap-5 py-3">
                  <span className="font-mono text-2xs text-signal tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-base text-ink-2">{line}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="display-h1 text-xl text-ink">Bill of materials</h2>
              <span className="font-mono text-2xs text-ink-3">Rows link to the part above</span>
            </div>
            <BomTable />
          </section>

          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <h2 className="display-h1 text-xl text-ink">Schematic</h2>
              <a href={schematicUrl} download="sentinel-node-schematic.svg" className="inline-flex items-center gap-2 h-9 px-3.5 rounded-sm bg-raised border border-line-strong text-base font-medium text-ink hover:bg-overlay">
                <Download size={20} strokeWidth={1.5} />Download schematic
              </a>
            </div>
            <figure className="hairline rounded-md overflow-hidden bg-surface">
              <img src={schematicUrl} alt="Sentinel Node block schematic, rev A" className="w-full h-auto block" />
              <figcaption className="font-mono text-2xs text-ink-3 px-5 h-10 flex items-center border-t border-line">
                Block-level schematic. Pin numbers per spec §3.2.
              </figcaption>
            </figure>
          </section>

          <section className="grid lg:grid-cols-2 gap-4 items-start">
            <Panel title="Block diagram" meta="spec §3.1" padded={false}>
              <pre className="font-mono text-xs leading-4 text-ink-2 p-5 overflow-x-auto">{BLOCK_DIAGRAM}</pre>
            </Panel>
            <PinMap />
          </section>

          <MeshSection tier={tier} reducedMotion={reducedMotion} />
        </main>
        <SafetyFooter />
      </div>
    </div>
  )
}
