// Client for the advisory endpoints (/api/ml/*, /api/ai/*). Same envelope as lib/api.ts (CONTRACT §0.2),
// kept here so lib/api.ts stays owned by its agent. Every payload carries `basis` and `human_decides`:
// rules and people decide, these annotate.
import { useSessionStore } from '@/store/session'
import type { IncidentType, NodeId } from '@/lib/types'

export type ModelClass = 'fire' | 'sky' | 'clear' | 'suspect'
export const MODEL_CLASSES: ModelClass[] = ['fire', 'sky', 'clear', 'suspect']

export interface FeatureContribution { name: string; value: number; contribution: number }

export interface ModelVerdict {
  p: Record<ModelClass, number> | null
  top_class: ModelClass | null
  top_features: FeatureContribution[]
  basis: string
  human_decides: string
  note?: string
}

export interface DriftNote { score: number; flagged: boolean; note: string }

export interface Assessment {
  node_id: NodeId
  site_id: number
  sim_ts: string | null
  n_readings: number
  features: Record<string, number> | null
  model: ModelVerdict
  drift: DriftNote
  rule_branch: string
  model_branch: string | null
  agreement: boolean | null
  authority: string
  human_decides: string
}

export interface ModelCard {
  name: string
  kind: string
  classes: ModelClass[]
  features: string[]
  training: Record<string, unknown>
  drift_detector: Record<string, unknown>
  limits: string[]
  authority: string
  basis: string
  human_decides: string
}

export interface TriageRequest { text: string; type?: IncidentType; count?: number }

/** Gemini output when live; the keyword ruling (type, count, urgency, fallback_reason) when not. */
export interface TriageResult {
  type: IncidentType
  count: number
  urgency: number
  people_detail?: string
  hazards?: string[]
  access_notes?: string
  language_detected?: string
  english_summary?: string
  basis?: string
  human_decides?: string
  fallback_reason?: string
  cached?: boolean
  reported_type: IncidentType | null
  reported_count: number | null
  rules: { type: IncidentType; count: number; urgency: number }
}

export interface Brief {
  site_id: number
  as_of: string
  facts: Record<string, unknown>
  brief: string
  draft?: string
  basis: string
  fallback_reason?: string
  cached?: boolean
  human_decides: string
}

export interface AiStatus {
  live: boolean
  model: string
  calls_used: number
  calls_last_minute: number
  cap_per_minute: number
  failures: number
  last_error: string | null
  cache_size: number
  key_env: string
}

const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

export class AiApiError extends Error {
  readonly code: string
  readonly status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.name = 'AiApiError'
    this.code = code
    this.status = status
  }
}

interface Envelope<T> { ok: boolean; data: T | null; error: { code: string; message: string } | null }

interface Opts {
  body?: unknown
  /** Bearer override; `null` sends none. Defaults to the session token. */
  token?: string | null
}

async function aiRequest<T>(path: string, opts: Opts = {}): Promise<T> {
  const headers = new Headers({ Accept: 'application/json' })
  if (opts.body !== undefined) headers.set('Content-Type', 'application/json')
  const bearer = opts.token === undefined ? useSessionStore.getState().token : opts.token
  if (bearer) headers.set('Authorization', `Bearer ${bearer}`)
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.body === undefined ? 'GET' : 'POST',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch {
    throw new AiApiError('NETWORK', 'Could not reach the server.', 0)
  }
  let env: Envelope<T> | null = null
  try {
    env = (await res.json()) as Envelope<T>
  } catch {
    env = null
  }
  if (!env || typeof env !== 'object' || !('ok' in env)) throw new AiApiError('BAD_ENVELOPE', `Unexpected response (${res.status})`, res.status)
  if (!env.ok || env.data === null) {
    const err = env.error ?? { code: 'INTERNAL', message: 'Unknown error' }
    throw new AiApiError(err.code, err.message, res.status)
  }
  return env.data
}

export const getAssess = (nodeId: NodeId) => aiRequest<Assessment>(`/api/ml/assess?node_id=${encodeURIComponent(nodeId)}`)
export const getModelCard = () => aiRequest<ModelCard>('/api/ml/model-card')
export const postTriage = (body: TriageRequest) => aiRequest<TriageResult>('/api/ai/triage', { body })
export const getBrief = (siteId: number, token?: string | null) => aiRequest<Brief>(`/api/ai/brief?site_id=${siteId}`, { token })
export const getAiStatus = () => aiRequest<AiStatus>('/api/ai/status')

/** True when the payload came from the model rather than the keyword or template fallback. */
export const isModelOutput = (r: { fallback_reason?: string }) => !r.fallback_reason
