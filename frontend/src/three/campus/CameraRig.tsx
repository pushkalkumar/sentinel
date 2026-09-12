import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { ELEVATION, REST_THETA, TARGET, restPosition } from './cameraMath'

const AZIMUTH_RANGE = THREE.MathUtils.degToRad(15)
const POLAR_RANGE = THREE.MathUtils.degToRad(7)
/** 2° sweep over 20 s, then back (a 40 s sine). */
const DRIFT_AMPLITUDE = THREE.MathUtils.degToRad(1)
const DRIFT_PERIOD_MS = 40_000
/** A 1°/20 s sweep needs nothing like 60 fps; the frames saved belong to the rest of the page. */
const DRIFT_STEP_MS = 1000 / 24

interface Props { distance: number; drift: boolean }

/** Locked-off orbit (no pan, no zoom, ±15° yaw) with a slow idle drift that stops for good on the first drag. */
export function CameraRig({ distance, drift }: Props) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const idle = useRef(true)

  useEffect(() => {
    camera.position.copy(restPosition(distance))
    camera.lookAt(TARGET)
    controls.current?.update()
    invalidate()
  }, [camera, distance, invalidate])

  useEffect(() => {
    const c = controls.current
    if (!c) return
    const stop = () => { idle.current = false }
    c.addEventListener('start', stop)
    return () => c.removeEventListener('start', stop)
  }, [])

  // Timer-driven rather than per-frame: a demand loop then renders 24 drift frames a second, not 60.
  useEffect(() => {
    if (!drift) return
    const t0 = performance.now()
    const sph = new THREE.Spherical()
    const offset = new THREE.Vector3()
    let timer = 0
    const step = () => {
      if (!idle.current) return
      sph.setFromVector3(offset.copy(camera.position).sub(TARGET))
      sph.theta = REST_THETA + DRIFT_AMPLITUDE * Math.sin(((performance.now() - t0) / DRIFT_PERIOD_MS) * Math.PI * 2)
      camera.position.copy(TARGET).add(offset.setFromSpherical(sph))
      camera.lookAt(TARGET)
      invalidate()
      timer = window.setTimeout(step, DRIFT_STEP_MS)
    }
    timer = window.setTimeout(step, DRIFT_STEP_MS)
    return () => window.clearTimeout(timer)
  }, [drift, camera, invalidate])

  return (
    <OrbitControls
      ref={controls} makeDefault enablePan={false} enableZoom={false}
      target={TARGET.toArray()}
      minAzimuthAngle={REST_THETA - AZIMUTH_RANGE} maxAzimuthAngle={REST_THETA + AZIMUTH_RANGE}
      minPolarAngle={Math.PI / 2 - ELEVATION - POLAR_RANGE} maxPolarAngle={Math.PI / 2 - ELEVATION + POLAR_RANGE}
      enableDamping dampingFactor={0.08} rotateSpeed={0.4}
    />
  )
}
