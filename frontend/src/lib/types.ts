// ---- primitives -------------------------------------------------------------
export type ISO = string;            // "2026-09-12T13:55:00.000Z"  (tag in comments: sim | wall)
export type NodeId = string;         // "gym"
export type IncidentCode = string;   // "SN-7K3F"

export type Role = 'admin' | 'teacher' | 'responder';
export type Actor = Role | 'civilian' | 'system';
export type TenantType = 'school' | 'warehouse' | 'neighbourhood' | 'agency';
export type SiteKind = 'campus' | 'floorplan';

export type BandKey = 'good' | 'moderate' | 'usg' | 'unhealthy' | 'very_unhealthy' | 'hazardous';
export const BAND_ORDER: BandKey[] = ['good', 'moderate', 'usg', 'unhealthy', 'very_unhealthy', 'hazardous'];

export type NodeStatus = 'ok' | 'watch' | 'alert' | 'offline';
export type AlertKind = 'LOCAL_FIRE' | 'HAZARDOUS_SMOKE' | 'LOCAL_SMOKE_SUSPECT' | 'ACTIVITY_ADVISORY';
export type IncidentType = 'safe' | 'water' | 'medical' | 'trapped' | 'fire' | 'other';
export type IncidentStatus = 'received' | 'acknowledged' | 'en_route' | 'resolved' | 'false' | 'queued';
export type TrustLabel = 'verified' | 'likely' | 'unverified';
export type TrustLayer = 'proximity' | 'sensor' | 'crowd' | 'role' | 'gps' | 'history' | 'cap';
export type IncidentAction = 'created' | 'relayed' | 'acknowledge' | 'en_route' | 'resolve' | 'flag_false' | 'message';
export type ResponderAction = Exclude<IncidentAction, 'created' | 'relayed'>;
export type DrillKind = 'fire' | 'earthquake' | 'lockdown';
export type ClassState = 'pending' | 'matched' | 'missing';
export type HopStatus = 'ok' | 'dropped' | 'retry' | 'delivered' | 'failed';
export type MeshKind = 'incident' | 'alarm' | 'telemetry';
export type SimPhase = 'calm' | 'smoke' | 'clearing' | 'fire';
export type SimSpeed = 1 | 10 | 60 | 300;

// ---- envelope ---------------------------------------------------------------
export interface ApiError { code: string; message: string; details?: unknown }
export type Envelope<T> = { ok: true; data: T; error: null } | { ok: false; data: null; error: ApiError };

// ---- auth -------------------------------------------------------------------
export interface Tenant { id: number; name: string; type: TenantType }
export interface User { id: number; name: string; email: string | null; role: Role; tenant: Tenant; site_id: number }
export interface ClassInfo { id: number; name: string; site_id: number; muster_node_id: NodeId; roster: string[]; roster_size: number }
export interface LoginResponse { token: string; role: 'admin' | 'responder'; user: User }
export interface StaffLoginResponse { token: string; role: 'teacher'; user: User; class: ClassInfo; active_drill: Drill | null }
export type MeResponse = LoginResponse | StaffLoginResponse;

// ---- readings / nodes -------------------------------------------------------
export interface Reading {
  ts: ISO;                  // sim
  pm1: number; pm25: number; pm10: number;
  temp_c: number; rh: number; mq2_raw: number;
  rssi: number; battery_pct: number;
}
export interface ReadingEvent extends Reading { node_id: NodeId; site_id: number; band: BandKey }

export interface Alert {
  id: number; tenant_id: number; site_id: number; zone_id: number; node_id: NodeId | null;
  kind: AlertKind; priority: 1 | 2 | 3 | 4;
  band_from: BandKey | null; band_to: BandKey | null;
  reason: string;
  metrics: { pm25: number; pm_rise: number; temp_rise: number; gas_delta: number; regional: number; rolling_pm25?: number };
  started_at: ISO;          // sim
  cleared_at: ISO | null;   // sim
  node_label: string | null; zone_name: string;
}

export interface Node {
  id: NodeId; site_id: number; zone_id: number; label: string;
  lat: number; lng: number; map_x: number; map_y: number;
  floor: number | null; indoor: boolean; is_gateway: boolean; neighbours: NodeId[];
  fw_version: string; last_seen: ISO | null;     // sim
  battery_pct: number | null; rssi: number | null;
  status: NodeStatus; band: BandKey | null;
  latest: Reading | null;
  open_alerts: Alert[];
}
export interface NodeBanner { band: BandKey | null; band_label: string; alert: Alert | null; text: string }
export interface NodeDetail extends Node {
  site: { id: number; name: string; kind: SiteKind };
  zone: { id: number; name: string };
  ssid: string;
  banner: NodeBanner;
}
export interface NodeReadings { node_id: NodeId; minutes: number; readings: Reading[] }
export interface NodeStatusEvent {
  node_id: NodeId; site_id: number; status: NodeStatus; band: BandKey | null;
  battery_pct: number | null; rssi: number | null; last_seen: ISO | null; open_alert_kinds: AlertKind[];
}

// ---- sites ------------------------------------------------------------------
export interface Site {
  id: number; tenant_id: number; name: string; kind: SiteKind;
  map_asset: string; floor_plan_url: string | null; view_box?: string;
  address: string; access_notes?: string; node_count?: number; zone_count?: number;
}
export interface Zone { id: number; name: string; map_poly: [number, number][]; recipient_count: number; node_ids: NodeId[] }

export interface DecisionLogEntry {
  at: ISO;                  // sim
  band_from: BandKey | null; band_to: BandKey; pm25: number;
  node_id: NodeId; node_label: string; guidance: string; text: string;
}
export interface DecisionCard {
  site_id: number; band: BandKey; pm25: number; node_id: NodeId; node_label: string;
  headline: string; guidance: string;
  changed_at: ISO; as_of: ISO;   // sim
  window_minutes: number;
  log: DecisionLogEntry[];
}

export interface SiteStats { nodes_online: number; nodes_alerting: number; open_incidents: number; sms_sent_today: number; recipients: number }
export interface SiteOverview {
  site: Site; tenant: Tenant; zones: Zone[]; nodes: Node[];
  links: [NodeId, NodeId][];
  decision_card: DecisionCard | null;
  open_alerts: Alert[]; open_incidents: Incident[];
  active_drill: Drill | null;
  stats: SiteStats;
  sim: SimState | null;
}
export interface AirSeriesPoint { ts: ISO; pm25: number; temp_c: number }
export interface AirResponse {
  site_id: number; minutes: number; step: number;
  series: { node_id: NodeId; label: string; indoor: boolean; points: AirSeriesPoint[] }[];
  regional: { ts: ISO; pm25: number }[];
  band_history: DecisionLogEntry[];
}

// ---- thresholds -------------------------------------------------------------
export interface BandDef { key: BandKey; label: string; max: number | null; color: string; headline: string; guidance: string }
export interface PolicyPack {
  bands: BandDef[];
  pm_rise: number; temp_rise: number; gas_delta: number; regional_factor: number;
  hazardous_pm25: number; hazardous_regional: number;
  rolling_minutes: number; sms_dedup_minutes: number; all_clear_minutes: number; clear_after_minutes: number;
}

// ---- sms --------------------------------------------------------------------
export interface SmsMessage {
  id: number; alert_id: number; alert_kind: AlertKind | 'ALL_CLEAR'; zone_id: number; zone_name: string;
  phone_e164: string; recipient_label: string; severity: 0 | 1 | 2 | 3 | 4;
  body: string; status: 'simulated'; provider_msg_id: string;
  sent_at: ISO;   // wall
  sim_at: ISO;    // sim
}
export interface SmsOutbox { provider: 'disabled'; label: string; count: number; messages: SmsMessage[] }
export interface Recipient { id: number; zone_id: number; zone_name: string; phone_e164: string; label: string; consent_at: ISO; opted_out_at: ISO | null }

// ---- incidents --------------------------------------------------------------
export interface TrustLine { layer: TrustLayer; points: number; note: string }
export interface IncidentEvent {
  id: number; action: IncidentAction; actor_role: Actor; actor_user_id: number | null; actor_name: string | null;
  note: string; at: ISO; ip: string;   // wall
}
export interface IncidentMesh { msg_id: string; path: NodeId[]; delivered: boolean; hops: number }
export interface Incident {
  code: IncidentCode; tenant_id: number; site_id: number | null; node_id: NodeId | null; node_label: string | null;
  via: 'node' | 'internet'; type: IncidentType; count: number; text: string;
  lat: number | null; lng: number | null;
  reporter_role: Role | null; priority: 1 | 2 | 3 | 4 | 5;
  trust_score: number; trust_label: TrustLabel; trust_breakdown: TrustLine[];
  status: IncidentStatus;
  created_at: ISO; updated_at: ISO;   // wall
  mesh: IncidentMesh | null;
  events: IncidentEvent[];
}
export interface IncidentPublic {
  code: IncidentCode; type: IncidentType; count: number; status: IncidentStatus;
  node_label: string | null; trust_label: TrustLabel;
  created_at: ISO; updated_at: ISO;
  timeline: { action: IncidentAction; at: ISO; note: string }[];
}
export interface CreateIncidentRequest { type: IncidentType; count: number; text?: string; lat?: number; lng?: number }
export interface CreateIncidentResponse {
  code: IncidentCode; status: IncidentStatus; trust_score: number; trust_label: TrustLabel;
  node_id: NodeId | null; node_label: string | null; via: 'node' | 'internet'; created_at: ISO; message: string;
}
export interface IncidentListResponse { count: number; incidents: Incident[] }
export interface IncidentEventRequest { action: ResponderAction; note: string }
export interface IncidentEventMessage { code: IncidentCode; status: IncidentStatus; event: IncidentEvent; incident: Incident }
export interface AuditEntry {
  id: number; at: ISO; incident_code: IncidentCode; action: IncidentAction;
  actor_name: string | null; actor_role: Actor; ip: string; note: string;
}
export interface WeaDraft {
  alert_id: number; kind: AlertKind; event_code: string;
  severity: string; urgency: string; certainty: string;
  headline: string; text_90: string; text_360: string;
  polygon: GeoJSON.Polygon | Record<string, unknown>; area_description: string;
  sender: string; sent_time: null; disclaimer: string;
}

// ---- mesh / sim -------------------------------------------------------------
export interface MeshLogEntry {
  id: number; msg_id: string; origin_node: NodeId; kind: MeshKind;
  hop_from: NodeId; hop_to: NodeId; attempt: number; status: HopStatus;
  path: NodeId[]; ttl: number; payload: Record<string, unknown>;
  ts: ISO;   // wall
}
export interface SimState {
  connected: boolean; playing: boolean; speed: SimSpeed;
  sim_t: number; sim_ts: ISO; sim_clock: string; phase: SimPhase;
  regional_pm25: number;
  overrides: { fire_nodes: NodeId[]; smoke_boost: boolean };
  drop_rate: number; ttl: number; tick_s: number;
  nodes: Record<NodeId, { pm25: number; temp_c: number; mq2_raw: number }>;
  messages_in_flight: number;
  wall_ts: ISO;
}
export type SimAction =
  | { action: 'play' } | { action: 'pause' } | { action: 'clear' } | { action: 'trigger_smoke' }
  | { action: 'speed'; speed: SimSpeed }
  | { action: 'jump'; t: 'calm' | 'smoke' | 'fire' | number | string }
  | { action: 'trigger_fire'; node_id: NodeId };

// ---- drills -----------------------------------------------------------------
export interface Rollcall {
  id: number; node_id: NodeId; node_label: string; present: number; missing_refs: string[];
  submitted_at: ISO; elapsed_s: number;   // wall
}
export interface DrillClass {
  class_id: number; name: string; teacher_name: string; roster_size: number; muster_node_id: NodeId;
  state: ClassState; rollcall: Rollcall | null;
}
export interface DrillSummary {
  classes: number; submitted: number; matched: number; with_missing: number; pending: number;
  present_total: number; missing_total: number; roster_total: number;
}
export interface MissingStudent { student_ref: string; class_name: string; node_label: string }
export interface Drill {
  id: number; site_id: number; kind: DrillKind; is_real: boolean;
  started_at: ISO; ended_at: ISO | null; started_by: number | null;   // wall
  elapsed_s: number;
  summary: DrillSummary;
  classes: DrillClass[];
  missing: MissingStudent[];
}
export interface RollcallRequest { class_id: number; node_id: NodeId; present: number; missing_refs: string[] }
export interface RollcallMessage { drill_id: number; class_id: number; rollcall: Rollcall; summary: DrillSummary; missing: MissingStudent[] }
export interface DrillReport {
  drill: Drill; site: { name: string; address: string }; started_by_name: string | null; duration_s: number;
  compliance: { statute: string; kind: DrillKind; all_classes_reported: boolean; time_to_full_rollcall_s: number | null };
  classes: DrillClass[]; missing: MissingStudent[]; generated_at: ISO;
}

// ---- health -----------------------------------------------------------------
export interface Health { status: 'ok'; db: boolean; sim_connected: boolean; ws_clients: number; version: string; wall_now: ISO }

// ---- websocket --------------------------------------------------------------
export interface HelloMessage { server_time: ISO; sim: SimState | null; ws_clients: number; role: Actor }
export type LiveMessage =
  | { type: 'hello'; ts: ISO; data: HelloMessage }
  | { type: 'reading'; ts: ISO; data: ReadingEvent }
  | { type: 'node_status'; ts: ISO; data: NodeStatusEvent }
  | { type: 'alert'; ts: ISO; data: Alert }
  | { type: 'alert_cleared'; ts: ISO; data: Alert }
  | { type: 'decision_card'; ts: ISO; data: DecisionCard }
  | { type: 'sms_sent'; ts: ISO; data: SmsMessage }
  | { type: 'incident_created'; ts: ISO; data: Incident }
  | { type: 'incident_event'; ts: ISO; data: IncidentEventMessage }
  | { type: 'hop'; ts: ISO; data: MeshLogEntry }
  | { type: 'drill_started'; ts: ISO; data: Drill }
  | { type: 'rollcall'; ts: ISO; data: RollcallMessage }
  | { type: 'drill_ended'; ts: ISO; data: Drill }
  | { type: 'sim_state'; ts: ISO; data: SimState }
  | { type: 'pong'; ts: ISO; data: Record<string, never> };
export type LiveMessageType = LiveMessage['type'];

// ---- display helpers (pure constants, safe to import anywhere) --------------
export const INCIDENT_TYPE_LABEL: Record<IncidentType, string> = {
  safe: "I'm safe", water: 'Need water', medical: 'Need medical', trapped: 'Trapped', fire: 'Fire', other: 'Other',
};
export const INCIDENT_PRIORITY: Record<IncidentType, 1 | 2 | 3 | 4 | 5> = { fire: 1, trapped: 1, medical: 2, water: 3, other: 4, safe: 5 };
export const STATUS_LABEL: Record<IncidentStatus, string> = {
  received: 'Received', acknowledged: 'Acknowledged by responder', en_route: 'En route', resolved: 'Resolved', false: 'Flagged false', queued: 'Queued for staff confirmation',
};
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

// ---- Time Machine (NOVELTY §3.1) ------------------------------------------
export interface TimelineReading { node_id: NodeId; sim_ts: ISO; pm25: number; temp_c: number; band: BandKey }
export interface TimelineResponse {
  site_id: number; step_s: number; from: ISO; to: ISO; sim_now: ISO | null;
  readings: TimelineReading[];
  alerts: Pick<Alert, 'id' | 'kind' | 'priority' | 'node_id' | 'node_label' | 'started_at' | 'cleared_at' | 'reason'>[];
  decisions: DecisionLogEntry[];
  incidents: { code: IncidentCode; type: IncidentType; sim_at: ISO | null; trust_score: number; status: IncidentStatus; node_id: NodeId | null }[];
}
// ---- Sky vs Building (NOVELTY §3.2) ---------------------------------------
export interface ExplainCheck { name: string; expr: string; lhs: number; op: string; rhs: number; pass: boolean }
export interface ExplainResponse {
  node: Pick<Node, 'id' | 'label' | 'site_id' | 'indoor'>;
  at: ISO; branch: 'LOCAL_FIRE' | 'HAZARDOUS_SMOKE' | 'LOCAL_SMOKE_SUSPECT' | 'CLEAR';
  verdict: string;
  eval: { pm25: number; pm_rise: number; temp_rise: number; gas_delta: number; regional: number; ratio: number };
  neighbours: { id: NodeId; label: string; pm25: number }[];
  checks: ExplainCheck[];
  thresholds: Pick<PolicyPack, 'pm_rise' | 'temp_rise' | 'gas_delta' | 'regional_factor' | 'hazardous_pm25' | 'hazardous_regional'>;
  outlier: boolean;
}
