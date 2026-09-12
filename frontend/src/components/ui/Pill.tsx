import clsx from 'clsx'
import type { CSSProperties } from 'react'
import type { BandKey, IncidentStatus, NodeStatus, TrustLabel, AlertKind } from '@/lib/types'
import { ALERT_META, BAND_META, NODE_STATUS_META, STATUS_META, TRUST_META, type PillMeta } from '@/lib/bands'

export type PillKind = 'trust' | 'band' | 'incident' | 'node' | 'alert' | 'code'

export interface PillProps {
  kind: PillKind
  /** The enum value for the kind (e.g. 'verified', 'usg', 'en_route'); free text for `code`. */
  value: string
  dot?: boolean
  className?: string
  title?: string
}

interface Resolved { label: string; color: string; bg: string; text: string; hollow: boolean; pulse: boolean; noFill: boolean }

function resolve(kind: PillKind, value: string): Resolved {
  const fromMeta = (m: PillMeta, noFill = false, pulse = false): Resolved => ({
    label: m.label, color: m.color, bg: noFill ? 'transparent' : m.dimColor, text: m.color, hollow: m.hollow, pulse, noFill,
  })
  switch (kind) {
    case 'trust':
      return fromMeta(TRUST_META[value as TrustLabel] ?? TRUST_META.unverified)
    case 'incident':
      return fromMeta(STATUS_META[value as IncidentStatus] ?? STATUS_META.received)
    case 'node': {
      const m = NODE_STATUS_META[value as NodeStatus] ?? NODE_STATUS_META.offline
      return fromMeta(m, true, m.pulse)
    }
    case 'alert': {
      const m = ALERT_META[value as AlertKind]
      return m
        ? { label: m.label, color: m.color, bg: m.dimColor, text: m.color, hollow: false, pulse: false, noFill: false }
        : { label: value, color: '#6F6A62', bg: 'transparent', text: '#A9A39A', hollow: true, pulse: false, noFill: true }
    }
    case 'band': {
      const m = BAND_META[value as BandKey]
      if (!m) return { label: value, color: '#6F6A62', bg: 'transparent', text: '#A9A39A', hollow: true, pulse: false, noFill: true }
      // DESIGN §6.2: Unhealthy and up are solid fills with the text colour from §3.3.
      return m.solidPill
        ? { label: m.label, color: m.inkOnSolid, bg: m.color, text: m.inkOnSolid, hollow: false, pulse: false, noFill: false }
        : { label: m.label, color: m.color, bg: `${m.color}24`, text: m.color, hollow: false, pulse: false, noFill: false }
    }
    case 'code':
      return { label: value, color: '#A9A39A', bg: 'transparent', text: '#F2EEE8', hollow: false, pulse: false, noFill: true }
  }
}

export function Pill({ kind, value, dot = true, className, title }: PillProps) {
  const r = resolve(kind, value)
  if (kind === 'code') {
    return (
      <span title={title} className={clsx('inline-flex items-center h-[22px] rounded-sm hairline px-1.5 font-mono text-xs text-ink', className)}>
        {value}
      </span>
    )
  }
  const style: CSSProperties = { background: r.bg, color: r.text }
  const dotStyle: CSSProperties = r.hollow
    ? { boxShadow: `inset 0 0 0 1.5px ${r.color}`, background: 'transparent' }
    : { background: r.color }
  return (
    <span
      title={title ?? (kind === 'band' ? BAND_META[value as BandKey]?.epaName : undefined)}
      className={clsx('inline-flex items-center gap-1.5 h-[22px] rounded-full text-xs font-medium whitespace-nowrap', dot ? 'pl-1.5 pr-2' : 'px-2', className)}
      style={style}
    >
      {dot && <i aria-hidden className={clsx('size-1.5 rounded-full shrink-0', r.pulse && 'pulse-live')} style={dotStyle} />}
      {r.label}
    </span>
  )
}
