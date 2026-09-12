// Routes LiveMessage → store slices per CONTRACT §6.1.
import type { LiveMessage } from '@/lib/types'
import { useSiteStore } from './site'
import { useIncidentStore } from './incidents'
import { useMeshStore } from './mesh'
import { useSmsStore } from './sms'
import { useDrillStore } from './drills'
import { useSimStore } from './sim'
import { useUiStore } from './ui'
import { INCIDENT_TYPE_LABEL } from '@/lib/types'

export function dispatchLive(msg: LiveMessage): void {
  switch (msg.type) {
    case 'hello':
      useSimStore.getState().setHello(msg.data)
      return
    case 'sim_state':
      useSimStore.getState().setSim(msg.data)
      return
    case 'reading':
      useSiteStore.getState().applyReading(msg.data)
      return
    case 'node_status':
      useSiteStore.getState().applyNodeStatus(msg.data)
      return
    case 'alert':
      useSiteStore.getState().applyAlert(msg.data)
      return
    case 'alert_cleared':
      useSiteStore.getState().applyAlertCleared(msg.data)
      return
    case 'decision_card':
      useSiteStore.getState().applyDecisionCard(msg.data)
      return
    case 'sms_sent':
      useSmsStore.getState().push(msg.data)
      return
    case 'incident_created': {
      const inc = msg.data
      useIncidentStore.getState().created(inc)
      const where = inc.node_label ? ` at ${inc.node_label}` : ''
      useUiStore.getState().toast(`New report ${inc.code}: ${INCIDENT_TYPE_LABEL[inc.type]}${where}`)
      return
    }
    case 'incident_event':
      useIncidentStore.getState().applyEvent(msg.data)
      return
    case 'hop':
      useMeshStore.getState().push(msg.data)
      return
    case 'drill_started':
      useDrillStore.getState().setActive(msg.data)
      return
    case 'rollcall':
      useDrillStore.getState().applyRollcall(msg.data)
      return
    case 'drill_ended':
      useDrillStore.getState().ended(msg.data)
      return
    case 'pong':
      return
  }
}

/** Batch entry point used by lib/live.ts: one store pass per animation frame. */
export function dispatchBatch(msgs: LiveMessage[]): void {
  for (const m of msgs) dispatchLive(m)
}
