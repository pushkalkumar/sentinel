import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ClassInfo, Drill, Node, NodeId, Rollcall } from '@/lib/types'
import { errorText, submitRollcall } from '@/lib/api'
import { elapsed, fmtWall, fmtWallZoned } from '@/lib/time'
import { FieldButton } from '@/features/phone/FieldButton'
import { FIELD_INPUT, SLAB } from '@/features/phone/surface'
import { RosterChips } from './RosterChips'
import { drillElapsedS, useNowTick } from './clock'
import { DRILL_KIND_LABEL } from './kinds'

export interface RollcallFormProps {
  drill: Drill
  classInfo: ClassInfo
  /** Nodes at the site, for the muster picker. Empty while loading; the class default still works. */
  nodes: Node[]
  onSubmitted: (drill: Drill) => void
}

const MUSTER_NOTE = 'Where your class is standing now.'

function existingRollcall(drill: Drill, classId: number): Rollcall | null {
  return drill.classes.find((c) => c.class_id === classId)?.rollcall ?? null
}

/** Teacher roll call for one class. Present defaults to roster minus missing and stays editable (BUILD_PLAN §2.7). */
export function RollcallForm({ drill, classInfo, nodes, onSubmitted }: RollcallFormProps) {
  const submitted = existingRollcall(drill, classInfo.id)
  const [editing, setEditing] = useState(submitted === null)
  const [missing, setMissing] = useState<string[]>(() => submitted?.missing_refs ?? [])
  const [nodeId, setNodeId] = useState<NodeId>(() => submitted?.node_id ?? classInfo.muster_node_id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = useNowTick(1000, true)
  const drillSecs = drillElapsedS(drill, now)

  // Once a submission lands for this class, show the success state.
  useEffect(() => {
    if (submitted) setEditing(false)
  }, [submitted?.submitted_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const present = Math.max(0, classInfo.roster_size - missing.length)

  const toggleMissing = (ref: string) => {
    setMissing(missing.includes(ref) ? missing.filter((r) => r !== ref) : [...missing, ref])
    if (error) setError(null)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const d = await submitRollcall(drill.id, { class_id: classInfo.id, node_id: nodeId, present, missing_refs: missing })
      onSubmitted(d)
      setEditing(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const startResubmit = () => {
    setMissing(submitted?.missing_refs ?? missing)
    setNodeId(submitted?.node_id ?? nodeId)
    setEditing(true)
  }

  const nodeOptions: Node[] = nodes.length > 0 ? nodes : []
  const defaultLabel = nodes.find((n) => n.id === classInfo.muster_node_id)?.label ?? classInfo.muster_node_id

  return (
    <div className="flex flex-col gap-8 pt-8">
      <div>
        <p className="text-[15px] text-f-ink-2 tabular-nums">
          {DRILL_KIND_LABEL[drill.kind]}, <span className="font-field-mono">{elapsed(drillSecs)}</span> elapsed
        </p>
        <h1 className="text-[26px] font-semibold leading-tight text-f-ink mt-1">Class {classInfo.name}</h1>
        <p className="text-[17px] leading-6 text-f-ink-2 mt-1 text-pretty">{classInfo.roster_size} on the roster. Usual muster point {defaultLabel}.</p>
      </div>

      {!editing && submitted ? (
        <div className="flex flex-col gap-5">
          <div className={`${SLAB} p-5`}>
            <p className="text-[15px] text-f-ink-2">Roll call submitted</p>
            <p className="text-[40px] font-semibold font-field-mono tabular-nums leading-none mt-2 text-f-ink">
              {submitted.present} <span className="text-f-ink-2 font-normal">/ {classInfo.roster_size}</span>
            </p>
            <p className="text-[17px] leading-6 text-f-ink mt-3 text-pretty">
              {submitted.missing_refs.length === 0 ? 'Everyone accounted for.' : `${submitted.missing_refs.length} missing: ${submitted.missing_refs.join(', ')}`}
            </p>
            <p className="text-[14px] leading-5 text-f-ink-2 mt-3">
              Sent <span className="font-field-mono tabular-nums" title={fmtWallZoned(submitted.submitted_at)}>{fmtWall(submitted.submitted_at, 'HH:mm:ss')}</span> from {submitted.node_label}. The office has it.
            </p>
          </div>
          <FieldButton onClick={startResubmit}>Resubmit</FieldButton>
        </div>
      ) : (
        <>
          {/* Present is derived from the roster minus the names tapped: two ways to enter it let a
              teacher double count (ux item 12). */}
          <section className="flex items-baseline justify-between gap-4">
            <span className="text-[17px] text-f-ink">Present</span>
            <span className="font-field-mono tabular-nums text-[26px] text-f-ink">
              {present} <span className="text-f-ink-2 text-[19px]">/ {classInfo.roster_size}</span>
            </span>
          </section>

          <section>
            <p className="flex items-baseline justify-between gap-4 text-[17px] text-f-ink mb-3">
              <span>Missing <span className="text-f-ink-2">(tap names)</span></span>
              {missing.length > 0 && <span className="font-field-mono tabular-nums">{missing.length}</span>}
            </p>
            <RosterChips roster={classInfo.roster} missing={missing} onToggle={toggleMissing} disabled={busy} />
          </section>

          <section>
            <label className="block">
              <span className="block text-[17px] text-f-ink mb-2">Muster point</span>
              <span className="relative block">
                <select
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  disabled={busy}
                  className={`appearance-none h-16 ${FIELD_INPUT} pr-12 text-[19px]`}
                >
                  {nodeOptions.length === 0 && <option value={classInfo.muster_node_id}>{defaultLabel}</option>}
                  {nodeOptions.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
                <ChevronDown size={22} strokeWidth={1.5} aria-hidden className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-f-ink-2" />
              </span>
            </label>
            <p className="text-[14px] leading-5 text-f-ink-2 mt-2 text-pretty">{MUSTER_NOTE}</p>
          </section>

          {error && <p className="text-[16px] text-f-alarm" role="alert">{error}</p>}

          {/* Sticky so the primary action is never below the roster (ux item 12). */}
          <div className="sticky bottom-0 -mx-5 px-5 pb-5 pt-3 bg-gradient-to-t from-f-canvas via-f-canvas to-transparent">
            <FieldButton variant="ink" onClick={submit} loading={busy}>
              Submit: {present} present, {missing.length} missing
            </FieldButton>
          </div>
        </>
      )}
    </div>
  )
}
