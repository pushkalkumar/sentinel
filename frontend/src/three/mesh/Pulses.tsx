import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useMeshStore } from '@/store/mesh'
import { NODE_POS } from './campusGeometry'

const POOL = 24
const TRAVEL_MS = 450
const DROP_AT = 0.6
const DROP_FALL_MS = 300
const Y = 0.35
const ARC = 0.35
const WHITE = new THREE.Color('#ffffff')
const RED = new THREE.Color('#FF4A3D')
const easeOutQuad = (p: number) => 1 - (1 - p) * (1 - p)

interface Pulse { from: THREE.Vector3; to: THREE.Vector3; start: number; dropped: boolean; active: boolean }

/** InstancedMesh pulse pool (HARDWARE_3D §5.3). Reduced motion: no travelling sphere, the link heat in Links.tsx carries the event. */
export function Pulses({ enabled }: { enabled: boolean }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const invalidate = useThree((s) => s.invalidate)
  const pool = useMemo<Pulse[]>(() => Array.from({ length: POOL }, () => ({
    from: new THREE.Vector3(), to: new THREE.Vector3(), start: 0, dropped: false, active: false,
  })), [])
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tmp = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!enabled) return
    return useMeshStore.subscribe((s, prev) => {
      if (s.hopSeq === prev.hopSeq || !s.lastHop) return
      const a = NODE_POS[s.lastHop.hop_from]
      const b = NODE_POS[s.lastHop.hop_to]
      if (!a || !b) return
      let slot = pool.find((p) => !p.active)
      if (!slot) slot = pool.reduce((o, p) => (p.start < o.start ? p : o), pool[0])
      slot.from.set(a[0], Y, a[1])
      slot.to.set(b[0], Y, b[1])
      slot.start = performance.now()
      slot.dropped = s.lastHop.status === 'dropped'
      slot.active = true
      invalidate()
    })
  }, [enabled, pool, invalidate])

  useFrame((state) => {
    const im = mesh.current
    if (!im) return
    const now = performance.now()
    let any = false
    pool.forEach((p, i) => {
      if (!p.active) {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        im.setMatrixAt(i, dummy.matrix)
        return
      }
      any = true
      const raw = (now - p.start) / TRAVEL_MS
      let prog = Math.min(1, raw)
      let scale = 1
      let color = WHITE
      if (p.dropped && raw > DROP_AT) {
        const f = Math.min(1, (now - p.start - DROP_AT * TRAVEL_MS) / DROP_FALL_MS)
        prog = DROP_AT
        scale = 1 - f
        color = RED
        tmp.lerpVectors(p.from, p.to, easeOutQuad(prog))
        tmp.y = (Y + ARC * Math.sin(Math.PI * prog)) * (1 - f)
        if (f >= 1) p.active = false
      } else {
        tmp.lerpVectors(p.from, p.to, easeOutQuad(prog))
        tmp.y = Y + ARC * Math.sin(Math.PI * prog)
        if (raw >= 1) p.active = false
      }
      dummy.position.copy(tmp)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      im.setMatrixAt(i, dummy.matrix)
      im.setColorAt(i, color)
    })
    im.instanceMatrix.needsUpdate = true
    if (im.instanceColor) im.instanceColor.needsUpdate = true
    if (any) state.invalidate()
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, POOL]} frustumCulled={false}>
      <sphereGeometry args={[0.11, 12, 8]} />
      <meshBasicMaterial color="#ffffff" toneMapped={false} />
    </instancedMesh>
  )
}
