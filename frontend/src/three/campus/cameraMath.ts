import * as THREE from 'three'

/** Campus centre in world units (main building sits at ~(6.6, -7.1), parcel at the origin). */
export const TARGET = new THREE.Vector3(3.2, 0.2, -3.4)
export const FOV = 22
export const ELEVATION = THREE.MathUtils.degToRad(37)
/** From the south-west: -x is west, +z is south. */
export const REST_THETA = -Math.PI / 4

export const distanceFor = (compact: boolean) => (compact ? 60 : 82)

export function restPosition(distance: number): THREE.Vector3 {
  const sph = new THREE.Spherical(distance, Math.PI / 2 - ELEVATION, REST_THETA)
  return TARGET.clone().add(new THREE.Vector3().setFromSpherical(sph))
}
