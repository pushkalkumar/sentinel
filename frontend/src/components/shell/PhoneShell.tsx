import { useCallback, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useLive } from '@/lib/live'
import { SimTag } from '@/components/ui/SimTag'
import { useSessionStore } from '@/store/session'
import { useSiteStore } from '@/store/site'
import { usePhoneStore } from '@/features/phone/phoneStore'
import { BandBanner } from '@/features/phone/BandBanner'
import { NodePicker } from '@/features/phone/NodePicker'

/** Banner refresh cadence when the WS is down or quiet; alert traffic refreshes it sooner. */
const BANNER_POLL_MS = 15_000

/** Light field ground, 390px column on desktop. Banner always present; picker sheet on first visit. */
export function PhoneShell() {
  const { pathname } = useLocation()
  const pickedNodeId = useSessionStore((s) => s.pickedNodeId)
  const openAlerts = useSiteStore((s) => s.openAlerts)
  const node = usePhoneStore((s) => s.node)
  const loading = usePhoneStore((s) => s.loading)
  const error = usePhoneStore((s) => s.error)
  const pickerOpen = usePhoneStore((s) => s.pickerOpen)
  const refresh = usePhoneStore((s) => s.refresh)

  const onReconnect = useCallback(() => { void refresh() }, [refresh])
  useLive({ withDeviceFp: true, onReconnect })

  // Picked node changed, or an alert opened/cleared anywhere: re-read the banner.
  useEffect(() => { void refresh() }, [pickedNodeId, openAlerts, refresh])

  useEffect(() => {
    if (!pickedNodeId) return
    const id = setInterval(() => { void refresh() }, BANNER_POLL_MS)
    return () => clearInterval(id)
  }, [pickedNodeId, refresh])

  return (
    <div data-ground="field" className="min-h-dvh bg-f-canvas text-f-ink font-field">
      <div className="mx-auto w-full max-w-[390px] min-h-dvh flex flex-col">
        <div className="sticky top-0 z-30">
          <BandBanner node={node} loading={loading} error={error} />
        </div>
        <main className="flex-1 px-5 pb-8">
          <Outlet />
        </main>
        {pathname === '/m' && (
          <footer className="px-5 pb-6">
            <SimTag kind="phone" ground="light" className="h-auto min-h-[22px] py-1 whitespace-normal [&_span]:whitespace-normal [&_span]:overflow-visible" />
          </footer>
        )}
      </div>
      {/* Teachers pick a muster point inside the roll call form, so the first-visit picker would only block /m/staff. */}
      <NodePicker open={pickerOpen && pathname !== '/m/staff'} />
    </div>
  )
}
