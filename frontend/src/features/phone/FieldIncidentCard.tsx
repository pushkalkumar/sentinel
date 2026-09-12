import { useState } from 'react'
import clsx from 'clsx'
import type { Incident, ResponderAction } from '@/lib/types'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'
import { TRUST_META } from '@/lib/bands'
import { errorText, postIncidentEvent } from '@/lib/api'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { useIncidentStore } from '@/store/incidents'
import { FieldButton } from './FieldButton'

export interface FieldIncidentCardProps {
  incident: Incident
}

const MIN_NOTE = 3

/** 88px-min card for /m/responder: code, type, count, node, trust, then Acknowledge and Resolve. */
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

  return (
    <article className="min-h-[88px] rounded-md border border-f-line bg-f-surface p-4 flex flex-col gap-3 font-field" aria-label={`Incident ${incident.code}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-field-mono text-[20px] font-bold text-f-ink tabular-nums">{incident.code}</h2>
        <time dateTime={incident.created_at} title={fmtWallZoned(incident.created_at)} className="font-field-mono text-[14px] text-f-ink-2 tabular-nums">
          {fmtWall(incident.created_at)}
        </time>
      </div>
      <p className="text-[18px] text-f-ink leading-snug">
        <span className="font-semibold">{INCIDENT_TYPE_LABEL[incident.type]}</span>
        {' · '}{incident.count} {incident.count === 1 ? 'person' : 'people'}
        <span className="block text-[16px] text-f-ink-2 mt-0.5">
          {incident.node_label ?? 'No node'} ·{' '}
          <span className={clsx('font-semibold', incident.trust_label === 'unverified' && 'font-normal')} style={{ color: incident.trust_label === 'verified' ? '#1F7A3A' : incident.trust_label === 'likely' ? '#8A5A00' : undefined }}>
            {trust.label}
          </span>
          {incident.status !== 'received' && <span> · {incident.status === 'en_route' ? 'En route' : 'Acknowledged'}</span>}
        </span>
        {incident.text && <span className="block text-[16px] text-f-ink-2 mt-1">{incident.text}</span>}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <FieldButton height={56} onClick={() => send('acknowledge', '')} disabled={!canAck || busy !== null} loading={busy === 'acknowledge'}>
          {canAck ? 'Acknowledge' : 'Acknowledged'}
        </FieldButton>
        <FieldButton height={56} variant="signal" onClick={() => setNoteOpen((o) => !o)} disabled={busy !== null} aria-expanded={noteOpen}>
          Resolve
        </FieldButton>
      </div>

      {noteOpen && (
        <div className="flex flex-col gap-2">
          <label className="block">
            <span className="block text-[16px] text-f-ink-2 mb-1.5">What happened? Required to resolve.</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 280))}
              rows={2}
              maxLength={280}
              placeholder="Two occupants out, no injuries"
              className="w-full rounded-sm bg-f-surface border border-f-line-strong text-f-ink placeholder:text-f-ink-2 px-4 py-3 outline-none font-field text-[18px] focus:border-f-signal resize-y"
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
