import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useSiteStore } from '@/store/site'
import { BAND_META } from '@/lib/bands'
import type { BandKey, NodeStatus } from '@/lib/types'
import { CAMPUS_NODES, type CampusNode } from './campusGeometry'

const OFFLINE = '#46423D'
const PILLAR_H = 1.6
const GATEWAY_H = 2.4

function glowTexture(hex: string): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, hex)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const glowCache = new Map<string, THREE.Texture>()
const glowFor = (hex: string) => {
  let t = glowCache.get(hex)
  if (!t) { t = glowTexture(hex); glowCache.set(hex, t) }
  return t
}

function colourFor(band: BandKey | null | undefined, status: NodeStatus | undefined): { hex: string; word: string } {
  if (status === 'offline') return { hex: OFFLINE, word: 'no signal' }
  if (!band) return { hex: OFFLINE, word: 'no reading' }
  return { hex: BAND_META[band].color, word: BAND_META[band].shortLabel }
}

function Pillar({ node, continuous }: { node: CampusNode; continuous: boolean }) {
  const band = useSiteStore((s) => s.nodes[node.id]?.band)
  const status = useSiteStore((s) => s.nodes[node.id]?.status)
  const { hex, word } = colourFor(band, status)
  const h = node.gateway ? GATEWAY_H : PILLAR_H
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useMemo(() => glowFor(hex), [hex])

  useFrame(({ clock }) => {
    if (!mat.current) return
    mat.current.emissive.set(hex)
    mat.current.emissiveIntensity = node.gateway && continuous ? 0.9 + 0.5 * Math.sin(clock.elapsedTime * 2) : 1.4
  })

  return (
    <group position={[node.x, 0, node.z]}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.22, h, 24]} />
        <meshStandardMaterial ref={mat} color="#0a0b0d" emissive={hex} emissiveIntensity={1.4} />
      </mesh>
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={glow} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, 0.03, 8, 32]} />
        <meshBasicMaterial color="#3a3f48" />
      </mesh>
      {node.gateway && (
        <mesh position={[0, h - 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.3, 0.025, 8, 32]} />
          <meshBasicMaterial color="#3a3f48" />
        </mesh>
      )}
      <Html position={[0, h + 0.4, 0]} center zIndexRange={[10, 0]} pointerEvents="none">
        <div className="font-mono text-2xs leading-4 text-center whitespace-nowrap select-none">
          <div className="text-ink-2">{node.label}</div>
          <div style={{ color: hex }}>{word}</div>
        </div>
      </Html>
    </group>
  )
}

export function Pillars({ continuous, labels }: { continuous: boolean; labels: boolean }) {
  return (
    <group>
      {CAMPUS_NODES.map((n) => (labels ? <Pillar key={n.id} node={n} continuous={continuous} /> : <PillarNoLabel key={n.id} node={n} />))}
    </group>
  )
}

/** Static tier: same geometry, no Html label. */
function PillarNoLabel({ node }: { node: CampusNode }) {
  const band = useSiteStore((s) => s.nodes[node.id]?.band)
  const status = useSiteStore((s) => s.nodes[node.id]?.status)
  const { hex } = colourFor(band, status)
  const h = node.gateway ? GATEWAY_H : PILLAR_H
  return (
    <group position={[node.x, 0, node.z]}>
      <mesh position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.22, h, 24]} />
        <meshStandardMaterial color="#0a0b0d" emissive={hex} emissiveIntensity={1.4} />
      </mesh>
    </group>
  )
}
