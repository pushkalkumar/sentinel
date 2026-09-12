import { useState } from 'react'
import clsx from 'clsx'
import { Check, Flag, GitMerge, Navigation, Radio } from 'lucide-react'
import type { Incident, IncidentEvent, ResponderAction } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fmtWall, fmtWallZoned } from '@/lib/time'

export interface ActionsRailProps {
  incident: Incident
  /** Responder only. Admins can read the page but only send messages. */
  canAct: boolean
  /** Open priority ≤ 2 alert at the incident's node; null disables Draft WEA. */
  weaAlertId: number | null
  onAction: (action: ResponderAction, note: string) => Promise<void>
  onDraftWea: (alertId: number) => void
  currentUserId: number | null
  className?: string
}

const MIN_NOTE = 3
const WEA_DISABLED_TIP = 'Offered when a fire or hazardous-smoke alert is open at this node'

function closingEvent(inc: Incident): IncidentEvent | null {
  for (let i = inc.events.length - 1; i >= 0; i -= 1) {
    const e = inc.events[i]
    if (e.action === 'resolve' || e.action === 'flag_false') return e
  }
  return null
}

/** DESIGN §8.6 actions rail. Resolve is the only green button in the product. */
export function ActionsRail({ incident: inc, canAct, weaAlertId, onAction, onDraftWea, currentUserId, className }: ActionsRailProps) {
  const [note, setNote] = useState('')
  const [flagNote, setFlagNote] = useState('')
  const [flagging, setFlagging] = useState(false)
  const [busy, setBusy] = useState<ResponderAction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const closed = inc.status === 'resolved' || inc.status === 'false'
  const closing = closingEvent(inc)

  if (closed && closing) {
    const mine = currentUserId !== null && closing.actor_user_id === currentUserId
    const who = mine ? 'you' : (closing.actor_name ?? 'a responder')
    const verb = closing.action === 'resolve' ? 'Resolved' : 'Flagged false'
    return (
      <p className={clsx('text-sm text-ink-2', className)}>
        {verb} by {who} at{' '}
        <time dateTime={closing.at} title={fmtWallZoned(closing.at)} className="font-mono text-xs">{fmtWall(closing.at)}</time>.
        {' '}This cannot be undone.
      </p>
    )
  }

  const run = async (action: ResponderAction, text: string) => {
    if (busy) return
    setBusy(action)
    setError(null)
    try {
      await onAction(action, text)
      if (action === 'flag_false') { setFlagNote(''); setFlagging(false) }
      if (action === 'resolve') setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That action did not go through. Try again.')
    } finally {
      setBusy(null)
    }
  }

  const canAck = canAct && inc.status === 'received'
  const canEnRoute = canAct && (inc.status === 'received' || inc.status === 'acknowledged')
  const noteOk = note.trim().length >= MIN_NOTE
  const flagOk = flagNote.trim().length >= MIN_NOTE

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      {!canAct && (
        <p className="text-sm text-ink-3">Only a responder can change the status. You can still message the reporter.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button icon={Check} disabled={!canAck} loading={busy === 'acknowledge'} onClick={() => run('acknowledge', '')}
          title={inc.status !== 'received' ? 'Already acknowledged' : undefined}>
          Acknowledge
        </Button>
        <Button icon={Navigation} disabled={!canEnRoute} loading={busy === 'en_route'} onClick={() => run('en_route', '')}
          title={inc.status === 'en_route' ? 'Already en route' : undefined}>
          En route
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Input
          aria-label="Resolution note"
          placeholder="Resolution note, one line. Required."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={!canAct || busy !== null}
          maxLength={280}
          onKeyDown={(e) => { if (e.key === 'Enter' && noteOk) { e.preventDefault(); void run('resolve', note.trim()) } }}
        />
        <Button
          variant="resolve"
          icon={Check}
          disabled={!canAct || !noteOk}
          loading={busy === 'resolve'}
          onClick={() => run('resolve', note.trim())}
          title={noteOk ? 'Resolve and lock this incident' : `Write a note of at least ${MIN_NOTE} characters to resolve`}
          className="self-start"
        >
          Resolve
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-line">
        <Button variant="danger" icon={Flag} disabled={!canAct} onClick={() => setFlagging((v) => !v)} aria-expanded={flagging}>
          Flag as false
        </Button>
        <Button variant="ghost" icon={GitMerge} disabled title="Merge duplicates is not in the demo" aria-disabled>
          Merge
        </Button>
        <Button
          variant="secondary"
          icon={Radio}
          disabled={weaAlertId === null}
          onClick={() => { if (weaAlertId !== null) onDraftWea(weaAlertId) }}
          title={weaAlertId === null ? WEA_DISABLED_TIP : 'Draft a wireless emergency alert from the open alert at this node'}
        >
          Draft WEA
        </Button>
      </div>

      {flagging && canAct && (
        <div className="flex flex-col gap-2 p-3 rounded-sm bg-raised hairline">
          <Input
            aria-label="Reason for flagging as false"
            label="Why is this false?"
            placeholder="Reason, required. Feeds the device history."
            value={flagNote}
            onChange={(e) => setFlagNote(e.target.value)}
            maxLength={280}
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="danger" disabled={!flagOk} loading={busy === 'flag_false'} onClick={() => run('flag_false', flagNote.trim())}>
              Confirm false report
            </Button>
            <Button variant="ghost" onClick={() => { setFlagging(false); setFlagNote('') }}>Cancel</Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-alarm" role="alert">{error}</p>}
    </div>
  )
}
