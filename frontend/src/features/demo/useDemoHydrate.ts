// /demo renders outside DesktopShell, so it fills the stores itself: overview, open incidents, the
// active drill and the mesh log, then the WS. Closed reports and drills from earlier runs are left
// out on purpose: what closes during the show stays on screen, what closed last week does not.
import { useCallback, useEffect } from 'react'
import { useSiteStore } from '@/store/site'
import { useIncidentStore } from '@/store/incidents'
import { useDrillStore } from '@/store/drills'
import { useMeshStore } from '@/store/mesh'
import { useSimStore } from '@/store/sim'
import { useLive } from '@/lib/live'
import { errorText, getActiveDrill, getMeshLog, getOverview, listIncidents } from '@/lib/api'

/** The school; backend/app/demo.py stages every chapter at this site. */
export const DEMO_SITE_ID = 1
const INCIDENT_LIMIT = 20
const MESH_LOG = 100

export function useDemoHydrate(): void {
  const hydrate = useCallback(() => {
    const site = useSiteStore.getState()
    getOverview(DEMO_SITE_ID)
      .then((o) => {
        site.hydrate(o)
        if (o.sim) useSimStore.getState().setSim(o.sim)
      })
      .catch((e) => site.setError(errorText(e)))
    listIncidents({ status: 'open', sort: 'newest', siteId: DEMO_SITE_ID, limit: INCIDENT_LIMIT })
      .then((r) => useIncidentStore.getState().hydrate(r.incidents))
      .catch(() => undefined)
    getActiveDrill(DEMO_SITE_ID)
      .then((active) => useDrillStore.getState().setActive(active))
      .catch(() => undefined)
    getMeshLog(MESH_LOG)
      .then((r) => useMeshStore.getState().hydrate(r.entries))
      .catch(() => undefined)
  }, [])

  useEffect(() => { hydrate() }, [hydrate])
  useLive({ onReconnect: hydrate })
}
