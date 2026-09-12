import { useEffect, useState } from 'react'
import { Grain } from '@/components/shell/Grain'
import { useDemoStore } from '@/features/demo/demoStore'
import { chapterKind } from '@/features/demo/chapterKind'
import { useDirector, useDemoKeys } from '@/features/demo/useDirector'
import { useDemoHydrate } from '@/features/demo/useDemoHydrate'
import { DemoHeader } from '@/features/demo/DemoHeader'
import { MapStage } from '@/features/demo/MapStage'
import { DecisionPanel } from '@/features/demo/DecisionPanel'
import { IncidentsPanel } from '@/features/demo/IncidentsPanel'
import { RollcallPanel } from '@/features/demo/RollcallPanel'
import { CaptionBar } from '@/features/demo/CaptionBar'
import { SituationBrief } from '@/features/demo/SituationBrief'
import { XenonToast } from '@/features/demo/XenonToast'
import { useXenonAlive } from '@/features/demo/useXenonAlive'
import { LiveHardware } from '@/features/hardware/LiveHardware'

/** The composition is laid out once at 1440 × 900 and scaled to fit the projector; it never scrolls. */
const STAGE_W = 1440
const STAGE_H = 900

function useFitScale(): number {
  const [scale, setScale] = useState(() => Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
  useEffect(() => {
    const onResize = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

/**
 * /demo: the war room. Left 60% campus map with live node states and hop animation, right 40% three
 * quiet cards (decision, incidents, roll call), a slim caption bar with the director controls.
 * Everything on screen comes from the live stores; the director only tells the backend which
 * chapter to stage next.
 */
export default function Demo() {
  useDemoHydrate()
  useDirector()
  useDemoKeys()
  const scale = useFitScale()
  const kind = useDemoStore((s) => chapterKind(s.chapters[s.index]?.id))
  const xenonAlive = useXenonAlive()

  return (
    <div className="h-dvh w-full overflow-hidden bg-canvas text-ink flex items-center justify-center">
      <Grain />
      <div
        className="relative z-[2] flex flex-col shrink-0"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'center' }}
      >
        <DemoHeader />
        <main className="flex-1 min-h-0 grid grid-cols-[3fr_2fr] gap-4 px-8">
          <MapStage kind={kind} />
          <div className="min-h-0 grid grid-rows-[auto_auto_minmax(0,1fr)_minmax(0,1fr)_auto] gap-4">
            <DecisionPanel />
            <SituationBrief />
            <IncidentsPanel />
            <RollcallPanel kind={kind} />
            {/* The two real boards on the desk, only while Xenon A is actually reporting. */}
            {xenonAlive && <LiveHardware />}
          </div>
        </main>
        <CaptionBar />
      </div>
      <XenonToast />
    </div>
  )
}
