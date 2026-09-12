import type { MissingStudent } from '@/lib/types'
import { Panel } from '@/components/ui/Panel'

export interface MissingListProps {
  missing: MissingStudent[]
}

/** DESIGN §8.3 right column: student ref, class, muster node. Hairline rows only, last unruled. */
export function MissingList({ missing }: MissingListProps) {
  return (
    <Panel title="Missing" meta={missing.length > 0 ? String(missing.length) : undefined} padded={false}>
      {missing.length === 0 ? (
        <p className="px-panel pt-2 pb-5 text-sm text-ink-3">No students missing.</p>
      ) : (
        <div className="px-panel pb-3">
          {/* The third column is where the class reported from, not where the student is (ux item 33). */}
          <div className="h-7 flex items-center gap-3 text-xs text-ink-3">
            <span className="flex-1">Student</span>
            <span className="w-8 shrink-0">Class</span>
            <span className="max-w-[45%] truncate">Class mustered at</span>
          </div>
          <ul>
            {missing.map((m) => (
              <li key={`${m.class_name}-${m.student_ref}`} className="h-9 flex items-center gap-3 text-sm border-b border-line last:border-b-0">
                <span className="font-mono text-xs text-ink flex-1 truncate">{m.student_ref}</span>
                <span className="text-ink-2 w-8 shrink-0">{m.class_name}</span>
                <span className="text-ink-3 truncate max-w-[45%]" title={m.node_label}>{m.node_label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
