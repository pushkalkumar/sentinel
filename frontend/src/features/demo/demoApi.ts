// Client for the demo director endpoints. Same envelope as lib/api.ts (CONTRACT §0.2);
// kept here so lib/api.ts stays owned by its agent. Falls back to the stub in demoFallback.ts
// while GET /api/demo/script is not served yet.
import { useSessionStore } from '@/store/session'

export interface DemoChapter {
  id: string
  title: string
  caption: string
  duration_s: number
}
export interface DemoScript { chapters: DemoChapter[] }
export type DemoSource = 'api' | 'stub'

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export class DemoApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'DemoApiError'
    this.code = code
    this.status = status
  }
}

interface Envelope<T> { ok: boolean; data: T | null; error: { code: string; message: string } | null }

export interface DemoRequestOpts {
  body?: unknown
  /** Bearer override; `null` sends no bearer. Defaults to the session token. */
  token?: string | null
  headers?: Record<string, string>
}

export async function demoRequest<T>(path: string, opts: DemoRequestOpts = {}): Promise<T> {
  const { body, token } = opts
  const headers = new Headers({ Accept: 'application/json', ...(opts.headers ?? {}) })
  if (body !== undefined) headers.set('Content-Type', 'application/json')
  const bearer = token === undefined ? useSessionStore.getState().token : token
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new DemoApiError('NETWORK', 'Could not reach the server.', 0)
  }
  let env: Envelope<T> | null = null
  try {
    env = (await res.json()) as Envelope<T>
  } catch {
    env = null
  }
  if (!env || typeof env !== 'object' || !('ok' in env)) throw new DemoApiError('BAD_ENVELOPE', `Unexpected response (${res.status})`, res.status)
  if (!env.ok || env.data === null) {
    const err = env.error ?? { code: 'INTERNAL', message: 'Unknown error' }
    throw new DemoApiError(err.code, err.message, res.status)
  }
  return env.data
}

/** GET /api/demo/script → the ordered chapter list. Accepts `{chapters}` or a bare list. */
export async function getDemoScript(): Promise<DemoScript> {
  const data = await demoRequest<DemoScript | DemoChapter[]>('/api/demo/script')
  return Array.isArray(data) ? { chapters: data } : data
}

/** POST /api/demo/chapter → the backend stages that chapter (sim jump, incident, drill …). */
export const postDemoChapter = (id: string) => demoRequest<{ id: string }>('/api/demo/chapter', { body: { id } })

/** POST /api/demo/reset → calm morning, no open incidents, no active drill. */
export const postDemoReset = () => demoRequest<{ ok?: boolean }>('/api/demo/reset', { body: {} })
