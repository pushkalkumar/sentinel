import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import type { DrillReport as DrillReportT } from '@/lib/types'
import { errorText, getDrillReport } from '@/lib/api'
import { elapsed, fmtWall, fmtWallZoned } from '@/lib/time'
import { DRILL_KIND_LABEL } from '@/features/drill/kinds'

const TH = 'text-left text-[13px] font-medium text-f-ink-2 pb-2 pr-4 border-b border-f-line'
const TD = 'py-2.5 pr-4 border-b border-f-line text-[14px] text-f-ink align-top'
const MONO = 'font-field-mono tabular-nums'

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-f-ink-2">{label}</div>
      <div className="text-[16px] text-f-ink mt-1">{children}</div>
    </div>
  )
}

/** Printable compliance page. Light on purpose (DESIGN §8.3): it goes in a paper file. */
export default function DrillReport() {
  const { id } = useParams()
  const drillId = Number(id)
  const [report, setReport] = useState<DrillReportT | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!Number.isFinite(drillId)) {
      setError('That report link is not valid.')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getDrillReport(drillId)
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(errorText(e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [drillId])

  return (
    <div data-ground="field" className="min-h-dvh bg-f-canvas text-f-ink font-field px-6 py-10 print:bg-white print:py-0">
      <div className="max-w-[960px] mx-auto">
        {loading && <p className="text-[16px] text-f-ink-2">Loading report...</p>}
        {!loading && error && (
          <div>
            <p className="text-[16px] text-f-alarm">{error}</p>
            <p className="text-[14px] text-f-ink-2 mt-2">Sign in as an admin, then open the report again from the drill page.</p>
          </div>
        )}
        {!loading && !error && report && <ReportBody report={report} />}
      </div>
    </div>
  )
}

function ReportBody({ report }: { report: DrillReportT }) {
  const { drill, site, compliance } = report
  const kind = DRILL_KIND_LABEL[drill.kind]
  return (
    <article>
      <header className="flex items-start justify-between gap-6 border-b border-f-ink pb-6">
        <div>
          <p className="text-[14px] text-f-ink-2">Sentinel {kind.toLowerCase()} record</p>
          <h1 className="text-[28px] font-semibold leading-tight mt-1">{site.name}</h1>
          <p className="text-[14px] text-f-ink-2 mt-1">{site.address}</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden h-11 px-5 rounded-lg bg-f-ink text-white text-[15px] font-semibold shrink-0 active:scale-[0.98]"
        >
          Print
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-6 py-8">
        <Fact label="Drill">{kind}{drill.is_real ? ' (real event)' : ''}</Fact>
        <Fact label="Started">
          <span className={MONO} title={fmtWallZoned(drill.started_at)}>{fmtWall(drill.started_at, 'HH:mm:ss')}</span>
        </Fact>
        <Fact label="Ended">
          <span className={MONO} title={fmtWallZoned(drill.ended_at)}>{drill.ended_at ? fmtWall(drill.ended_at, 'HH:mm:ss') : 'still open'}</span>
        </Fact>
        <Fact label="Duration"><span className={MONO}>{elapsed(report.duration_s)}</span></Fact>
        <Fact label="Started by">{report.started_by_name ?? 'unknown'}</Fact>
        <Fact label="Classes reported">
          <span className={MONO}>{drill.summary.submitted} / {drill.summary.classes}</span>
          {compliance.all_classes_reported ? ' (all)' : ' (incomplete)'}
        </Fact>
        <Fact label="Time to full roll call">
          <span className={MONO}>{compliance.time_to_full_rollcall_s === null ? 'not reached' : elapsed(compliance.time_to_full_rollcall_s)}</span>
        </Fact>
        <Fact label="Students">
          <span className={MONO}>{drill.summary.present_total}</span> present, <span className={MONO}>{drill.summary.missing_total}</span> missing, <span className={MONO}>{drill.summary.roster_total}</span> enrolled
        </Fact>
      </section>

      <section className="pb-8">
        <p className="text-[16px] text-pretty">
          Filed under <span className="font-semibold">{compliance.statute}</span>. Keep this record with the site&apos;s emergency plan.
        </p>
      </section>

      <section className="pb-8">
        <h2 className="text-[18px] font-semibold mb-3">Classes</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Class</th>
                <th className={TH}>Teacher</th>
                <th className={TH}>Muster point</th>
                <th className={`${TH} text-right`}>Present</th>
                <th className={`${TH} text-right`}>Missing</th>
                <th className={TH}>Submitted</th>
                <th className={`${TH} text-right`}>Elapsed</th>
              </tr>
            </thead>
            <tbody>
              {report.classes.length === 0 && (
                <tr><td colSpan={7} className={`${TD} text-f-ink-2`}>No classes on file for this site.</td></tr>
              )}
              {report.classes.map((c) => {
                const rc = c.rollcall
                return (
                  <tr key={c.class_id}>
                    <td className={`${TD} font-semibold`}>{c.name}</td>
                    <td className={TD}>{c.teacher_name}</td>
                    <td className={TD}>{rc?.node_label ?? '(not submitted)'}</td>
                    <td className={`${TD} ${MONO} text-right`}>{rc ? `${rc.present} / ${c.roster_size}` : `-- / ${c.roster_size}`}</td>
                    <td className={`${TD} ${MONO} text-right`}>{rc ? rc.missing_refs.length : '--'}</td>
                    <td className={`${TD} ${MONO}`} title={rc ? fmtWallZoned(rc.submitted_at) : undefined}>{rc ? fmtWall(rc.submitted_at, 'HH:mm:ss') : 'pending'}</td>
                    <td className={`${TD} ${MONO} text-right`}>{rc ? elapsed(rc.elapsed_s) : '--'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="pb-8">
        <h2 className="text-[18px] font-semibold mb-3">Missing students</h2>
        {report.missing.length === 0 ? (
          <p className="text-[14px] text-f-ink-2">No students were reported missing.</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={TH}>Student</th>
                <th className={TH}>Class</th>
                <th className={TH}>Last muster point</th>
              </tr>
            </thead>
            <tbody>
              {report.missing.map((m) => (
                <tr key={`${m.class_name}-${m.student_ref}`}>
                  <td className={`${TD} ${MONO}`}>{m.student_ref}</td>
                  <td className={TD}>{m.class_name}</td>
                  <td className={TD}>{m.node_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="pt-4 text-[13px] text-f-ink-2">
        Generated <span className={MONO} title={fmtWallZoned(report.generated_at)}>{fmtWall(report.generated_at, 'HH:mm:ss')}</span>, drill <span className={MONO}>#{drill.id}</span>
      </footer>
    </article>
  )
}
