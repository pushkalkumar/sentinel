// REST client for every endpoint in CONTRACT §3. Unwraps the envelope (§0.2) and throws ApiClientError.
import { getDeviceFp } from './fp'
import { useSessionStore } from '@/store/session'
import type {
  AirResponse, Alert, AuditEntry, CreateIncidentRequest, CreateIncidentResponse, DecisionCard, Drill, DrillKind,
  DrillReport, Envelope, ExplainResponse, Health, Incident, IncidentEventRequest, IncidentListResponse,
  IncidentPublic, IncidentStatus, ISO, LoginResponse, MeResponse, MeshLogEntry, Node, NodeDetail, NodeId,
  NodeReadings, PolicyPack, Recipient, RollcallRequest, SimAction, SimState, Site, SiteOverview, SmsOutbox,
  StaffLoginResponse, TimelineResponse, WeaDraft,
} from './types'

export class ApiClientError extends Error {
  readonly code: string
  readonly status: number
  readonly details: unknown

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
    this.status = status
    this.details = details
  }
}

export function isApiError(e: unknown, code?: string): e is ApiClientError {
  return e instanceof ApiClientError && (code === undefined || e.code === code)
}

/** Plain-English line for UI error states (DESIGN §10: say what to do, never "Error 500"). */
export function errorText(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.code === 'NETWORK') return 'Could not reach the server. Readings will catch up when it is back.'
    return e.message
  }
  return 'Something went wrong. Try again.'
}

// Empty in dev (Vite proxies /api); set VITE_API_BASE for hosted builds.
const BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '')

type Query = Record<string, string | number | boolean | undefined | null>

function qs(params?: Query): string {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

interface RequestOpts {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  /** Attach X-Device-Fp (phone endpoints). */
  deviceFp?: boolean
  /** Attach X-Node-Id from the session's picked node. */
  nodeId?: boolean
  /** Skip the bearer even if one is stored (civilian status page). */
  anonymous?: boolean
}

function buildHeaders(opts: RequestOpts): Headers {
  const h = new Headers({ Accept: 'application/json' })
  if (opts.body !== undefined) h.set('Content-Type', 'application/json')
  if (!opts.anonymous) {
    const token = useSessionStore.getState().token
    if (token) h.set('Authorization', `Bearer ${token}`)
  }
  if (opts.deviceFp) h.set('X-Device-Fp', getDeviceFp())
  if (opts.nodeId) {
    const picked = useSessionStore.getState().pickedNodeId
    if (picked) h.set('X-Node-Id', picked)
  }
  return h
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method ?? 'GET',
      headers: buildHeaders(opts),
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch (e) {
    throw new ApiClientError('NETWORK', 'Could not reach the server.', 0, e)
  }

  let env: Envelope<T> | null = null
  try {
    env = (await res.json()) as Envelope<T>
  } catch {
    env = null
  }

  if (!env || typeof env !== 'object' || !('ok' in env)) {
    throw new ApiClientError(res.ok ? 'BAD_ENVELOPE' : 'INTERNAL', `Unexpected response (${res.status})`, res.status)
  }
  if (!env.ok) {
    const err = env.error ?? { code: 'INTERNAL', message: 'Unknown error' }
    throw new ApiClientError(err.code, err.message, res.status, err.details)
  }
  return env.data
}

// ---- auth -------------------------------------------------------------------
export const login = (email: string, password: string) =>
  request<LoginResponse>('/api/auth/login', { method: 'POST', body: { email, password }, anonymous: true })

export const staffLogin = (staffCode: string) =>
  request<StaffLoginResponse>('/api/auth/staff', { method: 'POST', body: { staff_code: staffCode }, anonymous: true })

export const me = () => request<MeResponse>('/api/auth/me')

// ---- nodes ------------------------------------------------------------------
export const listNodes = (siteId?: number) => request<Node[]>(`/api/nodes${qs({ site_id: siteId })}`)

export const getNode = (id: NodeId) => request<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`)

export const getNodeReadings = (id: NodeId, minutes = 60, limit = 500) =>
  request<NodeReadings>(`/api/nodes/${encodeURIComponent(id)}/readings${qs({ minutes, limit })}`)

export const getExplain = (nodeId: NodeId, at?: ISO | null) =>
  request<ExplainResponse>(`/api/nodes/${encodeURIComponent(nodeId)}/explain${qs({ at })}`)

// ---- sites ------------------------------------------------------------------
export const listSites = () => request<Site[]>('/api/sites')

export const getOverview = (siteId: number) => request<SiteOverview>(`/api/sites/${siteId}/overview`)

export const getAir = (siteId: number, minutes = 180, step = 5) =>
  request<AirResponse>(`/api/sites/${siteId}/air${qs({ minutes, step })}`)

export const getDecisionCard = (siteId: number) => request<DecisionCard>(`/api/sites/${siteId}/decision-card`)

export const getTimeline = (siteId: number, stepS = 300) =>
  request<TimelineResponse>(`/api/timeline${qs({ site_id: siteId, step: stepS })}`)

// ---- alerts / sms / thresholds ---------------------------------------------
export const listAlerts = (opts: { open?: boolean; siteId?: number; limit?: number } = {}) =>
  request<Alert[]>(`/api/alerts${qs({ open: opts.open, site_id: opts.siteId, limit: opts.limit })}`)

export const getSmsOutbox = (siteId?: number, limit = 200) =>
  request<SmsOutbox>(`/api/sms/outbox${qs({ site_id: siteId, limit })}`)

export const listRecipients = (zoneId?: number) => request<Recipient[]>(`/api/recipients${qs({ zone_id: zoneId })}`)

export const addRecipient = (zoneId: number, phoneE164: string, label: string) =>
  request<Recipient>(`/api/zones/${zoneId}/recipients`, { method: 'POST', body: { phone_e164: phoneE164, label } })

export const getThresholds = (tenantId: number) => request<PolicyPack>(`/api/tenants/${tenantId}/thresholds`)

export const putThresholds = (tenantId: number, patch: Partial<PolicyPack>) =>
  request<PolicyPack>(`/api/tenants/${tenantId}/thresholds`, { method: 'PUT', body: patch })

// ---- incidents --------------------------------------------------------------
export const createIncident = (req: CreateIncidentRequest) =>
  request<CreateIncidentResponse>('/api/incidents', { method: 'POST', body: req, deviceFp: true, nodeId: true })

export const getIncident = (code: string) =>
  request<Incident>(`/api/incidents/${encodeURIComponent(code)}`, { deviceFp: true })

export const getIncidentPublic = (code: string) =>
  request<IncidentPublic>(`/api/incidents/${encodeURIComponent(code)}`, { deviceFp: true, anonymous: true })

export const listIncidents = (
  opts: { status?: 'open' | 'all' | IncidentStatus; sort?: 'priority' | 'newest' | 'trust'; siteId?: number; limit?: number } = {},
) => request<IncidentListResponse>(`/api/incidents${qs({ status: opts.status, sort: opts.sort, site_id: opts.siteId, limit: opts.limit })}`)

export const postIncidentEvent = (code: string, req: IncidentEventRequest) =>
  request<Incident>(`/api/incidents/${encodeURIComponent(code)}/events`, { method: 'POST', body: req })

export const getAudit = (limit = 200) => request<{ events: AuditEntry[] }>(`/api/responder/audit${qs({ limit })}`)

export const getWeaDraft = (alertId: number) => request<WeaDraft>(`/api/wea/draft${qs({ alert_id: alertId })}`)

// ---- mesh / sim -------------------------------------------------------------
export const getMeshLog = (limit = 100, msgId?: string) =>
  request<{ entries: MeshLogEntry[] }>(`/api/mesh/log${qs({ limit, msg_id: msgId })}`)

export const simControl = (action: SimAction) => request<SimState>('/api/sim/control', { method: 'POST', body: action })

export const getSimState = () => request<SimState | { connected: false }>('/api/sim/state')

// ---- drills -----------------------------------------------------------------
export const createDrill = (siteId: number, kind: DrillKind) =>
  request<Drill>('/api/drills', { method: 'POST', body: { site_id: siteId, kind } })

export const listDrills = (siteId: number, limit = 20) => request<Drill[]>(`/api/drills${qs({ site_id: siteId, limit })}`)

export const getActiveDrill = (siteId: number) => request<Drill | null>(`/api/drills/active${qs({ site_id: siteId })}`)

export const getDrill = (id: number) => request<Drill>(`/api/drills/${id}`)

export const submitRollcall = (drillId: number, req: RollcallRequest) =>
  request<Drill>(`/api/drills/${drillId}/rollcall`, { method: 'POST', body: req })

export const endDrill = (id: number) => request<Drill>(`/api/drills/${id}/end`, { method: 'POST' })

export const getDrillReport = (id: number) => request<DrillReport>(`/api/drills/${id}/report`)

/** Used as an <a href download>, never fetched. */
export const drillCsvUrl = (id: number): string => `/api/export/drill/${id}.csv`

// ---- misc -------------------------------------------------------------------
export const getHealth = () => request<Health>('/api/health')
