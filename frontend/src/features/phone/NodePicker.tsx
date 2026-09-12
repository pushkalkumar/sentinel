import { useEffect, useState } from 'react'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { Node, NodeId } from '@/lib/types'
import { listNodes, errorText } from '@/lib/api'
import { NODE_STATUS_META } from '@/lib/bands'
import { useSessionStore } from '@/store/session'
import { usePhoneStore } from './phoneStore'
import { FieldButton } from './FieldButton'

/** CONTRACT §0.7: the label next to the picker, verbatim. */
const PICKER_LABEL = 'In production the node stamps this automatically; pick the node you are standing next to.'

export interface NodePickerProps {
  open: boolean
}

/** Bottom sheet listing the nodes. Picks into the session store (sent as X-Node-Id). */
export function NodePicker({ open }: NodePickerProps) {
  const picked = useSessionStore((s) => s.pickedNodeId)
  const pickNode = useSessionStore((s) => s.pickNode)
  const closePicker = usePhoneStore((s) => s.closePicker)
  const refresh = usePhoneStore((s) => s.refresh)
  const [nodes, setNodes] = useState<Node[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadSeq, setReloadSeq] = useState(0)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)
    listNodes()
      .then((n) => { if (!cancelled) setNodes(n) })
      .catch((e) => { if (!cancelled) setError(errorText(e)) })
    return () => { cancelled = true }
  }, [open, reloadSeq])

  if (!open) return null

  const choose = (id: NodeId | null) => {
    pickNode(id)
    closePicker()
    void refresh()
  }

  const bySite = (nodes ?? []).reduce<Record<number, Node[]>>((acc, n) => {
    const list = acc[n.site_id] ?? []
    return { ...acc, [n.site_id]: [...list, n] }
  }, {})

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(11,10,9,0.4)]" role="dialog" aria-modal="true" aria-labelledby="node-picker-title">
      <div className="w-full max-w-[390px] max-h-[86dvh] flex flex-col bg-f-surface rounded-t-[24px] shadow-[0_-12px_40px_rgba(11,10,9,0.16)] font-field">
        <div className="px-6 pt-7 pb-2">
          <h2 id="node-picker-title" className="text-[24px] font-semibold leading-tight text-f-ink">Which node are you next to?</h2>
          <p className="text-[15px] leading-5 text-f-ink-2 mt-2 text-pretty">{PICKER_LABEL}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pt-2 pb-2">
          {nodes === null && !error && (
            <p className="px-3 py-6 text-[16px] text-f-ink-2">Loading nodes</p>
          )}
          {error && (
            <div className="px-3 py-4 flex flex-col gap-3">
              <p className="text-[16px] text-f-alarm">{error}</p>
              <FieldButton height={48} onClick={() => setReloadSeq((n) => n + 1)}>Try again</FieldButton>
            </div>
          )}
          {nodes !== null && nodes.length === 0 && !error && (
            <p className="px-3 py-6 text-[16px] text-f-ink-2">No nodes on file. Pick "Not next to a node" below.</p>
          )}
          {Object.entries(bySite).map(([siteId, list]) => (
            <ul key={siteId} className="flex flex-col" aria-label={`Site ${siteId}`}>
              {list.map((n) => {
                const meta = NODE_STATUS_META[n.status]
                const active = n.id === picked
                const online = n.status === 'ok'
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => choose(n.id)}
                      aria-pressed={active}
                      className={clsx(
                        'w-full h-14 px-3 flex items-center justify-between gap-3 text-left rounded-lg',
                        'transition-[background-color] duration-[120ms] active:bg-f-canvas',
                        active ? 'text-f-signal' : 'text-f-ink',
                      )}
                    >
                      <span className="min-w-0 text-[18px] font-medium truncate">{n.label}</span>
                      {active ? (
                        <Check size={22} strokeWidth={2} aria-hidden className="shrink-0" />
                      ) : !online ? (
                        <span className="shrink-0 flex items-center gap-2 text-[14px] text-f-ink-2">
                          <i aria-hidden className="size-2 rounded-full" style={meta.hollow ? { boxShadow: `inset 0 0 0 1.5px ${meta.color}` } : { background: meta.color }} />
                          {meta.label}
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          ))}
        </div>

        <div className="px-6 pt-2 pb-7 flex flex-col gap-2">
          <FieldButton height={56} variant="ghost" onClick={() => choose(null)}>Not next to a node</FieldButton>
          <p className="text-[14px] text-f-ink-2 text-center">Without a node, a report can show as Likely at most.</p>
        </div>
      </div>
    </div>
  )
}
