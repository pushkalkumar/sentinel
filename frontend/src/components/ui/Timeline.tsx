import clsx from 'clsx'
import type { IncidentAction, IncidentEvent, IncidentPublic } from '@/lib/types'
import { fmtWall, fmtWallZoned } from '@/lib/time'

type PublicEvent = IncidentPublic['timeline'][number]

export interface TimelineProps {
  events: IncidentEvent[] | PublicEvent[]
  newestFirst?: boolean
  ground?: 'dark' | 'light'
  className?: string
}

const ACTION_LABEL: Record<IncidentAction, string> = {
  created: 'Received', relayed: 'Relayed', acknowledge: 'Acknowledged', en_route: 'En route',
  resolve: 'Resolved', flag_false: 'Flagged false', message: 'Message',
}

const ACTION_COLOR: Record<IncidentAction, string> = {
  created: '#A29C93', relayed: '#7F9FA0', acknowledge: '#7F9FA0', en_route: '#D9A441',
  resolve: '#6DB87A', flag_false: '#E0574B', message: '#A29C93',
}

function isFull(e: IncidentEvent | PublicEvent): e is IncidentEvent {
  return 'id' in e
}

/** DESIGN §6.10: vertical hairline at 11px, 6px dots coloured by action, mono timestamps. */
export function Timeline({ events, newestFirst = false, ground = 'dark', className }: TimelineProps) {
  const list = newestFirst ? [...events].reverse() : events
  const light = ground === 'light'
  return (
    <ol className={clsx('relative pl-7', className)}>
      <i aria-hidden className={clsx('absolute left-[11px] top-1 bottom-1 w-px', light ? 'bg-f-line' : 'bg-line')} />
      {list.map((e, i) => {
        const full = isFull(e)
        const isMsg = e.action === 'message'
        const actor = full ? e.actor_name ?? (e.actor_role === 'system' ? null : e.actor_role) : null
        return (
          <li key={full ? e.id : `${e.action}-${i}`} className="relative py-1.5 min-w-0">
            <i
              aria-hidden
              className="absolute top-[11px] size-1.5 rounded-full"
              style={{ left: '-19px', background: ACTION_COLOR[e.action] }}
            />
            <div className={clsx('flex items-baseline gap-3 min-w-0', light && 'font-field')}>
              <time
                dateTime={e.at}
                title={fmtWallZoned(e.at)}
                className={clsx('shrink-0 tabular-nums', light ? 'font-field-mono text-[14px] text-f-ink-2' : 'font-mono text-xs text-ink-3')}
              >
                {fmtWall(e.at, 'HH:mm:ss')}
              </time>
              {isMsg ? (
                <blockquote className={clsx('rounded-sm px-3 py-2 min-w-0', light ? 'bg-f-canvas text-f-ink text-[16px]' : 'bg-raised text-ink text-sm')}>
                  {e.note}
                </blockquote>
              ) : (
                <span className={clsx('min-w-0', light ? 'text-f-ink text-[16px]' : 'text-ink text-sm')}>
                  <span className="font-medium">{ACTION_LABEL[e.action]}</span>
                  {actor && <span className={light ? 'text-f-ink-2' : 'text-ink-2'}> {actor}</span>}
                  {e.note && !full && <span className={light ? 'text-f-ink-2' : 'text-ink-2'}> · {e.note}</span>}
                  {e.note && full && e.action !== 'created' && <span className={light ? 'text-f-ink-2' : 'text-ink-2'}> · {e.note}</span>}
                </span>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
