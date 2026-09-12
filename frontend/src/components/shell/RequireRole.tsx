import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { Role } from '@/lib/types'
import { useSessionStore } from '@/store/session'
import { me } from '@/lib/api'
import { Skeleton } from '@/components/ui/Skeleton'

export interface RequireRoleProps {
  roles: Role[]
  children?: ReactNode
}

/** Gate: restores the user from a stored token via /auth/me, then checks the role; else → /login?next= */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const token = useSessionStore((s) => s.token)
  const role = useSessionStore((s) => s.role)
  const setAuth = useSessionStore((s) => s.setAuth)
  const logout = useSessionStore((s) => s.logout)
  const location = useLocation()
  const [checking, setChecking] = useState(Boolean(token) && !role)

  useEffect(() => {
    if (!token || role) return
    let cancelled = false
    setChecking(true)
    me()
      .then((m) => { if (!cancelled) setAuth({ ...m, token }) })
      .catch(() => { if (!cancelled) logout() })
      .finally(() => { if (!cancelled) setChecking(false) })
    return () => { cancelled = true }
  }, [token, role, setAuth, logout])

  if (checking) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <Skeleton className="w-64" />
      </div>
    )
  }

  const next = encodeURIComponent(location.pathname + location.search)
  if (!token || !role) return <Navigate to={`/login?next=${next}`} replace />
  if (!roles.includes(role)) return <Navigate to={`/login?next=${next}&denied=1`} replace />
  return children ? <>{children}</> : <Outlet />
}
