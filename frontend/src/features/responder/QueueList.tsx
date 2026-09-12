import { useEffect, useRef, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import type { Incident, IncidentCode } from '@/lib/types'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { QueueRow } from './QueueRow'

export interface QueueListProps {
  incidents: Incident[]
  selected: IncidentCode | null
  onSelect: (code: IncidentCode) => void
  onOpen: (code: IncidentCode) => void
  siteName?: string | null
  loading?: boolean
  error?: string | null
}

/** Keyboard-navigable listbox of queue rows. Arrows move the selection, Enter opens the detail page. */
export function QueueList({ incidents, selected, onSelect, onOpen, siteName, loading = false, error = null }: QueueListProps) {
  const ref = useRef<HTMLUListElement>(null)
  const reduce = useReducedMotion()

  // Focus the list on mount so arrows and Enter work without a click first (DESIGN §8.5 keyboard flow).
  const hasRows = incidents.length > 0
  useEffect(() => {
    if (hasRows && document.activeElement === document.body) ref.current?.focus({ preventScroll: true })
  }, [hasRows])

  // Keep the selected row in view when the order changes under it.
  useEffect(() => {
    if (!selected || !ref.current) return
    const el = ref.current.querySelector<HTMLElement>(`[data-code="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected, incidents])

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    if (incidents.length === 0) return
    const idx = incidents.findIndex((i) => i.code === selected)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      onSelect(incidents[Math.min(incidents.length - 1, idx + 1)].code)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      onSelect(incidents[Math.max(0, idx - 1)].code)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onSelect(incidents[0].code)
    } else if (e.key === 'End') {
      e.preventDefault()
      onSelect(incidents[incidents.length - 1].code)
    } else if (e.key === 'Enter' && selected) {
      e.preventDefault()
      onOpen(selected)
    }
  }

  if (loading && incidents.length === 0) {
    return <div className="p-5"><Skeleton /></div>
  }
  if (error && incidents.length === 0) {
    return <EmptyState text={error} className="text-alarm" />
  }
  if (incidents.length === 0) {
    return (
      <EmptyState
        text="No open incidents."
        action={<span className="text-ink-3 text-sm">New reports from phones at a node appear here within a second.</span>}
      />
    )
  }

  return (
    <ul
      ref={ref}
      role="listbox"
      aria-label="Open incidents"
      aria-activedescendant={selected ?? undefined}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="outline-none focus-visible:outline-2 focus-visible:outline-signal focus-visible:-outline-offset-2"
    >
      <AnimatePresence initial={false}>
        {incidents.map((inc) => (
          <motion.li
            key={inc.code}
            layout={reduce ? false : 'position'}
            initial={reduce ? false : { opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            role="presentation"
            className="overflow-hidden list-none"
          >
            <QueueRow
              incident={inc}
              selected={inc.code === selected}
              siteName={siteName}
              onSelect={() => onSelect(inc.code)}
              onOpen={() => onOpen(inc.code)}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}
