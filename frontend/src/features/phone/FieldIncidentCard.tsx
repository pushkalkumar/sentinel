import { useState } from 'react'
import clsx from 'clsx'
import type { Incident, ResponderAction } from '@/lib/types'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'
import { TRUST_META } from '@/lib/bands'
import { errorText, postIncidentEvent } from '@/lib/api'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { useIncidentStore } from '@/store/incidents'
import { FieldButton } from './FieldButton'
import { FIELD_INPUT, SLAB } from './surface'

export interface FieldIncidentCardProps {
  incident: Incident
}

const MIN_NOTE = 3

/** Muted trust colours for the light ground; unverified stays plain. */
const TRUST_COLOR: Record<Incident['trust_label'], string | undefined> = {
  verified: '#2E7D4A',
  likely: '#8A5A00',
  unverified: undefined,
}

/** Card for /m/responder: code, type, count, node, trust, then Acknowledge and Resolve. One ink button per card. */
export function FieldIncidentCard({ incident }: FieldIncidentCardProps) {
  const upsert = useIncidentStore((s) => s.upsert)
  const [noteOpen, setNoteOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<ResponderAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = async (action: ResponderAction, text: string) => {
    setBusy(action)
    setError(null)
    try {
      upsert(await postIncidentEvent(incident.code, { action, note: text }))
      if (action === 'resolve') {
        setNoteOpen(false)
        setNote('')
      }
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const canAck = incident.status === 'received'
  const trust = TRUST_META[incident.trust_label]
  const noteOk = note.trim().length >= MIN_NOTE
  const stage = incident.status === 'en_route' ? 'En route' : incident.status === 'acknowledged' ? 'Acknowledged' : null

  return (
    <article className={`${SLAB} p-4 flex flex-col gap-4 font-field`} aria-label={`Incident ${incident.code}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-field-mono text-[20px] font-semibold text-f-ink tabular-nums">{incident.code}</h2>
        <time dateTime={incident.created_at} title={fmtWallZoned(incident.created_at)} className="font-field-mono text-[14px] text-f-ink-2 tabular-nums">
          {fmtWall(incident.created_at)}
        </time>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-[19px] leading-snug text-f-ink">
          <span className="font-semibold">{INCIDENT_TYPE_LABEL[incident.type]}</span>
          <span className="text-f-ink-2">, {incident.count} {incident.count === 1 ? 'person' : 'people'}</span>
        </p>
        <p className="flex flex-wrap items-baseline gap-x-3 text-[15px] text-f-ink-2">
          <span>{incident.node_label ?? 'No node'}</span>
          <span className={clsx(incident.trust_label !== 'unverified' && 'font-medium')} style={{ color: TRUST_COLOR[incident.trust_label] }}>{trust.label}</span>
          {stage && <span>{stage}</span>}
        </p>
        {incident.text && <p className="text-[16px] leading-snug text-f-ink-2 mt-1 text-pretty">{incident.text}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <FieldButton height={56} variant={canAck ? 'ink' : 'surface'} onClick={() => send('acknowledge', '')} disabled={!canAck || busy !== null} loading={busy === 'acknowledge'}>
          {canAck ? 'Acknowledge' : 'Acknowledged'}
        </FieldButton>
        <FieldButton height={56} variant={canAck || noteOpen ? 'surface' : 'ink'} onClick={() => setNoteOpen((o) => !o)} disabled={busy !== null} aria-expanded={noteOpen}>
          {noteOpen ? 'Cancel' : 'Resolve'}
        </FieldButton>
      </div>

      {noteOpen && (
        <div className="flex flex-col gap-2.5">
          <label className="block">
            <span className="block text-[15px] text-f-ink-2 mb-2">What happened? Required to resolve.</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={2}
              maxLength={280}
              placeholder="Two occupants out, no injuries"
              className={`${FIELD_INPUT} py-3 resize-y bg-f-canvas`}
            />
          </label>
          <FieldButton height={56} variant="ink" onClick={() => send('resolve', note.trim())} disabled={!noteOk} loading={busy === 'resolve'}>
            Confirm resolve
          </FieldButton>
        </div>
      )}

      {error && <p className="text-[14px] text-f-alarm">{error}</p>}
    </article>
  )
}
