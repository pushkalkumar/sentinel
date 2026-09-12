import { useCallback, useEffect, useState } from 'react'
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
import { clockNow } from '@/lib/time'
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

function Clock() {
  const [now, setNow] = useState(() => clockNow())
  useEffect(() => {
    const id = setInterval(() => setNow(clockNow()), 1000)
    return () => clearInterval(id)
  }, [])
  return <span className="font-mono text-xs text-ink-3 tabular-nums">{now}</span>
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
    <div className="h-dvh flex flex-col bg-canvas text-ink">
      <Grain />
      <header className="h-14 shrink-0 z-30 flex items-center gap-8 px-6">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="display-h1 text-[17px] font-semibold tracking-tight">Sentinel</span>
          {(siteName ?? user?.tenant.name) && <span className="text-sm text-ink-3 truncate">{siteName ?? user?.tenant.name}</span>}
        </div>
        <nav className="flex items-center gap-1 h-full" aria-label="Sections">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => clsx(
                'relative h-full inline-flex items-center px-3 text-sm transition-[color] duration-[120ms]',
                isActive
                  ? 'text-ink after:absolute after:left-3 after:right-3 after:bottom-[15px] after:h-px after:bg-accent'
                  : 'text-ink-3 hover:text-ink-2',
              )}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-5">
          {role === 'responder' && <SoundToggle />}
          <LiveDot />
          <Clock />
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink-2 truncate max-w-48">{user.name}</span>
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
        <div className="w-full max-w-console mx-auto px-6 grow shrink-0 flex flex-col">
          <Outlet />
        </div>
        <footer className="shrink-0 w-full max-w-console mx-auto px-6 h-10 flex items-center">
          <SimTag kind="nodes" />
        </footer>
      </main>
      <Toasts />
      <ExplainDrawer />
    </div>
  )
}
