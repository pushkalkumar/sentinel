import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import clsx from 'clsx'
import { Check } from 'lucide-react'
import type { Node, NodeId } from '@/lib/types'
import { listNodes, errorText } from '@/lib/api'
import { useSessionStore } from '@/store/session'
import { usePhoneStore } from './phoneStore'
import { FieldButton } from './FieldButton'

/** Why a person has to choose at all. In production the node's own WiFi stamps the report. */
const PICKER_LABEL = 'In production the node you joined stamps the report; here, pick the one you are standing next to.'

/** The phone is served by one site's node, so only that site's nodes are offered. `?site=` overrides. */
const DEFAULT_SITE_ID = 1

/** Bench nodes used for the BLE bridge test: not part of the campus the phone can stand next to. */
const BENCH_NODE_IDS = new Set(['xenon-a', 'xenon-b'])

export interface NodePickerProps {
  open: boolean
}

/** Bottom sheet listing one site's nodes. Picks into the session store (sent as X-Node-Id). */
export function NodePicker({ open }: NodePickerProps) {
  const [params] = useSearchParams()
  const siteId = Number(params.get('site')) || DEFAULT_SITE_ID
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
    listNodes(siteId)
      .then((n) => {
        if (cancelled) return
        setNodes(n
          .filter((x) => x.site_id === siteId && !BENCH_NODE_IDS.has(x.id))
          .sort((a, b) => a.label.localeCompare(b.label)))
      })
      .catch((e) => { if (!cancelled) setError(errorText(e)) })
    return () => { cancelled = true }
  }, [open, reloadSeq, siteId])

  if (!open) return null

  const choose = (id: NodeId | null) => {
    pickNode(id)
    closePicker()
    void refresh()
  }

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
          {nodes !== null && nodes.length > 0 && (
            <ul className="flex flex-col" aria-label="Nodes on this campus">
              {nodes.map((n) => {
                const active = n.id === picked
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => choose(n.id)}
                      aria-pressed={active}
                      className={clsx(
                        'w-full h-14 px-3 flex items-center justify-between gap-3 text-left rounded-lg text-f-ink',
                        'transition-[background-color] duration-[120ms] active:bg-f-canvas',
                      )}
                    >
                      <span className="min-w-0 text-[18px] font-medium truncate">{n.label}</span>
                      {active && <Check size={22} strokeWidth={2} aria-hidden className="shrink-0" />}
                      {!active && n.status === 'offline' && <span className="shrink-0 text-[14px] text-f-ink-2">Offline</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="px-6 pt-2 pb-7 flex flex-col gap-2">
          <FieldButton height={56} variant="ghost" onClick={() => choose(null)}>Not next to a node</FieldButton>
          <p className="text-[14px] text-f-ink-2 text-center">Without a node, a report can show as Likely at most.</p>
        </div>
      </div>
    </div>
  )
}
