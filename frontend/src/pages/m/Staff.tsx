import { useCallback, useEffect, useRef, useState } from 'react'
import type { Drill, Node, StaffLoginResponse } from '@/lib/types'
import { getActiveDrill, listNodes, me } from '@/lib/api'
import { fmtWall, fmtWallZoned } from '@/lib/time'
import { useSessionStore } from '@/store/session'
import { useDrillStore } from '@/store/drills'
import { StaffLogin } from '@/features/drill/StaffLogin'
import { RollcallForm } from '@/features/drill/RollcallForm'

const POLL_MS = 5000

/** Teacher phone page: code entry, then waits for a drill, then roll call (BUILD_PLAN §2.7). */
export default function Staff() {
  const token = useSessionStore((s) => s.token)
  const role = useSessionStore((s) => s.role)
  const classInfo = useSessionStore((s) => s.classInfo)
  const setAuth = useSessionStore((s) => s.setAuth)
  const logout = useSessionStore((s) => s.logout)
  const active = useDrillStore((s) => s.active)
  const history = useDrillStore((s) => s.history)
  const setActive = useDrillStore((s) => s.setActive)

  const [restoring, setRestoring] = useState(Boolean(token) && !role)
  const [nodes, setNodes] = useState<Node[]>([])
  const [pollError, setPollError] = useState<string | null>(null)
  const [endedView, setEndedView] = useState<Drill | null>(null)
  const lastActiveId = useRef<number | null>(null)

  const isTeacher = role === 'teacher' && classInfo !== null

  // Restore a stored teacher token via /auth/me.
  useEffect(() => {
    if (!token || role) {
      setRestoring(false)
      return
    }
    let cancelled = false
    me()
      .then((m) => {
        if (cancelled) return
        setAuth({ ...m, token })
        if (m.role === 'teacher') setActive(m.active_drill)
      })
      .catch(() => { if (!cancelled) logout() })
      .finally(() => { if (!cancelled) setRestoring(false) })
    return () => { cancelled = true }
  }, [token, role, setAuth, logout, setActive])

  // Nodes for the muster picker.
  useEffect(() => {
    if (!isTeacher || !classInfo) return
    let cancelled = false
    listNodes(classInfo.site_id).then((n) => { if (!cancelled) setNodes(n) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [isTeacher, classInfo])

  // Poll for an active drill every 5 s while waiting; the WS usually gets there first.
  const poll = useCallback(() => {
    if (!classInfo) return
    getActiveDrill(classInfo.site_id)
      .then((d) => {
        setPollError(null)
        if (d) setActive(d)
      })
      .catch(() => setPollError('Could not reach the server. This page keeps trying.'))
  }, [classInfo, setActive])

  useEffect(() => {
    if (!isTeacher || active) return
    poll()
    const id = setInterval(poll, POLL_MS)
    return () => clearInterval(id)
  }, [isTeacher, active, poll])

  // When the drill we were in ends, show the thank-you until a new one starts.
  useEffect(() => {
    if (active) {
      lastActiveId.current = active.id
      setEndedView(null)
      return
    }
    const id = lastActiveId.current
    if (id === null) return
    const done = history.find((h) => h.id === id)
    if (done?.ended_at) setEndedView(done)
  }, [active, history])

  const onLogin = (res: StaffLoginResponse) => {
    setAuth(res)
    setActive(res.active_drill)
    setEndedView(null)
    lastActiveId.current = null
  }

  if (restoring) {
    return <p className="pt-6 text-[16px] text-f-ink-2">Checking your sign in...</p>
  }

  if (!isTeacher || !classInfo) {
    return <StaffLogin onSuccess={onLogin} />
  }

  if (active) {
    return <RollcallForm key={active.id} drill={active} classInfo={classInfo} nodes={nodes} onSubmitted={setActive} />
  }

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div>
        <div className="text-[14px] text-f-ink-2 uppercase tracking-wider font-semibold">Class {classInfo.name}</div>
        {endedView ? (
          <>
            <h1 className="text-[28px] font-bold leading-tight text-f-ink mt-1">
              Drill ended at <span className="font-field-mono tabular-nums" title={fmtWallZoned(endedView.ended_at)}>{fmtWall(endedView.ended_at)}</span>. Thank you.
            </h1>
            <p className="text-[16px] text-f-ink-2 mt-2">This page switches back to roll call when the office starts another drill.</p>
          </>
        ) : (
          <>
            <h1 className="text-[28px] font-bold leading-tight text-f-ink mt-1">No drill running.</h1>
            <p className="text-[16px] text-f-ink-2 mt-2">This page switches to roll call when the office starts one.</p>
          </>
        )}
      </div>
      <div className="rounded-md border border-f-line bg-f-surface p-5">
        <div className="text-[14px] text-f-ink-2">Signed in for</div>
        <div className="text-[20px] font-semibold text-f-ink mt-0.5">Class {classInfo.name} · {classInfo.roster_size} students</div>
        <div className="text-[14px] text-f-ink-2 mt-1">
          Muster point {nodes.find((n) => n.id === classInfo.muster_node_id)?.label ?? classInfo.muster_node_id}
        </div>
      </div>
      {pollError && <p className="text-[14px] text-f-alarm">{pollError}</p>}
      <button
        type="button"
        onClick={() => { logout(); setActive(null); setEndedView(null) }}
        className="h-12 self-start px-4 rounded-sm text-[16px] font-semibold text-f-ink-2 underline-offset-4 hover:underline"
      >
        Use a different code
      </button>
    </div>
  )
}
