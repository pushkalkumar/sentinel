import { useMemo } from 'react'
import { CAMPUS_BUILDINGS, NEIGHBOURHOOD_BUILDINGS } from './geo'
import { extrudeFootprints } from './geometry'
import { CAMPUS_BUILDING, HOUSE } from './palette'

/** Two merged extrusions: the school (lighter, sharper) and the 700-odd houses around it (dim, low). */
export function Buildings() {
  const campus = useMemo(() => extrudeFootprints(CAMPUS_BUILDINGS), [])
  const houses = useMemo(() => extrudeFootprints(NEIGHBOURHOOD_BUILDINGS), [])
  return (
    <group>
      {campus && (
        <mesh geometry={campus} castShadow receiveShadow>
          <meshStandardMaterial color={CAMPUS_BUILDING} roughness={0.82} metalness={0.02} />
        </mesh>
      )}
      {houses && (
        <mesh geometry={houses} castShadow receiveShadow>
          <meshStandardMaterial color={HOUSE} roughness={0.95} />
        </mesh>
      )}
    </group>
  )
}
