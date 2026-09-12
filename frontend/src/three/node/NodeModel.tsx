import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PART_REGISTRY } from './parts'
import { PART_MESHES } from './partMeshes'
import { Hotspot } from './Hotspot'
import { useHardwareStore } from '@/store/hardware'

const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3)
const localT = (t: number, delay: number) => THREE.MathUtils.clamp((t - delay) / (1 - delay), 0, 1)
const SMOOTH_RATE = 9
const HOVER_SCALE = 1.03
const SETTLE_EPS = 1e-3
const TARGET_Y_REST = 2.2
const TARGET_Y_RISE = 2.6

interface ControlsLike { target: THREE.Vector3; update: () => void }

export function NodeModel({ interactive }: { interactive: boolean }) {
  const groups = useRef<Record<string, THREE.Group | null>>({})
  const smooth = useRef(useHardwareStore.getState().explode)
  const scales = useRef<Record<string, number>>({})
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null

  useFrame((state, dt) => {
    const { explode: target, reducedMotion, hoverPartId, selectedPartId } = useHardwareStore.getState()
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * SMOOTH_RATE)
    smooth.current += (target - smooth.current) * k
    if (Math.abs(target - smooth.current) < SETTLE_EPS) smooth.current = target
    const t = smooth.current
    let busy = false
    for (const p of PART_REGISTRY) {
      const g = groups.current[p.id]
      if (!g) continue
      const e = easeOutCubic(localT(t, p.delay))
      g.position.set(p.rest[0] + p.explode[0] * e, p.rest[1] + p.explode[1] * e, p.rest[2] + p.explode[2] * e)
      const want = hoverPartId === p.id || selectedPartId === p.id ? HOVER_SCALE : 1
      const cur = scales.current[p.id] ?? 1
      const next = reducedMotion ? want : cur + (want - cur) * k
      scales.current[p.id] = next
      g.scale.setScalar(next)
      if (Math.abs(want - next) > SETTLE_EPS) busy = true
    }
    if (controls) {
      controls.target.y = TARGET_Y_REST + TARGET_Y_RISE * t
      controls.update()
    }
    if (busy || target !== smooth.current) state.invalidate()
  })

  return (
    <group>
      {PART_REGISTRY.map((p) => {
        const Mesh = PART_MESHES[p.id]
        return (
          <group key={p.id} ref={(el) => { groups.current[p.id] = el }} position={[p.rest[0], p.rest[1], p.rest[2]]}>
            <Mesh part={p} interactive={interactive} />
            {interactive && p.index > 0 && <Hotspot part={p} />}
          </group>
        )
      })}
    </group>
  )
}
