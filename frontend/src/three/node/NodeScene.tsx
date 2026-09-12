import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { NodeModel, TARGET_Y_REST } from './NodeModel'
import { FrameloopController } from '../shared/FrameloopController'
import { SchematicFallback } from '../shared/Fallbacks'
import { SIGNAL } from './materials'
import { useHardwareStore, type DeviceTier } from '@/store/hardware'

const STATIC_EXPLODE = 0.72
/** 3/4 top-down view: ~37° elevation, ~38° azimuth off the front wall, far enough that the exploded stack fits with margin. */
const CAMERA_OFFSET: [number, number, number] = [28, 30, 37]
const CAMERA_FOV = 28
/** Fraction of the stage width where the model's centre lands (the headline owns the left). */
const MODEL_CENTER_X = 0.63
/** Slow idle orbit until the user grabs the model. */
const IDLE_ROTATE_SPEED = 0.35

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

/** Shifts the projection so the orbit target sits right of centre; re-applied whenever the canvas resizes. */
function ViewOffset() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const shift = (MODEL_CENTER_X - 0.5) * size.width
    camera.setViewOffset(size.width, size.height, -shift, 0, size.width, size.height)
    camera.updateProjectionMatrix()
    invalidate()
    return () => { camera.clearViewOffset() }
  }, [camera, size.width, size.height, invalidate])
  return null
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

/** Auto-orbits slowly until the first drag; Reset view re-arms it. Off under reduced motion. */
function IdleOrbit({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const reducedMotion = useHardwareStore((s) => s.reducedMotion)
  const resetSeq = useHardwareStore((s) => s.resetSeq)
  const invalidate = useThree((s) => s.invalidate)
  const idle = useRef(true)

  useEffect(() => { idle.current = true }, [resetSeq])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const stop = () => { idle.current = false; controls.autoRotate = false }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controlsRef])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const want = idle.current && !reducedMotion
    if (controls.autoRotate !== want) controls.autoRotate = want
    if (want) invalidate()
  })
  return null
}

export function NodeScene({ inView, tier }: { inView: boolean; tier: DeviceTier }) {
  const full = tier === 'full'
  const reducedMotion = useHardwareStore((s) => s.reducedMotion)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  useEffect(() => {
    if (!full) useHardwareStore.getState().setExplode(STATIC_EXPLODE)
  }, [full])

  return (
    <Canvas
      dpr={[1, full ? 1.75 : 1]}
      frameloop={full ? 'demand' : 'never'}
      camera={{ fov: CAMERA_FOV, near: 0.5, far: 200, position: [CAMERA_OFFSET[0], CAMERA_OFFSET[1] + TARGET_Y_REST, CAMERA_OFFSET[2]] }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<SchematicFallback />}
      style={{ touchAction: full ? 'none' : 'pan-y' }}
    >
      <FrameloopController inView={inView} tier={tier} watchStore />
      <ViewOffset />
      <Lights />
      <NodeModel interactive={full} />
      <ContactShadows position={[0, -0.85, 0]} opacity={0.55} scale={30} blur={2.4} far={12} resolution={384} color="#000" />
      {full && (
        <>
          <OrbitControls
            ref={controlsRef} makeDefault enablePan={false} enableZoom={false}
            minPolarAngle={0.35} maxPolarAngle={1.3} enableDamping={!reducedMotion} dampingFactor={0.08}
            autoRotateSpeed={IDLE_ROTATE_SPEED} target={[0, TARGET_Y_REST, 0]}
          />
          <ControlsReset controlsRef={controlsRef} />
          <IdleOrbit controlsRef={controlsRef} />
        </>
      )}
    </Canvas>
  )
}
