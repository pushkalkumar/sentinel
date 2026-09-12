import { useMemo } from 'react'
import { Link } from 'react-router'
import { useDisplayAlerts, useDisplayCard } from '@/store/select'
import { ALERT_META, BAND_META, bandIndex } from '@/lib/bands'
import { fmtSim } from '@/lib/time'

/** DESIGN §6.12: 36px strip below the nav; highest-priority open alert wins; LOCAL_FIRE is solid alarm. */
export function Banner() {
  const alerts = useDisplayAlerts()
  const card = useDisplayCard()

  const top = useMemo(() => {
    if (alerts.length === 0) return null
    return [...alerts].sort((a, b) => a.priority - b.priority || b.started_at.localeCompare(a.started_at))[0]
  }, [alerts])

  if (top) {
    const m = ALERT_META[top.kind]
    const fire = top.kind === 'LOCAL_FIRE'
    const where = top.node_label ?? top.zone_name
    const text = fire ? `FIRE DETECTED AT ${where.toUpperCase()}. EVACUATE.` : `${m.label} at ${where}: ${top.reason}`
    return (
      <div
        role={fire ? 'alert' : 'status'}
        className="h-9 flex items-center gap-4 px-6 text-sm font-medium"
        style={fire ? { background: m.color, color: '#F2EEE8' } : { background: m.dimColor, color: m.color }}
      >
        <span className="truncate flex-1 min-w-0">{text}</span>
        <span className="font-mono text-xs opacity-80 shrink-0">{fmtSim(top.started_at, 'HH:mm:ss')}</span>
        {!fire && <Link to="/admin/alerts" className="text-xs underline decoration-line-strong hover:decoration-signal shrink-0">Alerts</Link>}
      </div>
    )
  }

  if (card && bandIndex(card.band) >= bandIndex('unhealthy')) {
    const m = BAND_META[card.band]
    return (
      <div role="status" className="h-9 flex items-center gap-4 px-6 text-sm font-medium" style={{ background: `${m.color}24`, color: m.color }}>
        <span className="truncate flex-1 min-w-0">{card.headline}. {card.guidance}</span>
        <span className="font-mono text-xs opacity-80 shrink-0">{fmtSim(card.changed_at, 'HH:mm')}</span>
      </div>
    )
  }
  return null
}
