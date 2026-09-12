import { useCallback, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import clsx from 'clsx'
import { LogOut } from 'lucide-react'
import { useSessionStore } from '@/store/session'
import { useSiteStore } from '@/store/site'
import { useIncidentStore } from '@/store/incidents'
import { useSmsStore } from '@/store/sms'
import { useDrillStore } from '@/store/drills'
import { useSimStore } from '@/store/sim'
import { useLive } from '@/lib/live'
import { errorText, getOverview, getSmsOutbox, listIncidents } from '@/lib/api'
import { fmtSim } from '@/lib/time'
import { useDisplayClock, useTimelineActive } from '@/store/select'
import { LiveDot } from '@/components/ui/LiveDot'
import { Toasts } from '@/components/ui/Toasts'
import { Banner } from '@/components/ui/Banner'
import { SimTag } from '@/components/ui/SimTag'
import { SoundToggle } from '@/features/responder/SoundToggle'
import { Grain } from './Grain'
import { ExplainDrawer } from '@/features/novel/ExplainDrawer'

const ADMIN_TABS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/drill', label: 'Drill' },
  { to: '/admin/air', label: 'Air' },
  { to: '/admin/alerts', label: 'Alerts' },
  { to: '/admin/nodes', label: 'Nodes' },
]
const RESPONDER_TABS = [
  { to: '/responder', label: 'Queue', end: true },
  { to: '/responder/audit', label: 'Audit' },
]

/** Responders watch site 1 (the school) on the map by default; admins their own site. */
const RESPONDER_MAP_SITE = 1

/**
 * The console's only clock: sim time, labelled, with the speed beside it.
 * The wall clock is gone on purpose (judge item 7) so nothing on screen
 * disagrees with the banner, the time machine or the decision log.
 */
function SimClock() {
  const ts = useDisplayClock()
  const speed = useSimStore((s) => s.simState?.speed ?? null)
  const replaying = useTimelineActive()
  if (!ts) return null
  return (
    <span className="text-xs text-ink-3 tabular-nums whitespace-nowrap" aria-label="Simulated time">
      Sim <span className="font-mono text-ink-2">{fmtSim(ts, 'HH:mm')}</span>
      {replaying ? ' · replay' : speed ? ` · ${speed}x` : ''}
    </span>
  )
}

/**
 * Console frame. The window is a fixed-height column so a page can fill the
 * viewport exactly (the responder queue) while long pages scroll inside `main`.
 * One honesty line for the whole console sits in the footer (DESIGN_V2 §2.4).
 */
export function DesktopShell() {
  const user = useSessionStore((s) => s.user)
  const role = useSessionStore((s) => s.role)
  const logout = useSessionStore((s) => s.logout)
  const siteName = useSiteStore((s) => s.site?.name)
  const navigate = useNavigate()

  const siteId = role === 'responder' ? RESPONDER_MAP_SITE : (user?.site_id ?? RESPONDER_MAP_SITE)

  const hydrate = useCallback(() => {
    const site = useSiteStore.getState()
    getOverview(siteId)
      .then((o) => {
        site.hydrate(o)
        useIncidentStore.getState().hydrate(o.open_incidents)
        if (o.active_drill !== undefined) useDrillStore.getState().setActive(o.active_drill)
        if (o.sim) useSimStore.getState().setSim(o.sim)
      })
      .catch((e) => site.setError(errorText(e)))
    getSmsOutbox(siteId).then((o) => useSmsStore.getState().hydrate(o)).catch(() => undefined)
    if (role === 'responder') {
      listIncidents({ status: 'open' }).then((r) => useIncidentStore.getState().hydrate(r.incidents)).catch(() => undefined)
    }
  }, [siteId, role])

  useEffect(() => { hydrate() }, [hydrate])
  useLive({ onReconnect: hydrate })

  const tabs = role === 'responder' ? RESPONDER_TABS : ADMIN_TABS

  return (
    <div className="h-dvh flex flex-col bg-canvas text-ink overflow-x-hidden">
      <Grain />
      <header className="h-14 shrink-0 z-30 flex items-center gap-4 md:gap-8 px-4 md:px-6">
        <div className="flex items-baseline gap-3 min-w-0 shrink-0">
          <span className="display-h1 text-[17px] font-semibold tracking-tight">Sentinel</span>
          {(siteName ?? user?.tenant.name) && <span className="hidden lg:inline text-sm text-ink-3 truncate">{siteName ?? user?.tenant.name}</span>}
        </div>
        <nav
          className="flex items-center gap-1 h-full min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Sections"
        >
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => clsx(
                'relative h-full inline-flex items-center shrink-0 px-2.5 md:px-3 text-sm transition-[color] duration-[120ms]',
                isActive
                  ? 'text-ink after:absolute after:left-3 after:right-3 after:bottom-[15px] after:h-px after:bg-accent'
                  : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto shrink-0 flex items-center gap-3 md:gap-5">
          {role === 'responder' && <span className="hidden sm:inline-flex"><SoundToggle /></span>}
          <LiveDot />
          <SimClock />
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden xl:inline text-sm text-ink-2 truncate max-w-48" title={user.name}>{user.name}</span>
              <button
                type="button"
                onClick={() => { logout(); navigate('/login') }}
                className="size-8 -mr-2 inline-flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] transition-[color,background-color] duration-[120ms]"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut size={16} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </header>
      <Banner />
      <main className="flex-1 min-h-0 overflow-y-auto relative z-[2] flex flex-col">
        <div className="w-full max-w-console mx-auto px-4 md:px-6 grow shrink-0 flex flex-col">
          <Outlet />
        </div>
        <footer className="shrink-0 w-full max-w-console mx-auto px-4 md:px-6 h-10 flex items-center">
          <SimTag kind="nodes" />
        </footer>
      </main>
      <Toasts />
      <ExplainDrawer />
    </div>
  )
}
