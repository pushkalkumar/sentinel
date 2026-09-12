import { useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { NodeModel } from './NodeModel'
import { FrameloopController } from '../shared/FrameloopController'
import { SchematicFallback } from '../shared/Fallbacks'
import { SIGNAL } from './materials'
import { useHardwareStore, type DeviceTier } from '@/store/hardware'

const STATIC_EXPLODE = 0.72
/** Model sits right of centre so the headline on the left does not cover it. */
const MODEL_X = 2.5

function Lights() {
  return (
    <>
      <ambientLight intensity={0.3} />
      <hemisphereLight args={['#3a3f48', '#0a0b0d', 0.6]} />
      <directionalLight position={[-5, 9, 4]} intensity={2.2} color="#fff4e6" />
      <directionalLight position={[7, 4, -6]} intensity={0.8} color={SIGNAL} />
      <directionalLight position={[0, -3, 6]} intensity={0.3} color="#dfe6ff" />
    </>
  )
}

/** Resets the orbit when the store's resetSeq changes. */
function ControlsReset({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const resetSeq = useHardwareStore((s) => s.resetSeq)
  const invalidate = useThree((s) => s.invalidate)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    controlsRef.current?.reset()
    invalidate()
  }, [resetSeq, controlsRef, invalidate])
  return null
}

export function NodeScene({ inView, tier }: { inView: boolean; tier: DeviceTier }) {
  const full = tier === 'full'
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  useEffect(() => {
    if (!full) useHardwareStore.getState().setExplode(STATIC_EXPLODE)
  }, [full])

  return (
    <Canvas
      dpr={[1, full ? 1.75 : 1]}
      frameloop={full ? 'demand' : 'never'}
      camera={{ fov: 30, near: 0.5, far: 200, position: [16 + MODEL_X, 11, 18] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<SchematicFallback />}
      style={{ touchAction: full ? 'none' : 'pan-y' }}
    >
      <FrameloopController inView={inView} tier={tier} watchStore />
      <Lights />
      <group position={[MODEL_X, 0, 0]}><NodeModel interactive={full} /></group>
      <ContactShadows position={[0, -0.85, 0]} opacity={0.55} scale={30} blur={2.4} far={12} resolution={384} color="#000" />
      {full && (
        <>
          <OrbitControls
            ref={controlsRef} makeDefault enablePan={false} minDistance={16} maxDistance={40}
            minPolarAngle={0.25} maxPolarAngle={1.35} enableDamping dampingFactor={0.08} target={[MODEL_X, 2.2, 0]}
          />
          <ControlsReset controlsRef={controlsRef} />
        </>
      )}
    </Canvas>
  )
}
