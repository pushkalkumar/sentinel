import { useMemo } from 'react'
import * as THREE from 'three'
import { EXTENT, GREENS, PARCEL, PARKING, PITCH, ROADS } from './geo'
import { flatPolygons, outlineRibbons, roadRibbons } from './geometry'
import { FIELD, FIELD_LINE, FOOTWAY, GROUND, PARCEL_LINE, PARKING as PARKING_COLOUR, ROAD } from './palette'

// Flat layers stack by a few millimetres and lean on polygonOffset so nothing z-fights with the ground.
const Y_LOT = 0.004
const Y_FIELD = 0.005
const Y_FOOTWAY = 0.007
const Y_ROAD = 0.009
const Y_LINE = 0.09
/** Pulled in front of every flat layer (roads reach -4) so a path running beside the pitch cannot stipple the outline. */
const LINE_OFFSET = 8
/** Outline widths in world units (1 unit = 10 m), wide enough to rasterise as a continuous strip. */
const PITCH_LINE_W = 0.13
const PARCEL_LINE_W = 0.11

function Flat({ geometry, colour, y, offset }: { geometry: THREE.BufferGeometry | null; colour: string; y: number; offset: number }) {
  if (!geometry) return null
  return (
    <mesh geometry={geometry} position={[0, y, 0]} receiveShadow>
      <meshStandardMaterial color={colour} roughness={1} polygonOffset polygonOffsetFactor={-offset} polygonOffsetUnits={-offset} />
    </mesh>
  )
}

function Outline({ geometry, colour, opacity }: { geometry: THREE.BufferGeometry | null; colour: string; opacity: number }) {
  if (!geometry) return null
  return (
    <mesh geometry={geometry} position={[0, Y_LINE, 0]} renderOrder={2}>
      <meshBasicMaterial
        color={colour} transparent opacity={opacity} depthWrite={false} toneMapped={false} side={THREE.DoubleSide}
        polygonOffset polygonOffsetFactor={-LINE_OFFSET} polygonOffsetUnits={-LINE_OFFSET}
      />
    </mesh>
  )
}

/** Ground plane, field, lots, roads and the two solid outlines (pitch, parcel). */
export function Terrain() {
  const lots = useMemo(() => flatPolygons([...PARKING, ...GREENS]), [])
  const field = useMemo(() => flatPolygons(PITCH ? [PITCH] : []), [])
  const roads = useMemo(() => roadRibbons(ROADS.filter((r) => r.major)), [])
  const paths = useMemo(() => roadRibbons(ROADS.filter((r) => !r.major)), [])
  const pitchLine = useMemo(() => outlineRibbons(PITCH ? [PITCH] : [], PITCH_LINE_W), [])
  const parcelLine = useMemo(() => outlineRibbons(PARCEL ? [PARCEL] : [], PARCEL_LINE_W), [])
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
      <Outline geometry={pitchLine} colour={FIELD_LINE} opacity={0.9} />
      <Outline geometry={parcelLine} colour={PARCEL_LINE} opacity={0.34} />
    </group>
  )
}
