// Band, alert, trust, status metadata. Colours are DESIGN §3 hex values; headlines are DESIGN §6.7's six strings.
import { BAND_ORDER, type AlertKind, type BandKey, type IncidentStatus, type NodeStatus, type TrustLabel } from './types'

export interface BandMeta {
  label: string
  shortLabel: string
  /** Full EPA name (tooltip). */
  epaName: string
  color: string
  /** Tailwind class for the 14% tint, e.g. `bg-band-usg-dim`. */
  dimClass: string
  /** Tailwind class for the solid, e.g. `bg-band-usg`. */
  solidClass: string
  /** Tailwind text class for the solid colour. */
  textClass: string
  /** Unhealthy and up render as a solid pill, never as tinted text. */
  solidPill: boolean
  /** Text colour to use on the solid fill. */
  inkOnSolid: string
  /** Upper PM2.5 bound inclusive; null for the open-ended top band. */
  max: number | null
  headline: string
  guidance: string
}

export const BAND_META: Record<BandKey, BandMeta> = {
  good: {
    label: 'Good', shortLabel: 'Good', epaName: 'Good',
    color: '#5AD46E', dimClass: 'bg-band-good-dim', solidClass: 'bg-band-good', textClass: 'text-band-good',
    solidPill: false, inkOnSolid: '#0A0908', max: 9.0,
    headline: 'Outdoor practice: OK', guidance: 'All outdoor activity as scheduled',
  },
  moderate: {
    label: 'Moderate', shortLabel: 'Moderate', epaName: 'Moderate',
    color: '#F2D94E', dimClass: 'bg-band-moderate-dim', solidClass: 'bg-band-moderate', textClass: 'text-band-moderate',
    solidPill: false, inkOnSolid: '#0A0908', max: 35.4,
    headline: 'Outdoor practice: OK, watch sensitive students', guidance: 'Outdoor activity OK; watch students with asthma',
  },
  usg: {
    label: 'Sensitive groups', shortLabel: 'Sensitive', epaName: 'Unhealthy for sensitive groups',
    color: '#FF9A3C', dimClass: 'bg-band-usg-dim', solidClass: 'bg-band-usg', textClass: 'text-band-usg',
    solidPill: false, inkOnSolid: '#0A0908', max: 55.4,
    headline: 'Sensitive groups indoors', guidance: 'Sensitive students indoors; shorten outdoor PE',
  },
  unhealthy: {
    label: 'Unhealthy', shortLabel: 'Unhealthy', epaName: 'Unhealthy',
    color: '#FF4A3D', dimClass: 'bg-band-unhealthy-dim', solidClass: 'bg-band-unhealthy', textClass: 'text-band-unhealthy',
    solidPill: true, inkOnSolid: '#F2EEE8', max: 125.4,
    headline: 'Cancel outdoor practice', guidance: 'Cancel outdoor practice and recess; PE indoors',
  },
  very_unhealthy: {
    label: 'Very unhealthy', shortLabel: 'V. unhealthy', epaName: 'Very unhealthy',
    color: '#B98BF0', dimClass: 'bg-band-veryunhealthy-dim', solidClass: 'bg-band-veryunhealthy', textClass: 'text-band-veryunhealthy',
    solidPill: true, inkOnSolid: '#0A0908', max: 225.4,
    headline: 'All outdoor activity cancelled', guidance: 'All outdoor activity cancelled; keep windows closed',
  },
  hazardous: {
    label: 'Hazardous', shortLabel: 'Hazardous', epaName: 'Hazardous',
    color: '#D94A62', dimClass: 'bg-band-hazardous-dim', solidClass: 'bg-band-hazardous', textClass: 'text-ink',
    solidPill: true, inkOnSolid: '#F2EEE8', max: null,
    headline: 'Shelter indoors', guidance: 'Shelter indoors; consider early dismissal',
  },
}

export function bandOf(pm25: number): BandKey {
  for (const key of BAND_ORDER) {
    const max = BAND_META[key].max
    if (max === null || pm25 <= max) return key
  }
  return 'hazardous'
}

export function bandIndex(key: BandKey): number {
  return BAND_ORDER.indexOf(key)
}

export function worseBand(a: BandKey | null, b: BandKey | null): BandKey | null {
  if (!a) return b
  if (!b) return a
  return bandIndex(a) >= bandIndex(b) ? a : b
}

export interface AlertMeta { label: string; color: string; dimColor: string; priority: 1 | 2 | 3 | 4 }

export const ALERT_META: Record<AlertKind, AlertMeta> = {
  LOCAL_FIRE: { label: 'Fire at node', color: '#FF4A3D', dimColor: 'rgba(255,74,61,0.14)', priority: 1 },
  HAZARDOUS_SMOKE: { label: 'Hazardous smoke', color: '#D94A62', dimColor: 'rgba(217,74,98,0.16)', priority: 2 },
  LOCAL_SMOKE_SUSPECT: { label: 'Local smoke suspected', color: '#FFB224', dimColor: 'rgba(255,178,36,0.14)', priority: 3 },
  ACTIVITY_ADVISORY: { label: 'Activity advisory', color: '#46D2E4', dimColor: 'rgba(70,210,228,0.12)', priority: 4 },
}

export interface PillMeta { label: string; color: string; dimColor: string; hollow: boolean }

export const TRUST_META: Record<TrustLabel, PillMeta> = {
  verified: { label: 'Verified', color: '#5AD46E', dimColor: 'rgba(90,212,110,0.14)', hollow: false },
  likely: { label: 'Likely', color: '#FFB224', dimColor: 'rgba(255,178,36,0.14)', hollow: false },
  unverified: { label: 'Unverified', color: '#6F6A62', dimColor: 'rgba(255,255,255,0.045)', hollow: true },
}

export const STATUS_META: Record<IncidentStatus, PillMeta> = {
  received: { label: 'Received', color: '#A9A39A', dimColor: 'rgba(255,255,255,0.045)', hollow: true },
  acknowledged: { label: 'Acknowledged', color: '#46D2E4', dimColor: 'rgba(70,210,228,0.12)', hollow: false },
  en_route: { label: 'En route', color: '#FFB224', dimColor: 'rgba(255,178,36,0.14)', hollow: false },
  resolved: { label: 'Resolved', color: '#5AD46E', dimColor: 'rgba(90,212,110,0.14)', hollow: false },
  false: { label: 'Flagged false', color: '#FF4A3D', dimColor: 'rgba(255,74,61,0.14)', hollow: false },
  queued: { label: 'Queued', color: '#6F6A62', dimColor: 'rgba(255,255,255,0.045)', hollow: true },
}

export const NODE_STATUS_META: Record<NodeStatus, PillMeta & { pulse: boolean }> = {
  ok: { label: 'Online', color: '#5AD46E', dimColor: 'transparent', hollow: false, pulse: false },
  watch: { label: 'Watch', color: '#FFB224', dimColor: 'transparent', hollow: false, pulse: false },
  alert: { label: 'Alerting', color: '#FF4A3D', dimColor: 'transparent', hollow: false, pulse: true },
  offline: { label: 'Offline', color: '#46423D', dimColor: 'transparent', hollow: true, pulse: false },
}

export const PRIORITY_COLOR: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#FF4A3D', 2: '#D94A62', 3: '#FFB224', 4: '#46D2E4', 5: '#6F6A62',
}
