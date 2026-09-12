import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { ELEVATION, REST_THETA, TARGET, restPosition } from './cameraMath'

const AZIMUTH_RANGE = THREE.MathUtils.degToRad(15)
const POLAR_RANGE = THREE.MathUtils.degToRad(7)
/** 2° sweep over 20 s, then back (a 40 s sine). */
const DRIFT_AMPLITUDE = THREE.MathUtils.degToRad(1)
const DRIFT_PERIOD_S = 40

interface Props { distance: number; drift: boolean }

/** Locked-off orbit (no pan, no zoom, ±15° yaw) with a slow idle drift that stops for good on the first drag. */
export function CameraRig({ distance, drift }: Props) {
  const controls = useRef<OrbitControlsImpl | null>(null)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  const idle = useRef(true)
  const t0 = useRef<number | null>(null)
  const sph = useRef(new THREE.Spherical())

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

  useEffect(() => { if (drift) invalidate() }, [drift, invalidate])

  useFrame((state) => {
    if (!drift || !idle.current) return
    const now = state.clock.elapsedTime
    if (t0.current === null) t0.current = now
    const theta = REST_THETA + DRIFT_AMPLITUDE * Math.sin(((now - t0.current) / DRIFT_PERIOD_S) * Math.PI * 2)
    const s = sph.current
    s.setFromVector3(camera.position.clone().sub(TARGET))
    s.theta = theta
    camera.position.copy(TARGET).add(new THREE.Vector3().setFromSpherical(s))
    camera.lookAt(TARGET)
    state.invalidate()
  })

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
