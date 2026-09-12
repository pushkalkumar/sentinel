import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { X } from 'lucide-react'
import type { Alert, NodeId, WeaDraft } from '@/lib/types'
import { errorText, getWeaDraft, listAlerts } from '@/lib/api'
import { useUiStore } from '@/store/ui'
import { useSiteStore } from '@/store/site'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { CharCounter } from './CharCounter'
import { PolygonPreview } from './PolygonPreview'

const LIMIT_90 = 90
const LIMIT_360 = 360

/** Fields backend-alerts adds beyond CONTRACT §3.6 (BUILD_PLAN §2.2); optional until lib/types.ts carries them. */
type WeaDraftFull = WeaDraft & {
  cap_xml?: string
  eligible?: boolean
  eligibility_note?: string
  vertex_count?: number
  nodes_affected?: number
}

function ringLength(polygon: WeaDraft['polygon']): number {
  const coords = (polygon as { coordinates?: unknown }).coordinates
  if (!Array.isArray(coords) || !Array.isArray(coords[0])) return 0
  return (coords[0] as unknown[]).length
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-mono text-sm text-ink truncate mt-0.5" title={value}>{value}</dd>
    </div>
  )
}

function Field({ id, label, limit, value, onChange, rows }: { id: string; label: string; limit: number; value: string; onChange: (v: string) => void; rows: number }) {
  return (
    <label htmlFor={id} className="block min-w-0">
      <span className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-ink-2">{label}</span>
        <CharCounter count={value.length} limit={limit} />
      </span>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={value.length > limit || undefined}
        className="w-full rounded-md bg-raised text-ink px-3.5 py-2.5 text-base leading-6 outline-none focus:shadow-[0_0_0_2px_var(--color-accent-line)] resize-y transition-[box-shadow] duration-[120ms]"
      />
    </label>
  )
}

function ModalBody({ alertId }: { alertId: number }) {
  const toast = useUiStore((s) => s.toast)
  const zones = useSiteStore((s) => s.zones)
  const nodesById = useSiteStore((s) => s.nodes)
  const openAlerts = useSiteStore((s) => s.openAlerts)
  const viewBox = useSiteStore((s) => s.site?.view_box)
  const siteId = useSiteStore((s) => s.site?.id)

  const [draft, setDraft] = useState<WeaDraftFull | null>(null)
  const [alert, setAlert] = useState<Alert | null>(null)
  const [text90, setText90] = useState('')
  const [text360, setText360] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getWeaDraft(alertId)
      .then((d) => {
        if (cancelled) return
        const full = d as WeaDraftFull
        setDraft(full)
        setText90(full.text_90)
        setText360(full.text_360)
      })
      .catch((e) => { if (!cancelled) setError(errorText(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [alertId])

  // The draft has no zone id; the alert does. Live store first, then one fetch for a cleared alert.
  useEffect(() => {
    const live = openAlerts.find((a) => a.id === alertId)
    if (live) { setAlert(live); return }
    let cancelled = false
    listAlerts({ siteId: siteId ?? undefined, limit: 200 })
      .then((list) => { if (!cancelled) setAlert(list.find((a) => a.id === alertId) ?? null) })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [alertId, openAlerts, siteId])

  const zone = useMemo(() => (alert ? zones.find((z) => z.id === alert.zone_id) ?? null : null), [zones, alert])
  const nodes = useMemo(() => Object.values(nodesById), [nodesById])
  const affectedIds = useMemo<NodeId[]>(() => {
    const ids = new Set<NodeId>()
    if (alert?.node_id) ids.add(alert.node_id)
    for (const a of openAlerts) {
      if (a.priority <= 2 && a.node_id && (!zone || a.zone_id === zone.id)) ids.add(a.node_id)
    }
    return [...ids]
  }, [alert, openAlerts, zone])

  const copy = useCallback(async (label: string, text: string | undefined) => {
    if (!text) { toast('Nothing to copy yet'); return }
    const ok = await copyText(text)
    toast(ok ? 'Copied' : `Could not copy ${label}. Select the text and copy it by hand.`)
  }, [toast])

  if (loading && !draft) return <div className="p-6"><Skeleton className="w-64" /></div>
  if (error && !draft) return <p className="p-6 text-sm text-alarm">{error}</p>
  if (!draft) return <p className="p-6 text-sm text-ink-3">No draft for this alert.</p>

  const eligible = draft.eligible ?? true
  const vertexCount = draft.vertex_count ?? ringLength(draft.polygon)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr] gap-10 px-8 pt-2 pb-8 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-6 min-w-0">
          {!eligible && draft.eligibility_note && (
            <p className="rounded-md bg-warn-dim text-warn text-sm px-3.5 py-2.5">{draft.eligibility_note}</p>
          )}
          <h3 className="display-h2 text-xl text-ink text-balance">{draft.headline}</h3>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3">
            <Fact label="Event" value={draft.event_code} />
            <Fact label="Severity" value={draft.severity} />
            <Fact label="Urgency" value={draft.urgency} />
            <Fact label="Certainty" value={draft.certainty} />
          </dl>
          <Field id="wea-90" label="Short text, 90 characters" limit={LIMIT_90} value={text90} onChange={setText90} rows={2} />
          <Field id="wea-360" label="Long text, 360 characters" limit={LIMIT_360} value={text360} onChange={setText360} rows={7} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
            <dt className="text-ink-3">Sender</dt><dd className="text-ink-2 truncate" title={draft.sender}>{draft.sender}</dd>
            <dt className="text-ink-3">Area</dt><dd className="text-ink-2">{draft.area_description}</dd>
          </dl>
        </div>
        <PolygonPreview zone={zone} nodes={nodes} affectedIds={affectedIds} vertexCount={vertexCount} viewBox={viewBox} />
      </div>
      <footer className="shrink-0 flex flex-col gap-4 px-8 py-5 bg-raised md:flex-row md:items-center">
        <p className="text-xs text-ink-3 md:flex-1 md:min-w-0 text-pretty">{draft.disclaimer}</p>
        <div className="flex flex-wrap items-center gap-1 shrink-0">
          <Button variant="ghost" onClick={() => void copy('the CAP XML', draft.cap_xml)} disabled={!draft.cap_xml}>Copy CAP XML</Button>
          <Button variant="ghost" onClick={() => void copy('the 90 character text', text90)}>Copy short text</Button>
          <Button variant="primary" className="ml-2" onClick={() => void copy('the 360 character text', text360)}>Copy long text</Button>
        </div>
      </footer>
    </>
  )
}

/** Two-column WEA draft modal (NOVELTY §3.3). Opens from `ui.openWea(alertId)`. */
export function WeaDraftModal() {
  const alertId = useUiStore((s) => s.weaAlertId)
  const closeWea = useUiStore((s) => s.closeWea)
  const reduced = useReducedMotion() ?? false

  useEffect(() => {
    if (alertId === null) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWea() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [alertId, closeWea])

  return (
    <AnimatePresence>
      {alertId !== null && (
        <motion.div
          key="wea"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduced ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-[rgba(10,9,8,0.7)] flex items-center justify-center p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) closeWea() }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wea-title"
            initial={reduced ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
            className="bg-surface rounded-xl w-full max-w-[960px] max-h-[calc(100dvh-32px)] flex flex-col overflow-hidden"
            style={{ boxShadow: 'var(--shadow-overlay)' }}
          >
            <header className="h-16 shrink-0 flex items-center gap-4 px-8">
              <h2 id="wea-title" className="display-h2 text-lg text-ink">Draft a wireless emergency alert</h2>
              <button type="button" onClick={closeWea} aria-label="Close" className="ml-auto -mr-2 size-8 inline-flex items-center justify-center rounded-md text-ink-3 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] shrink-0 transition-[color,background-color] duration-[120ms]">
                <X size={16} strokeWidth={1.5} />
              </button>
            </header>
            <ModalBody alertId={alertId} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
