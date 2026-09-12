import { useEffect, useState } from 'react'
import type { DecisionCard } from '@/lib/types'
import { useSiteStore } from '@/store/site'
import { useDisplayAlerts, useDisplayCard } from '@/store/select'
import { getDecisionCard } from '@/lib/api'
import { Pill } from '@/components/ui/Pill'
import { ALERT_META } from '@/lib/bands'

/**
 * The WS carries every site's decision_card (CONTRACT §6: every client gets every message) and the
 * site store keeps the last one regardless of site, so hold on to the last card for our site here.
 */
function useSiteCard(): DecisionCard | null {
  const siteId = useSiteStore((s) => s.site?.id)
  const card = useDisplayCard()
  const [own, setOwn] = useState<DecisionCard | null>(null)
  useEffect(() => {
    if (card && siteId !== undefined && card.site_id === siteId) setOwn(card)
  }, [card, siteId])
  // The demo must never show a stale card; poll as a backstop for a missed WS frame.
  useEffect(() => {
    if (siteId === undefined) return
    let alive = true
    const tick = () => getDecisionCard(siteId).then((c) => { if (alive && c) setOwn(c) }).catch(() => {})
    tick()
    const id = setInterval(tick, 3000)
    return () => { alive = false; clearInterval(id) }
  }, [siteId])
  return own
}

/** The one-line site decision: band word, the reading, the headline. A fire alert tints a line under it. */
export function DecisionPanel() {
  const siteId = useSiteStore((s) => s.site?.id)
  const card = useSiteCard()
  const alerts = useDisplayAlerts()
  const top = alerts
    .filter((a) => a.site_id === siteId && a.priority <= 2)
    .sort((a, b) => a.priority - b.priority)[0]

  return (
    <section className="bg-surface rounded-lg p-panel flex flex-col" aria-label="Decision">
      <h2 className="label-signage">Decision</h2>
      {card ? (
        <>
          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <span className="stat-number text-[64px] leading-none text-ink">{Math.round(card.pm25)}</span>
              <span className="text-sm text-ink-3">µg/m³ at {card.node_label}</span>
            </div>
            <Pill kind="band" value={card.band} className="mb-2" />
          </div>
          <p className="mt-3 text-md text-ink leading-snug text-balance">{card.headline}</p>
        </>
      ) : (
        <p className="mt-4 text-sm text-ink-4">Waiting for the first reading</p>
      )}
      {top && (
        <p
          className="mt-4 -mx-2 px-3 h-9 rounded-md flex items-center gap-2 text-sm"
          style={{ background: ALERT_META[top.kind].dimColor, color: ALERT_META[top.kind].color }}
          role="status"
        >
          <span className="font-medium">{ALERT_META[top.kind].label}</span>
          {top.node_label && <span className="opacity-80">at {top.node_label}</span>}
        </p>
      )}
    </section>
  )
}
