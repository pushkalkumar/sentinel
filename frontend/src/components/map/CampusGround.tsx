import { CAMPUS_PATHS as P } from './campusPaths'

/**
 * Real footprints for site 1 (Roosevelt High School, OpenStreetMap via shared/campus.geojson).
 * Every path string is baked at build time by scripts/build-campus-map.mjs, so this renders
 * a dozen static elements and no per-frame work. Solid strokes only (DESIGN_V2).
 */
const WHITE = (a: number) => `rgba(255,255,255,${a})`
const TURF = 'rgba(118,140,120,0.16)'
const TURF_LINE = (a: number) => `rgba(160,178,160,${a})`

export function CampusGround() {
  return (
    <g aria-hidden data-ground="campus">
      {/* neighbourhood: houses and lots, barely lighter than the ground */}
      <path d={P.neighbourhood} fill={WHITE(0.028)} fillRule="evenodd" />
      <path d={P.parking} fill={WHITE(0.018)} fillRule="evenodd" />
      {/* streets, sidewalks and service lanes as solid ribbons */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={P.roads.foot} stroke={WHITE(0.03)} strokeWidth={1} />
        <path d={P.roads.service} stroke={WHITE(0.05)} strokeWidth={2} />
        <path d={P.roads.minor} stroke={WHITE(0.06)} strokeWidth={4} />
        <path d={P.roads.major} stroke={WHITE(0.07)} strokeWidth={7} />
      </g>
      {/* school parcel */}
      <path d={P.parcel} fill={WHITE(0.012)} stroke={WHITE(0.10)} strokeWidth={1} strokeLinejoin="round" />
      <path d={P.campusParking} fill={WHITE(0.035)} fillRule="evenodd" />
      <path d={P.field} fill={TURF} stroke={TURF_LINE(0.22)} strokeWidth={1} />
      <path d={P.fieldLines} fill="none" stroke={TURF_LINE(0.10)} strokeWidth={1} />
      <path d={P.portables} fill="#1A1816" stroke={WHITE(0.08)} strokeWidth={1} />
      <path d={P.campusBuildings} fill="var(--color-raised)" stroke={WHITE(0.11)} strokeWidth={1} strokeLinejoin="round" />
      <text x={990} y={691} fontFamily="var(--font-sans)" fontSize={10} textAnchor="end" fill="var(--color-ink)" fillOpacity={0.35}>
        Map data © OpenStreetMap contributors
      </text>
    </g>
  )
}
