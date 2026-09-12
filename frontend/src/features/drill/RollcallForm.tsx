import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ClassInfo, Drill, Node, NodeId, Rollcall } from '@/lib/types'
import { errorText, submitRollcall } from '@/lib/api'
import { elapsed, fmtWall, fmtWallZoned } from '@/lib/time'
import { Stepper } from '@/components/ui/Stepper'
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

const NODE_PICKER_NOTE = 'In production the node stamps this automatically; pick the node you are standing next to.'

function existingRollcall(drill: Drill, classId: number): Rollcall | null {
  return drill.classes.find((c) => c.class_id === classId)?.rollcall ?? null
}

/** Teacher roll call for one class. Present defaults to roster minus missing and stays editable (BUILD_PLAN §2.7). */
export function RollcallForm({ drill, classInfo, nodes, onSubmitted }: RollcallFormProps) {
  const submitted = existingRollcall(drill, classInfo.id)
  const [editing, setEditing] = useState(submitted === null)
  const [missing, setMissing] = useState<string[]>(() => submitted?.missing_refs ?? [])
  const [present, setPresent] = useState<number>(() => submitted?.present ?? classInfo.roster_size)
  const [presentTouched, setPresentTouched] = useState(false)
  const [nodeId, setNodeId] = useState<NodeId>(() => submitted?.node_id ?? classInfo.muster_node_id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const now = useNowTick(1000, true)
  const drillSecs = drillElapsedS(drill, now)

  // Once a submission lands for this class, show the success state.
  useEffect(() => {
    if (submitted) setEditing(false)
  }, [submitted?.submitted_at]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMissing = (ref: string) => {
    const next = missing.includes(ref) ? missing.filter((r) => r !== ref) : [...missing, ref]
    setMissing(next)
    if (!presentTouched) setPresent(Math.max(0, classInfo.roster_size - next.length))
    if (error) setError(null)
  }

  const changePresent = (v: number) => {
    setPresent(v)
    setPresentTouched(true)
    if (error) setError(null)
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const d = await submitRollcall(drill.id, { class_id: classInfo.id, node_id: nodeId, present, missing_refs: missing })
      onSubmitted(d)
      setEditing(false)
      setPresentTouched(false)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  const startResubmit = () => {
    setMissing(submitted?.missing_refs ?? missing)
    setPresent(submitted?.present ?? present)
    setNodeId(submitted?.node_id ?? nodeId)
    setPresentTouched(false)
    setEditing(true)
  }

  const total = present + missing.length
  const mismatch = total !== classInfo.roster_size
  const nodeOptions: Node[] = nodes.length > 0 ? nodes : []
  const defaultLabel = nodes.find((n) => n.id === classInfo.muster_node_id)?.label ?? classInfo.muster_node_id

  return (
    <div className="flex flex-col gap-6 pt-4">
      <div>
        <div className="font-field-mono text-[14px] text-f-ink-2 uppercase tracking-wider tabular-nums">
          {DRILL_KIND_LABEL[drill.kind]} · {elapsed(drillSecs)}
        </div>
        <h1 className="text-[28px] font-bold leading-tight text-f-ink mt-1">Class {classInfo.name}</h1>
        <p className="text-[16px] text-f-ink-2 mt-1">{classInfo.roster_size} on the roster · usual muster point {defaultLabel}</p>
      </div>

      {!editing && submitted ? (
        <div className="flex flex-col gap-5">
          <div className="rounded-md border border-f-line-strong bg-f-surface p-5">
            <div className="text-[14px] text-f-ink-2 uppercase tracking-wider font-semibold">Roll call submitted</div>
            <div className="text-[32px] font-bold font-field-mono tabular-nums mt-1 text-f-ink">
              {submitted.present} / {classInfo.roster_size}
            </div>
            <p className="text-[16px] text-f-ink-2 mt-1">
              {submitted.missing_refs.length === 0 ? 'Everyone accounted for.' : `${submitted.missing_refs.length} missing: ${submitted.missing_refs.join(', ')}`}
            </p>
            <p className="text-[14px] text-f-ink-2 mt-3">
              Sent <span className="font-field-mono" title={fmtWallZoned(submitted.submitted_at)}>{fmtWall(submitted.submitted_at, 'HH:mm:ss')}</span> from {submitted.node_label}. The office has it.
            </p>
          </div>
          <button
            type="button"
            onClick={startResubmit}
            className="h-16 w-full rounded-sm border-[1.5px] border-f-line-strong bg-f-surface text-f-ink text-[20px] font-semibold active:bg-f-canvas"
          >
            Resubmit
          </button>
        </div>
      ) : (
        <>
          <section>
            <div className="text-[16px] text-f-ink-2 mb-2" id="present-label">Present</div>
            <Stepper value={present} onChange={changePresent} min={0} max={classInfo.roster_size} label="Present" />
          </section>

          <section>
            <div className="text-[16px] text-f-ink-2 mb-2">
              Missing <span className="text-f-ink-2">(tap names)</span>
              {missing.length > 0 && <span className="font-field-mono tabular-nums text-f-ink"> · {missing.length}</span>}
            </div>
            <RosterChips roster={classInfo.roster} missing={missing} onToggle={toggleMissing} disabled={busy} />
          </section>

          <section>
            <label className="block">
              <span className="block text-[16px] text-f-ink-2 mb-2">Muster point</span>
              <span className="relative block">
                <select
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  disabled={busy}
                  className="appearance-none h-16 w-full rounded-sm bg-f-surface border-[1.5px] border-f-line-strong text-f-ink text-[20px] px-4 pr-12 outline-none focus:border-f-signal"
                >
                  {nodeOptions.length === 0 && <option value={classInfo.muster_node_id}>{defaultLabel}</option>}
                  {nodeOptions.map((n) => (
                    <option key={n.id} value={n.id}>{n.label}</option>
                  ))}
                </select>
                <ChevronDown size={24} strokeWidth={1.5} aria-hidden className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-f-ink-2" />
              </span>
            </label>
            <p className="text-[14px] text-f-ink-2 mt-2">{NODE_PICKER_NOTE}</p>
          </section>

          {mismatch && !error && (
            <p className="text-[14px] text-f-ink-2">
              {present} present + {missing.length} missing = {total}. The roster has {classInfo.roster_size}; the office will reject a count that does not add up.
            </p>
          )}
          {error && <p className="text-[16px] text-f-alarm" role="alert">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="h-16 w-full rounded-sm bg-f-signal text-white text-[20px] font-semibold disabled:opacity-45"
          >
            {busy ? 'Sending...' : 'Submit roll call'}
          </button>
        </>
      )}
    </div>
  )
}
