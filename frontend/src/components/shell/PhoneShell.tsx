// OWNER: fe-phone
import { Outlet, useLocation } from 'react-router'
import { useLive } from '@/lib/live'
import { SimTag } from '@/components/ui/SimTag'

/** Light field ground, 390px column on desktop. fe-phone adds BandBanner, NodePicker and the dev toggle. */
export function PhoneShell() {
  const { pathname } = useLocation()
  useLive({ withDeviceFp: true })
  return (
    <div data-ground="field" className="min-h-dvh bg-f-canvas text-f-ink font-field">
      <div className="mx-auto w-full max-w-[390px] min-h-dvh flex flex-col">
        <main className="flex-1 px-5 pb-8">
          <Outlet />
        </main>
        {pathname === '/m' && (
          <footer className="px-5 pb-6">
            <SimTag kind="phone" ground="light" />
          </footer>
        )}
      </div>
    </div>
  )
}
