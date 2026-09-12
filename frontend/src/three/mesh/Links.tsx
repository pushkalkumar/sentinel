import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Line2, LineSegments2 } from 'three-stdlib'
import { useMeshStore } from '@/store/mesh'
import { CAMPUS_LINKS, NODE_POS, linkKey } from './campusGeometry'

const Y = 0.35
const BASE = new THREE.Color('#3a4150')
const HOT = new THREE.Color('#7F9FA0')
const DASH_SPEED = 0.6
const HEAT_DECAY = 1 / 0.5
const HEAT_RISE = 1 / 0.12

/** Dashed LoRa links. Dash offset scrolls when continuous; a hop heats its link to signal cyan and cools over 500 ms. */
export function Links({ continuous }: { continuous: boolean }) {
  const refs = useRef<Record<string, Line2 | LineSegments2 | null>>({})
  const heat = useRef<Record<string, number>>({})
  const target = useRef<Record<string, number>>({})

  useEffect(() => useMeshStore.subscribe((s, prev) => {
    if (s.hopSeq === prev.hopSeq || !s.lastHop) return
    target.current[linkKey(s.lastHop.hop_from, s.lastHop.hop_to)] = 1
  }), [])

  useFrame((state, dt) => {
    let busy = false
    for (const [a, b] of CAMPUS_LINKS) {
      const key = linkKey(a, b)
      const line = refs.current[key]
      if (!line) continue
      const mat = line.material
      if (continuous) mat.dashOffset -= dt * DASH_SPEED
      const want = target.current[key] ?? 0
      const cur = heat.current[key] ?? 0
      let next = cur
      if (want > cur) {
        next = Math.min(1, cur + dt * HEAT_RISE)
        if (next >= 1) target.current[key] = 0
      } else if (cur > 0) {
        next = Math.max(0, cur - dt * HEAT_DECAY)
      }
      if (next !== cur) {
        heat.current[key] = next
        mat.color.copy(BASE).lerp(HOT, next)
        busy = true
      }
    }
    if (busy) state.invalidate()
  })

  return (
    <group>
      {CAMPUS_LINKS.map(([a, b]) => {
        const [ax, az] = NODE_POS[a]
        const [bx, bz] = NODE_POS[b]
        const key = linkKey(a, b)
        return (
          <Line
            key={key}
            ref={(el) => { refs.current[key] = el }}
            points={[[ax, Y, az], [bx, Y, bz]]}
            color="#3a4150" lineWidth={1.4} dashed dashSize={0.35} gapSize={0.22} transparent opacity={0.9}
          />
        )
      })}
    </group>
  )
}
