import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { EffectComposer, N8AO, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { NodeModel } from './NodeModel'
import { Rig } from './Rig'
import { LabelOverlay } from './LabelOverlay'
import { createLabelHandles } from './labels'
import { FRAME } from './parts'
import { FrameloopController } from '../shared/FrameloopController'
import { SchematicFallback } from '../shared/Fallbacks'
import { useHardwareStore, type DeviceTier } from '@/store/hardware'

const STATIC_EXPLODE = 0.62
const CAMERA_FOV = 28
const VIEW_DIR = new THREE.Vector3(...FRAME.dir).normalize()
const REST_POLAR = Math.acos(VIEW_DIR.y)
const REST_AZIMUTH = Math.atan2(VIEW_DIR.x, VIEW_DIR.z)
const POLAR_RANGE = THREE.MathUtils.degToRad(20)
const AZIMUTH_RANGE = THREE.MathUtils.degToRad(35)
const REST_TARGET = new THREE.Vector3(0, FRAME.targetY.rest, 0)
const REST_POSITION = REST_TARGET.clone().addScaledVector(VIEW_DIR, FRAME.distance.rest)
/** Where the model's centre lands across the stage; the headline owns the left. */
const MODEL_CENTER_X = 0.58
/** 0.04 rad/s drift: OrbitControls' autoRotateSpeed is in 2π/60 rad per second units. */
const IDLE_ROTATE_SPEED = (0.04 * 60) / (2 * Math.PI)
const BG = '#0B0A09'

/** Shifts the projection so the orbit target sits right of centre; re-applied whenever the canvas resizes. */
function ViewOffset({ centerX }: { centerX: number }) {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const shift = (centerX - 0.5) * size.width
    ;(camera as THREE.PerspectiveCamera).setViewOffset(size.width, size.height, -shift, 0, size.width, size.height)
    camera.updateProjectionMatrix()
    invalidate()
    return () => { (camera as THREE.PerspectiveCamera).clearViewOffset() }
  }, [camera, size.width, size.height, invalidate, centerX])
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

/** Slow drift that bounces inside the azimuth limits until the first drag, then never again. */
function IdleDrift({ controlsRef }: { controlsRef: React.RefObject<OrbitControlsImpl | null> }) {
  const reducedMotion = useHardwareStore((s) => s.reducedMotion)
  const invalidate = useThree((s) => s.invalidate)
  const idle = useRef(true)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    const stop = () => {
      idle.current = false
      controls.autoRotate = false
      useHardwareStore.getState().markInteracted()
    }
    controls.addEventListener('start', stop)
    return () => controls.removeEventListener('start', stop)
  }, [controlsRef])

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls) return
    const want = idle.current && !reducedMotion
    if (controls.autoRotate !== want) controls.autoRotate = want
    if (!want) return
    const a = controls.getAzimuthalAngle()
    if (a >= controls.maxAzimuthAngle - 0.01 && controls.autoRotateSpeed > 0) controls.autoRotateSpeed = -IDLE_ROTATE_SPEED
    if (a <= controls.minAzimuthAngle + 0.01 && controls.autoRotateSpeed < 0) controls.autoRotateSpeed = IDLE_ROTATE_SPEED
    invalidate()
  })
  return null
}

export function NodeScene({ inView, tier }: { inView: boolean; tier: DeviceTier }) {
  const full = tier === 'full'
  const reducedMotion = useHardwareStore((s) => s.reducedMotion)
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const handles = useMemo(createLabelHandles, [])

  useEffect(() => {
    if (!full) useHardwareStore.getState().setExplode(STATIC_EXPLODE)
  }, [full])

  return (
    <div className="absolute inset-0">
      <Canvas
        dpr={[1, 1.5]}
        frameloop={full ? 'demand' : 'never'}
        shadows="soft"
        camera={{ fov: CAMERA_FOV, near: 0.5, far: 60, position: REST_POSITION.toArray() }}
        gl={{
          antialias: false, alpha: false, powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05, outputColorSpace: THREE.SRGBColorSpace,
        }}
        fallback={<SchematicFallback />}
        style={{ touchAction: full ? 'none' : 'pan-y' }}
      >
        <color attach="background" args={[BG]} />
        <FrameloopController inView={inView} tier={tier} watchStore />
        <ViewOffset centerX={full ? MODEL_CENTER_X : 0.5} />
        <Rig />
        <NodeModel interactive={full} handles={handles} />
        <EffectComposer multisampling={4} enableNormalPass={false}>
          <N8AO aoRadius={0.4} intensity={1.2} quality="medium" />
          <Bloom intensity={0.2} luminanceThreshold={0.9} mipmapBlur />
          <Vignette eskil={false} offset={0.25} darkness={0.55} />
        </EffectComposer>
        {full && (
          <>
            <OrbitControls
              ref={controlsRef} makeDefault enablePan={false} enableZoom={false}
              minPolarAngle={REST_POLAR - POLAR_RANGE} maxPolarAngle={REST_POLAR + POLAR_RANGE}
              minAzimuthAngle={REST_AZIMUTH - AZIMUTH_RANGE} maxAzimuthAngle={REST_AZIMUTH + AZIMUTH_RANGE}
              enableDamping={!reducedMotion} dampingFactor={0.06}
              autoRotateSpeed={IDLE_ROTATE_SPEED} target={REST_TARGET.toArray()}
            />
            <ControlsReset controlsRef={controlsRef} />
            <IdleDrift controlsRef={controlsRef} />
          </>
        )}
      </Canvas>
      {full && <LabelOverlay handles={handles} interactive />}
    </div>
  )
}
