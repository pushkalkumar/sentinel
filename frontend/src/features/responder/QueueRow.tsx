import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
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

/** Who last touched the incident, for the third line. */
function lastActor(inc: Incident): string | null {
  for (let i = inc.events.length - 1; i >= 0; i -= 1) {
    const e = inc.events[i]
    if (e.action !== 'created' && e.action !== 'relayed' && e.actor_name) return e.actor_name
  }
  return null
}

/** DESIGN §8.5: 72px, three lines; priority by order and type word, alarm dot only on priority 1. */
export function QueueRow({ incident: inc, selected, siteName, onSelect, onOpen }: QueueRowProps) {
  const where = inc.via === 'internet' ? 'internet only' : (inc.node_label ?? inc.node_id ?? 'unknown node')
  const actor = lastActor(inc)
  const status = STATUS_META[inc.status]
  return (
    <div
      role="option"
      aria-selected={selected}
      data-code={inc.code}
      tabIndex={-1}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={clsx(
        'group relative h-[72px] px-4 flex items-center gap-3 border-b border-line cursor-pointer outline-none',
        'transition-[background-color] duration-[120ms]',
        selected ? 'bg-signal-dim shadow-[inset_2px_0_0_var(--color-signal)]' : 'hover:bg-raised',
      )}
    >
      <div className="min-w-0 flex-1 flex flex-col gap-0.5 leading-[18px]">
        <div className="flex items-center gap-2 min-w-0">
          {inc.priority === 1 && <i aria-hidden className="size-1.5 rounded-full bg-alarm shrink-0" />}
          <span className="font-mono text-sm text-ink">{inc.code}</span>
          <span className="text-sm text-ink truncate">
            {INCIDENT_TYPE_LABEL[inc.type]}
            {inc.type !== 'safe' && <span className="text-ink-2"> · {inc.count} {inc.count === 1 ? 'person' : 'people'}</span>}
          </span>
        </div>
        <div className="flex items-center gap-2 min-w-0 text-sm text-ink-2">
          <span className="truncate">
            {where}
            {siteName && inc.via === 'node' && <span className="text-ink-3"> · {siteName}</span>}
          </span>
          <Pill kind="trust" value={inc.trust_label} className="shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 min-w-0 font-mono text-xs text-ink-3">
          <time dateTime={inc.created_at} title={fmtWallZoned(inc.created_at)}>{fmtWall(inc.created_at, 'HH:mm:ss')}</time>
          <span>·</span>
          <span style={{ color: status.color }}>{status.label}</span>
          {actor && <><span>·</span><span className="truncate text-ink-2">{actor}</span></>}
        </div>
      </div>
      <button
        type="button"
        tabIndex={-1}
        onClick={(e) => { e.stopPropagation(); onOpen() }}
        aria-label={`Open ${inc.code}`}
        title="Open incident"
        className={clsx(
          'shrink-0 size-8 inline-flex items-center justify-center rounded-sm text-ink-3 hover:text-ink hover:bg-[rgba(255,255,255,0.04)]',
          'transition-[color,background-color] duration-[120ms]',
          selected ? 'text-ink-2' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      >
        <ChevronRight size={16} strokeWidth={1.5} />
      </button>
    </div>
  )
}
