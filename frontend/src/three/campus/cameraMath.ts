import * as THREE from 'three'
import { PARCEL } from './geo'

/** Campus centre in world units (main building sits at ~(6.6, -7.1), parcel at the origin). */
export const TARGET = new THREE.Vector3(3.2, 0.2, -3.4)
export const FOV = 22
export const ELEVATION = THREE.MathUtils.degToRad(37)
/** From the south-west: -x is west, +z is south. */
export const REST_THETA = -Math.PI / 4

/** Air around the school parcel once it is framed: 1.0 would crop it to the panel edge. */
const MARGIN = 1.35
const COMPACT_MARGIN = 1.12
const MIN_DISTANCE = 44
const MAX_DISTANCE = 140
const FALLBACK_HALF = { w: 15, h: 8.8 }

/** Camera direction is fixed by the rest angles, so the screen axes can be derived once. */
const VIEW = (() => {
  const dir = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, Math.PI / 2 - ELEVATION, REST_THETA))
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize()
  const up = new THREE.Vector3().crossVectors(dir, right).normalize()
  return { right, up }
})()

/** Half the parcel's on-screen extent, in world units, along each screen axis. */
const HALF = (() => {
  if (!PARCEL || PARCEL.length < 3) return FALLBACK_HALF
  const v = new THREE.Vector3()
  let w = 0
  let h = 0
  for (const [x, z] of PARCEL) {
    v.set(x - TARGET.x, -TARGET.y, z - TARGET.z)
    w = Math.max(w, Math.abs(v.dot(VIEW.right)))
    h = Math.max(h, Math.abs(v.dot(VIEW.up)))
  }
  return { w, h }
})()

/**
 * Distance that frames the whole school parcel in the panel it was given. The field of view is
 * vertical, so a narrow container is width-limited and has to sit further back than a wide one.
 */
export function distanceFor(compact: boolean, aspect = 1.6): number {
  const tan = Math.tan(THREE.MathUtils.degToRad(FOV) / 2)
  const byHeight = HALF.h / tan
  const byWidth = HALF.w / (tan * Math.max(0.25, aspect))
  const fit = (compact ? COMPACT_MARGIN : MARGIN) * Math.max(byHeight, byWidth)
  return THREE.MathUtils.clamp(fit, MIN_DISTANCE, MAX_DISTANCE)
}

export function restPosition(distance: number): THREE.Vector3 {
  const sph = new THREE.Spherical(distance, Math.PI / 2 - ELEVATION, REST_THETA)
  return TARGET.clone().add(new THREE.Vector3().setFromSpherical(sph))
}
