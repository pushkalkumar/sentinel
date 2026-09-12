// Stub director used while GET /api/demo/script is not served (404). Mirrors backend/app/demo.py
// (same chapter ids, captions and roll-call plan) but stages each chapter from the browser against
// the endpoints that already exist (CONTRACT §3.6 to §3.8). demoStore prefers the API when it answers.
import type { Drill, Incident, SimAction, SimState } from '@/lib/types'
import { getDeviceFp } from '@/lib/fp'
import { demoRequest, type DemoScript } from './demoApi'

export const STUB_SCRIPT: DemoScript = {
  chapters: [
    { id: 'calm', title: 'A normal morning', caption: "07:30 at Roosevelt High. Eight nodes, all green, practice is on. Every emergency app assumes the internet exists; Sentinel doesn't.", duration_s: 8 },
    { id: 'smoke', title: 'Smoke afternoon', caption: "Jump to 13:55. Every node climbs together. That's the sky, not the building, so the card cancels practice and nothing else happens.", duration_s: 12 },
    { id: 'fire', title: 'One node spikes', caption: 'Fire in the gym. One node climbing while its neighbours stay flat is a fire in that aisle. LOCAL_FIRE opens, the alarm hops gym to science to hub.', duration_s: 12 },
    { id: 'report', title: 'A judge reports from the gym', caption: "A phone on the gym node's own WiFi sends: trapped, two people, storage room, door jammed. Trust score verified because proximity and the sensor agree. The report relays to the hub.", duration_s: 12 },
    { id: 'responder', title: 'Responder closes the loop', caption: "Lt. Reyes acknowledges, goes en route with a note, then resolves: crew 3 walked both out. Every action lands in the audit log with an IP, and the phone's receipt updates live.", duration_s: 10 },
    { id: 'drill', title: 'Fire drill roll call', caption: 'A sentinel that only wakes up for the disaster is asleep when it matters. Six classes muster; four report complete, 5A has one missing, 3B has two.', duration_s: 14 },
    { id: 'allclear', title: 'All clear', caption: 'Overrides clear, readings decay, the engine closes its own alerts a few minutes later. Nothing here needed the internet.', duration_s: 8 },
  ],
}

const GYM = 'gym'
const SITE_ID = 1
const RESPONDER_EMAIL = 'responder@sentinel.demo'
const DEMO_PASSWORD = 'sentinel'
const PACE_MS = 1200
/** The judge's report; the triage card on /demo runs the same text through Gemini. */
export const REPORT = { type: 'trapped' as const, count: 2, text: 'Gym storage room, door jammed' }
const EN_ROUTE_NOTE = 'Engine 17 on scene in 4 min, crew 3 entering from the south door'
const RESOLVE_NOTE = 'Crew 3 walked both out'
/** Submission order matters for the story: clean classes first, the one with two missing last. */
const ROLLCALL_PLAN: [string, string[]][] = [
  ['4A', []], ['3A', []], ['5B', []], ['4B', []], ['5A', ['S-5A-12']], ['3B', ['S-3B-07', 'S-3B-19']],
]

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const swallow = (p: Promise<unknown>) => p.catch(() => undefined)

const sim = (action: SimAction) => demoRequest<SimState>('/api/sim/control', { body: action })

let responderToken: string | null = null
/** Responder-only actions (acknowledge, en_route, resolve) need a responder bearer (CONTRACT §2.3). */
export async function responder(): Promise<string | null> {
  if (responderToken) return responderToken
  try {
    const r = await demoRequest<{ token: string }>('/api/auth/login', { body: { email: RESPONDER_EMAIL, password: DEMO_PASSWORD }, token: null })
    responderToken = r.token
  } catch {
    responderToken = null
  }
  return responderToken
}

async function openIncidents(): Promise<Incident[]> {
  try {
    const r = await demoRequest<{ incidents: Incident[] }>('/api/incidents?status=open&sort=newest')
    return r.incidents
  } catch {
    return []
  }
}

async function incidentEvent(code: string, action: 'acknowledge' | 'en_route' | 'resolve', note: string): Promise<void> {
  const token = await responder()
  if (!token) return
  await swallow(demoRequest(`/api/incidents/${encodeURIComponent(code)}/events`, { body: { action, note }, token }))
}

async function activeDrill(): Promise<Drill | null> {
  try {
    return await demoRequest<Drill | null>(`/api/drills/active?site_id=${SITE_ID}`)
  } catch {
    return null
  }
}

async function endActiveDrill(): Promise<void> {
  const d = await activeDrill()
  if (d) await swallow(demoRequest(`/api/drills/${d.id}/end`, { body: {} }))
}

async function resolveOpen(note: string): Promise<void> {
  const open = await openIncidents()
  for (const inc of open) await incidentEvent(inc.code, 'resolve', note)
}

async function calm(): Promise<void> {
  await swallow(sim({ action: 'jump', t: 'calm' }))
  await swallow(sim({ action: 'speed', speed: 60 }))
  await swallow(sim({ action: 'play' }))
}

const STAGE: Record<string, () => Promise<void>> = {
  calm: async () => {
    await endActiveDrill()
    await resolveOpen('Demo reset')
    await calm()
  },
  smoke: async () => {
    await swallow(sim({ action: 'clear' }))
    await swallow(sim({ action: 'jump', t: 'smoke' }))
  },
  fire: async () => {
    await swallow(sim({ action: 'trigger_fire', node_id: GYM }))
  },
  report: async () => {
    const [existing] = await openIncidents()
    if (existing) return
    await swallow(demoRequest('/api/incidents', { body: REPORT, headers: { 'X-Device-Fp': getDeviceFp(), 'X-Node-Id': GYM } }))
  },
  responder: async () => {
    const [latest] = await openIncidents()
    if (!latest) return
    await incidentEvent(latest.code, 'acknowledge', '')
    await sleep(PACE_MS)
    await incidentEvent(latest.code, 'en_route', EN_ROUTE_NOTE)
    await sleep(PACE_MS)
    await incidentEvent(latest.code, 'resolve', RESOLVE_NOTE)
  },
  drill: async () => {
    let drill = await activeDrill()
    if (!drill) {
      try {
        drill = await demoRequest<Drill>('/api/drills', { body: { site_id: SITE_ID, kind: 'fire' } })
      } catch {
        return
      }
    }
    const byName = new Map(drill.classes.map((c) => [c.name, c]))
    let first = true
    for (const [name, missing] of ROLLCALL_PLAN) {
      const cls = byName.get(name)
      if (!cls) continue
      if (!first) await sleep(PACE_MS)
      first = false
      await swallow(demoRequest(`/api/drills/${drill.id}/rollcall`, {
        body: { class_id: cls.class_id, node_id: cls.muster_node_id, present: cls.roster_size - missing.length, missing_refs: missing },
      }))
    }
    await sleep(PACE_MS)
    await swallow(demoRequest(`/api/drills/${drill.id}/end`, { body: {} }))
  },
  allclear: async () => {
    await swallow(sim({ action: 'clear' }))
  },
}

export async function stageStubChapter(id: string): Promise<void> {
  const stage = STAGE[id]
  if (stage) await stage()
}

export async function stubReset(): Promise<void> {
  await endActiveDrill()
  await resolveOpen('Demo reset')
  await calm()
}
