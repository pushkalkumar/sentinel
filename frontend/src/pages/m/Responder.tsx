import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { errorText, isApiError, listIncidents, login, me } from '@/lib/api'
import { Input } from '@/components/ui/Input'
import { useSessionStore } from '@/store/session'
import { isOpenIncident, useIncidentStore } from '@/store/incidents'
import { FieldIncidentCard } from '@/features/phone/FieldIncidentCard'
import { FieldButton } from '@/features/phone/FieldButton'
import { RING } from '@/features/phone/surface'

const POLL_MS = 15_000

/** Shared Input keeps its 24 percent border; on the phone we swap it for the soft edge. */
const INPUT_QUIET = `border-transparent ${RING} rounded-lg`

export default function Responder() {
  const token = useSessionStore((s) => s.token)
  const role = useSessionStore((s) => s.role)
  const user = useSessionStore((s) => s.user)
  const setAuth = useSessionStore((s) => s.setAuth)
  const logout = useSessionStore((s) => s.logout)
  const [restoring, setRestoring] = useState(Boolean(token) && !role)

  // Restore a stored token via /auth/me; a teacher token is not good enough here.
  useEffect(() => {
    if (!token || role) {
      setRestoring(false)
      return
    }
    let cancelled = false
    me()
      .then((m) => { if (!cancelled) setAuth({ ...m, token }) })
      .catch(() => { if (!cancelled) logout() })
      .finally(() => { if (!cancelled) setRestoring(false) })
    return () => { cancelled = true }
  }, [token, role, setAuth, logout])

  if (restoring) return <p className="pt-8 text-[16px] text-f-ink-2 font-field">Checking your sign in</p>

  const signedIn = token && (role === 'responder' || role === 'admin')
  if (!signedIn) return <FieldLogin />

  return <FieldQueue name={user?.name ?? 'Responder'} onSignOut={logout} />
}

function FieldLogin() {
  const setAuth = useSessionStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await login(email.trim(), password)
      if (res.role !== 'responder' && res.role !== 'admin') {
        setError('This sign in is for responders.')
        return
      }
      setAuth(res)
    } catch (err) {
      if (isApiError(err, 'UNAUTHORIZED')) setError('Email or password did not match. Try again.')
      else setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 pt-2 font-field" noValidate>
      <Link to="/m" className="inline-flex items-center gap-1.5 min-h-12 -ml-1 px-1 text-[16px] text-f-ink-2 self-start">
        <ArrowLeft size={20} strokeWidth={1.5} aria-hidden /> Back
      </Link>
      <div>
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink">Responder sign in</h1>
        <p className="text-[17px] text-f-ink-2 mt-1">Only a responder can close an incident.</p>
      </div>
      <Input
        fieldSize="phone"
        label="Email"
        type="email"
        value={email}
        onChange={(e) => { setEmail(e.target.value); if (error) setError(null) }}
        autoComplete="username"
        autoCapitalize="none"
        inputMode="email"
        placeholder="responder@sentinel.demo"
        className={INPUT_QUIET}
      />
      <Input
        fieldSize="phone"
        label="Password"
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); if (error) setError(null) }}
        autoComplete="current-password"
        error={error}
        className={INPUT_QUIET}
      />
      <FieldButton type="submit" variant="ink" loading={busy} disabled={!email.trim() || !password}>Sign in</FieldButton>
    </form>
  )
}

function FieldQueue({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  const byCode = useIncidentStore((s) => s.byCode)
  const order = useIncidentStore((s) => s.order)
  const hydrate = useIncidentStore((s) => s.hydrate)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const res = await listIncidents({ status: 'open', sort: 'priority' })
      hydrate(res.incidents)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [hydrate])

  useEffect(() => {
    void load()
    const id = setInterval(() => { void load() }, POLL_MS)
    return () => clearInterval(id)
  }, [load])

  const open = order.map((c) => byCode[c]).filter((i) => i && isOpenIncident(i))

  return (
    <div className="flex flex-col gap-8 pt-2 font-field">
      <div className="flex items-center justify-between">
        <Link to="/m" className="inline-flex items-center gap-1.5 min-h-12 -ml-1 px-1 text-[16px] text-f-ink-2">
          <ArrowLeft size={20} strokeWidth={1.5} aria-hidden /> Back
        </Link>
        <button type="button" onClick={onSignOut} className="min-h-12 -mr-1 px-1 text-[16px] text-f-ink-2">
          Sign out
        </button>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[30px] font-semibold leading-none text-f-ink tabular-nums">{open.length} open</h1>
          <p className="text-[16px] leading-5 text-f-ink-2 mt-2 text-pretty">{name}</p>
        </div>
        <FieldButton variant="ghost" height={48} block={false} className="shrink-0 -mr-2 px-3 text-f-signal" onClick={() => void load(true)} loading={refreshing}>
          Refresh
        </FieldButton>
      </div>

      {loading && open.length === 0 && <p className="text-[16px] text-f-ink-2">Loading open incidents</p>}

      {error && (
        <p role="alert" className="text-[16px] text-f-alarm">{error}</p>
      )}

      {!loading && !error && open.length === 0 && (
        <div>
          <p className="text-[18px] font-medium text-f-ink">No open incidents.</p>
          <p className="text-[16px] text-f-ink-2 mt-1">New reports appear here as they come in.</p>
        </div>
      )}

      <ul className="flex flex-col gap-4" aria-label="Open incidents">
        {open.map((inc) => (
          <li key={inc.code}>
            <FieldIncidentCard incident={inc} />
          </li>
        ))}
      </ul>
    </div>
  )
}
