import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Grain } from '@/components/shell/Grain'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Segmented } from '@/components/ui/Segmented'
import { errorText, isApiError, login } from '@/lib/api'
import { useSessionStore } from '@/store/session'

type Tab = 'admin' | 'responder'

const DEMO_EMAIL: Record<Tab, string> = {
  admin: 'admin@sentinel.demo',
  responder: 'responder@sentinel.demo',
}

const HOME: Record<'admin' | 'responder', string> = { admin: '/admin', responder: '/responder' }

function safeNext(raw: string | null): string | null {
  if (!raw) return null
  // Only same-origin paths; never let ?next= send the browser elsewhere.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const setAuth = useSessionStore((s) => s.setAuth)

  const next = safeNext(params.get('next'))
  const denied = params.get('denied') === '1'
  const initialTab: Tab = next?.startsWith('/responder') ? 'responder' : 'admin'

  const [tab, setTab] = useState<Tab>(initialTab)
  const [email, setEmail] = useState(DEMO_EMAIL[initialTab])
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Always show the form: switching from the admin to the responder account happens here.

  const switchTab = (t: Tab) => {
    setTab(t)
    setError(null)
    if (email === DEMO_EMAIL.admin || email === DEMO_EMAIL.responder || email === '') setEmail(DEMO_EMAIL[t])
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await login(email.trim(), password)
      setAuth(res)
      const target = next && (res.role === 'responder' || !next.startsWith('/responder')) ? next : HOME[res.role]
      navigate(target, { replace: true })
    } catch (err) {
      setError(isApiError(err, 'UNAUTHORIZED') ? 'That email and password do not match. Check both and try again.' : errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-canvas text-ink relative flex flex-col">
      <Grain />
      <main className="relative z-[2] flex-1 flex items-center justify-center px-4 py-16">
        <form onSubmit={submit} noValidate className="w-full max-w-[340px] flex flex-col gap-6">
          <div className="flex flex-col gap-1">
            <Link to="/" className="display-h1 text-[17px] font-semibold tracking-tight text-ink self-start">Sentinel</Link>
            <h1 className="display-h2 text-xl text-ink mt-6">Sign in to the console</h1>
          </div>
          <Segmented<Tab>
            label="Account type"
            value={tab}
            onChange={switchTab}
            options={[{ value: 'admin', label: 'Admin' }, { value: 'responder', label: 'Responder' }]}
            className="self-start"
          />
          {denied && !error && (
            <p className="text-sm text-warn" role="status">
              That page needs a {next?.startsWith('/responder') ? 'responder' : 'different'} account. Sign in with one that has access.
            </p>
          )}
          {/* Sentence-case labels: a sign-in form is not two signage labels (design item 25). */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-email" className="text-[13px] text-ink-2">Email</label>
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="login-password" className="text-[13px] text-ink-2">Password</label>
            <Input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
              hint="Demo password: sentinel"
              autoFocus
            />
          </div>
          <Button type="submit" variant="primary" loading={busy} className="w-full mt-2">
            {tab === 'admin' ? 'Open admin console' : 'Open responder console'}
          </Button>
          <p className="text-sm text-ink-3 text-center">
            Staff? <Link to="/m/staff" className="text-ink-2 underline underline-offset-2 decoration-line-strong hover:text-ink">Use the phone page</Link>
          </p>
        </form>
      </main>
    </div>
  )
}
