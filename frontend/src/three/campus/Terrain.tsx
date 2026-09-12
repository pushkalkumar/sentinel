import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { EXTENT, GREENS, PARCEL, PARKING, PITCH, ROADS } from './geo'
import { closedLoop, flatPolygons, roadRibbons } from './geometry'
import { FIELD, FIELD_LINE, FOOTWAY, GROUND, PARCEL_LINE, PARKING as PARKING_COLOUR, ROAD } from './palette'

// Flat layers stack by a few millimetres and lean on polygonOffset so nothing z-fights with the ground.
const Y_LOT = 0.004
const Y_FIELD = 0.005
const Y_FOOTWAY = 0.007
const Y_ROAD = 0.009
const Y_LINE = 0.05

function Flat({ geometry, colour, y, offset }: { geometry: THREE.BufferGeometry | null; colour: string; y: number; offset: number }) {
  if (!geometry) return null
  return (
    <mesh geometry={geometry} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial color={colour} roughness={1} polygonOffset polygonOffsetFactor={-offset} polygonOffsetUnits={-offset} />
    </mesh>
  )
}

/** Ground plane, field, lots, roads and the two solid outlines (pitch, parcel). */
export function Terrain() {
  const lots = useMemo(() => flatPolygons([...PARKING, ...GREENS]), [])
  const field = useMemo(() => flatPolygons(PITCH ? [PITCH] : []), [])
  const roads = useMemo(() => roadRibbons(ROADS.filter((r) => r.major)), [])
  const paths = useMemo(() => roadRibbons(ROADS.filter((r) => !r.major)), [])
  const size = EXTENT * 6

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color={GROUND} roughness={1} />
      </mesh>
      <Flat geometry={lots} colour={PARKING_COLOUR} y={Y_LOT} offset={1} />
      <Flat geometry={field} colour={FIELD} y={Y_FIELD} offset={2} />
      <Flat geometry={paths} colour={FOOTWAY} y={Y_FOOTWAY} offset={3} />
      <Flat geometry={roads} colour={ROAD} y={Y_ROAD} offset={4} />
      {PITCH && <Line points={closedLoop(PITCH, Y_LINE)} color={FIELD_LINE} lineWidth={1.25} transparent opacity={0.9} depthWrite={false} />}
      {PARCEL && <Line points={closedLoop(PARCEL, Y_LINE)} color={PARCEL_LINE} lineWidth={1.25} transparent opacity={0.3} depthWrite={false} />}
    </group>
  )
}
