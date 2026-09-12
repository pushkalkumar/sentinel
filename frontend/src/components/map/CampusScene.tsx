import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import clsx from 'clsx'
import type { NodeId } from '@/lib/types'
import type { CampusMapProps } from './CampusMap'
import { useReducedMotion } from '@/three/shared/motionPrefs'
import { anchorMap } from '@/three/campus/positions'
import { ATTRIBUTION } from '@/three/campus/geo'
import { Terrain } from '@/three/campus/Terrain'
import { Buildings } from '@/three/campus/Buildings'
import { Rig } from '@/three/campus/Rig'
import { CameraRig } from '@/three/campus/CameraRig'
import { FOV, distanceFor, restPosition } from '@/three/campus/cameraMath'
import { Nodes } from '@/three/campus/Nodes'
import { Links } from '@/three/campus/Links'
import { supportsWebGL } from '@/three/campus/webgl'

// eslint-disable-next-line react-refresh/only-export-components -- callers gate on this before mounting the scene
export { supportsWebGL }

const FLASH_MS = 160
/** Fog starts just past the campus and reaches the ground colour at the data edge. */
const FOG_NEAR_OFFSET = 6
const FOG_DEPTH = 78
const EMPTY_HOPS: NonNullable<CampusMapProps['hops']> = []

/** Redraw the demand-mode canvas whenever the props that shape the scene change. */
function Invalidate({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the caller owns the list
  useEffect(() => { invalidate() }, deps)
  return null
}

/**
 * Lit architectural model of the real campus (docs/MAP_DATA.md), same props as the SVG CampusMap.
 * Returns null for floor plans and where WebGL is missing so the caller can fall back to CampusMap.
 */
export function CampusScene(props: CampusMapProps) {
  const { nodes, links, mode, selectedId = null, onSelect, hops, highlightCode, ground, compact = false, labels = 'always', className } = props
  const [webgl] = useState(supportsWebGL)
  const reducedMotion = useReducedMotion()
  const [hoverId, setHoverId] = useState<NodeId | null>(null)
  const [flashes, setFlashes] = useState<Record<NodeId, number>>({})
  const timers = useRef<number[]>([])
  const hopList = hops ?? EMPTY_HOPS

  useEffect(() => () => { for (const t of timers.current) window.clearTimeout(t) }, [])

  const onLanded = useCallback((id: NodeId) => {
    setFlashes((f) => ({ ...f, [id]: Date.now() }))
    timers.current.push(window.setTimeout(() => {
      setFlashes((f) => Object.fromEntries(Object.entries(f).filter(([k]) => k !== id)))
    }, FLASH_MS))
  }, [])

  const anchors = useMemo(() => anchorMap(nodes), [nodes])

  // The incident's origin node comes from the hop log payload (CONTRACT §3.7).
  const highlightNode = useMemo(() => {
    if (!highlightCode) return null
    for (let i = hopList.length - 1; i >= 0; i -= 1) {
      if (hopList[i].payload?.code === highlightCode) return hopList[i].origin_node
    }
    return null
  }, [hopList, highlightCode])

  if (ground !== 'campus' || !webgl) return null

  const distance = distanceFor(compact)
  const fogNear = distance + FOG_NEAR_OFFSET
  const fogFar = fogNear + FOG_DEPTH

  return (
    <div
      className={clsx('overflow-hidden', className ?? 'relative w-full aspect-[10/7]')}
      role="img"
      aria-label={`Campus model, ${mode} mode`}
      data-ground-layer="campus"
      data-compact={compact || undefined}
    >
      <div className="relative w-full h-full">
      <Canvas
        dpr={[1, 1.5]}
        frameloop="demand"
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ fov: FOV, near: 2, far: 420, position: restPosition(distance).toArray() }}
        gl={{
          antialias: false, alpha: false, powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: THREE.SRGBColorSpace,
        }}
        onPointerMissed={() => setHoverId(null)}
        style={{ touchAction: 'pan-y' }}
      >
        <Invalidate deps={[nodes, links, mode, selectedId, hopList, highlightCode, compact, labels, hoverId, flashes]} />
        <Rig fogNear={fogNear} fogFar={fogFar} />
        <Terrain />
        <Buildings />
        <Links links={links} anchors={anchors} mode={mode} hops={hopList} reducedMotion={reducedMotion} onLanded={onLanded} />
        <Nodes
          nodes={nodes} anchors={anchors} mode={mode}
          selectedId={selectedId} hoverId={hoverId} highlightNode={highlightNode} flashes={flashes}
          labels={labels} compact={compact} reducedMotion={reducedMotion}
          onHover={setHoverId} onSelect={onSelect}
        />
        <CameraRig distance={distance} drift={!reducedMotion} />
      </Canvas>
      <p className="pointer-events-none absolute bottom-2 right-3 font-sans text-[10px] text-ink-4 select-none">{ATTRIBUTION}</p>
      </div>
    </div>
  )
}
