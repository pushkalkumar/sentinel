import clsx from 'clsx'
import type { Incident } from '@/lib/types'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'
import { STATUS_META } from '@/lib/bands'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { Pill } from '@/components/ui/Pill'

export interface QueueRowProps {
  incident: Incident
  selected: boolean
  siteName?: string | null
  onSelect: () => void
  onOpen: () => void
}

/** Who last touched the incident, for the second line. */
function lastActor(inc: Incident): string | null {
  for (let i = inc.events.length - 1; i >= 0; i -= 1) {
    const e = inc.events[i]
    if (e.action !== 'created' && e.action !== 'relayed' && e.actor_name) return e.actor_name
  }
  return null
}

/** DESIGN_V2 §4: two quiet lines. Code, what, where, trust, time. Alarm dot only on priority 1. */
export function QueueRow({ incident: inc, selected, onSelect, onOpen }: QueueRowProps) {
  const where = inc.via === 'internet' ? 'Internet only' : (inc.node_label ?? inc.node_id ?? 'Unknown node')
  const actor = lastActor(inc)
  const status = STATUS_META[inc.status]
  const count = inc.type !== 'safe' ? `, ${inc.count} ${inc.count === 1 ? 'person' : 'people'}` : ''
  return (
    <div
      role="option"
      aria-selected={selected}
      data-code={inc.code}
      tabIndex={-1}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={clsx(
        'group relative min-h-16 px-5 py-3 flex flex-col justify-center gap-1 cursor-pointer outline-none',
        'transition-[background-color] duration-[120ms]',
        selected ? 'bg-accent-dim shadow-[inset_2px_0_0_var(--color-accent)]' : 'hover:bg-raised',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {inc.priority === 1 && <i aria-hidden className="size-1.5 rounded-full bg-alarm shrink-0" />}
        <span className="font-mono text-sm text-ink">{inc.code}</span>
        <span className="text-sm text-ink truncate">{INCIDENT_TYPE_LABEL[inc.type]}<span className="text-ink-2">{count}</span></span>
        <Pill kind="trust" value={inc.trust_label} className="ml-auto shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 min-w-0 text-xs text-ink-3">
        <span className="truncate">
          {where}, <span style={{ color: status.color }}>{status.label.toLowerCase()}</span>
          {actor && ` by ${actor}`}
        </span>
        <time className="ml-auto shrink-0 font-mono tabular-nums" dateTime={inc.created_at} title={fmtWallZoned(inc.created_at)}>{fmtWall(inc.created_at, 'HH:mm:ss')}</time>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onOpen() }}
          className={clsx(
            'shrink-0 text-xs text-ink-2 hover:text-ink underline underline-offset-2 decoration-line-strong',
            'transition-opacity duration-[120ms]',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        >
          Open
        </button>
      </div>
    </div>
  )
}
