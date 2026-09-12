import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { MeshLogEntry, NodeId } from '@/lib/types'
import type { NodeAnchor } from './positions'
import { SIGNAL } from './palette'

/** DESIGN §6.6: 220 ms per hop; a dropped hop dies at 60 % of the way. */
const HOP_MS = 220
const DROP_AT = 0.6
const DROP_FADE_MS = 160
const POOL = 24
const PULSE_R = 0.16
/** Pushed past the bloom threshold so the pulse reads as light, not paint. */
const PULSE_COLOUR = new THREE.Color(SIGNAL).multiplyScalar(2.4)
const PULSE_DROPPED = new THREE.Color('#E0574B').multiplyScalar(1.6)
const easeHop = (p: number) => 1 - Math.pow(1 - p, 2.2)

interface Pulse { from: THREE.Vector3; to: THREE.Vector3; start: number; dropped: boolean; telemetry: boolean; active: boolean; landed: boolean; to_id: NodeId; delivered: boolean }

export interface LinksProps {
  links: [NodeId, NodeId][]
  anchors: Map<NodeId, NodeAnchor>
  mode: 'air' | 'mesh'
  hops: MeshLogEntry[]
  reducedMotion: boolean
  onLanded: (id: NodeId, delivered: boolean) => void
}

/** Thin solid links at roof height plus an instanced pool of travelling hop pulses. */
export function Links({ links, anchors, mode, hops, reducedMotion, onLanded }: LinksProps) {
  const invalidate = useThree((s) => s.invalidate)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const seen = useRef<Set<number> | null>(null)
  const pool = useMemo<Pulse[]>(() => Array.from({ length: POOL }, () => ({
    from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, dropped: false, telemetry: false, active: false, landed: false, to_id: '', delivered: false,
  })), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    // First render: everything already in the log is history, not a new hop.
    if (seen.current === null) {
      seen.current = new Set(hops.map((h) => h.id))
      return
    }
    let started = false
    for (const h of hops) {
      if (seen.current.has(h.id)) continue
      seen.current.add(h.id)
      const a = anchors.get(h.hop_from)
      const b = anchors.get(h.hop_to)
      if (!a || !b) continue
      const dropped = h.status === 'dropped' || h.status === 'failed'
      if (reducedMotion) {
        if (!dropped) onLanded(h.hop_to, h.status === 'delivered')
        continue
      }
      let slot = pool.find((p) => !p.active)
      if (!slot) slot = pool.reduce((o, p) => (p.start < o.start ? p : o), pool[0])
      slot.from.set(a.x, a.y + PULSE_R, a.z)
      slot.to.set(b.x, b.y + PULSE_R, b.z)
      slot.start = performance.now()
      slot.dropped = dropped
      slot.telemetry = h.kind === 'telemetry'
      slot.active = true
      slot.landed = false
      slot.to_id = h.hop_to
      slot.delivered = h.status === 'delivered'
      started = true
    }
    if (started) invalidate()
  }, [hops, anchors, pool, reducedMotion, onLanded, invalidate])

  useFrame((state) => {
    const im = mesh.current
    if (!im) return
    const now = performance.now()
    let busy = false
    pool.forEach((p, i) => {
      if (!p.active) {
        dummy.position.set(0, -50, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        im.setMatrixAt(i, dummy.matrix)
        return
      }
      busy = true
      const raw = (now - p.start) / HOP_MS
      let scale = p.telemetry ? 0.6 : 1
      let colour = PULSE_COLOUR
      if (p.dropped && raw >= DROP_AT) {
        const f = Math.min(1, (now - p.start - DROP_AT * HOP_MS) / DROP_FADE_MS)
        tmp.lerpVectors(p.from, p.to, easeHop(DROP_AT))
        scale *= 1 - f
        colour = PULSE_DROPPED
        if (f >= 1) p.active = false
      } else {
        tmp.lerpVectors(p.from, p.to, easeHop(Math.min(1, raw)))
        if (raw >= 1) {
          p.active = false
          if (!p.landed) { p.landed = true; onLanded(p.to_id, p.delivered) }
        }
      }
      dummy.position.copy(tmp)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
      im.setColorAt(i, colour)
    })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    if (busy) state.invalidate()
  })

  const opacity = mode === 'mesh' ? 0.4 : 0.25

  return (
    <group>
      {links.map(([a, b]) => {
        const na = anchors.get(a)
        const nb = anchors.get(b)
        if (!na || !nb) return null
        return (
          <Line
            key={`${a}-${b}`}
            points={[[na.x, na.y, na.z], [nb.x, nb.y, nb.z]]}
            color={SIGNAL} lineWidth={1} transparent opacity={opacity} depthWrite={false}
          />
        )
      })}
      <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
        <sphereGeometry args={[PULSE_R, 14, 10]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
