import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Html, useCursor } from '@react-three/drei'
import * as THREE from 'three'
import clsx from 'clsx'
import type { Node, NodeId } from '@/lib/types'
import { BAND_META } from '@/lib/bands'
import type { LabelMode } from '@/components/map/NodeDot'
import type { NodeAnchor } from './positions'
import { ACCENT, ALARM, OFFLINE, SIGNAL } from './palette'

const DISC_R = 0.27
const DISC_H = 0.05
const HALO_R = 0.72
const RING_PERIOD_S = 1.7
const RING_MAX_R = 1.8

const discGeo = new THREE.CylinderGeometry(DISC_R, DISC_R, DISC_H, 40)
const squareGeo = new THREE.BoxGeometry(DISC_R * 1.8, DISC_H, DISC_R * 1.8)
const haloGeo = new THREE.CircleGeometry(HALO_R, 48)
const ringGeo = new THREE.RingGeometry(0.93, 1, 64)
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0]

export interface NodesProps {
  nodes: Node[]
  anchors: Map<NodeId, NodeAnchor>
  mode: 'air' | 'mesh'
  selectedId: NodeId | null
  hoverId: NodeId | null
  highlightNode: NodeId | null
  flashes: Record<NodeId, number>
  labels: LabelMode
  compact: boolean
  reducedMotion: boolean
  onHover: (id: NodeId | null) => void
  onSelect?: (id: NodeId) => void
}

interface PulseRingProps { position: [number, number, number]; colour: string; delay: number; animate: boolean; opacity: number }

/** An expanding, fading ring. Static (mid-size, faint) under reduced motion. */
function PulseRing({ position, colour, delay, animate, opacity }: PulseRingProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame((state) => {
    if (!mesh.current || !mat.current) return
    if (!animate) {
      mesh.current.scale.setScalar(RING_MAX_R * 0.55)
      mat.current.opacity = opacity * 0.5
      return
    }
    const phase = ((state.clock.elapsedTime / RING_PERIOD_S) + delay) % 1
    const eased = 1 - (1 - phase) * (1 - phase)
    mesh.current.scale.setScalar(DISC_R + eased * (RING_MAX_R - DISC_R))
    mat.current.opacity = opacity * (1 - phase)
    state.invalidate()
  })
  return (
    <mesh ref={mesh} geometry={ringGeo} position={position} rotation={FLAT} renderOrder={3}>
      <meshBasicMaterial ref={mat} color={colour} transparent depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

function StaticRing({ position, colour, radius, opacity }: { position: [number, number, number]; colour: string; radius: number; opacity: number }) {
  return (
    <mesh geometry={ringGeo} position={position} rotation={FLAT} scale={radius} renderOrder={3}>
      <meshBasicMaterial color={colour} transparent opacity={opacity} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
    </mesh>
  )
}

interface DiscProps {
  node: Node; anchor: NodeAnchor; mode: 'air' | 'mesh'
  selected: boolean; hovered: boolean; highlighted: boolean; flash: boolean
  showLabel: boolean; compact: boolean; reducedMotion: boolean
  onHover: (id: NodeId | null) => void; onSelect?: (id: NodeId) => void
}

function Disc({ node: n, anchor, mode, selected, hovered, highlighted, flash, showLabel, compact, reducedMotion, onHover, onSelect }: DiscProps) {
  const fire = n.open_alerts.some((a) => a.kind === 'LOCAL_FIRE')
  const alerting = !fire && n.open_alerts.length > 0
  const offline = n.status === 'offline'
  const bandColour = n.band ? BAND_META[n.band].color : OFFLINE
  const colour = fire ? ALARM : bandColour
  const emissive = offline ? 0 : flash ? 2.2 : fire ? 1.6 : 1.1
  const pos: [number, number, number] = [anchor.x, anchor.y, anchor.z]
  const flat: [number, number, number] = [anchor.x, anchor.y - DISC_H / 2 + 0.004, anchor.z]
  const labelColour = fire ? 'text-alarm' : offline ? 'text-ink-4' : selected ? 'text-ink' : 'text-ink-2'
  useCursor(hovered && !!onSelect)

  return (
    <group>
      {!offline && (
        <mesh geometry={haloGeo} position={flat} rotation={FLAT} renderOrder={2}>
          <meshBasicMaterial color={colour} transparent opacity={fire ? 0.2 : 0.09} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh
        geometry={n.is_gateway ? squareGeo : discGeo}
        position={pos}
        castShadow
        onPointerOver={(e) => { e.stopPropagation(); onHover(n.id) }}
        onPointerOut={() => onHover(null)}
        onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(n.id) } : undefined}
      >
        <meshStandardMaterial
          color={offline ? '#151312' : colour} emissive={colour} emissiveIntensity={emissive}
          roughness={0.5} metalness={0}
        />
      </mesh>
      {/* generous hit target so hover labels are easy to reach */}
      <mesh position={pos} rotation={FLAT} visible={false} onPointerOver={(e) => { e.stopPropagation(); onHover(n.id) }} onPointerOut={() => onHover(null)} onClick={onSelect ? (e) => { e.stopPropagation(); onSelect(n.id) } : undefined}>
        <circleGeometry args={[HALO_R, 16]} />
      </mesh>
      {fire && (
        <>
          <PulseRing position={flat} colour={ALARM} delay={0} animate={!reducedMotion} opacity={0.75} />
          <PulseRing position={flat} colour={ALARM} delay={0.5} animate={!reducedMotion} opacity={0.5} />
        </>
      )}
      {alerting && !offline && <PulseRing position={flat} colour={bandColour} delay={0} animate={!reducedMotion} opacity={0.45} />}
      {highlighted && <PulseRing position={flat} colour={SIGNAL} delay={0.25} animate={!reducedMotion} opacity={0.6} />}
      {flash && <StaticRing position={flat} colour={SIGNAL} radius={0.75} opacity={0.6} />}
      {selected && <StaticRing position={flat} colour={ACCENT} radius={0.62} opacity={0.9} />}
      {showLabel && (
        <Html position={[anchor.x, anchor.y + 0.25, anchor.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          <div className={clsx('flex flex-col items-center font-sans leading-tight select-none', compact ? 'text-[12px]' : 'text-[11px]', labelColour)} style={{ transform: 'translateY(-100%)', textShadow: '0 1px 2px rgba(11,10,9,0.9)' }}>
            <span>{n.label}</span>
            {mode === 'air' && !compact && n.latest && !offline && (
              <span className="font-mono text-[10px]" style={{ color: colour }}>{Math.round(n.latest.pm25)}</span>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

/** Emissive discs on the roof (or the ground), band-coloured, with rings for alarms, highlights and selection. */
export function Nodes({ nodes, anchors, mode, selectedId, hoverId, highlightNode, flashes, labels, compact, reducedMotion, onHover, onSelect }: NodesProps) {
  const invalidate = useThree((s) => s.invalidate)
  const alarmCount = useMemo(() => nodes.filter((n) => n.open_alerts.length > 0).length, [nodes])
  useEffect(() => { invalidate() }, [alarmCount, highlightNode, invalidate])

  return (
    <group>
      {nodes.map((n) => {
        const a = anchors.get(n.id)
        if (!a) return null
        const alerting = n.open_alerts.length > 0
        const selected = selectedId === n.id
        const showLabel = labels === 'always' || selected || alerting || hoverId === n.id
        return (
          <Disc
            key={n.id} node={n} anchor={a} mode={mode}
            selected={selected} hovered={hoverId === n.id} highlighted={highlightNode === n.id} flash={n.id in flashes}
            showLabel={showLabel} compact={compact} reducedMotion={reducedMotion}
            onHover={onHover} onSelect={onSelect}
          />
        )
      })}
    </group>
  )
}
