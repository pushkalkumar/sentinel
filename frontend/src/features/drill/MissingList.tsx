import type { MissingStudent } from '@/lib/types'
import { Panel } from '@/components/ui/Panel'

export interface MissingListProps {
  missing: MissingStudent[]
}

/** DESIGN §8.3 right column: warn dot, student ref, class, muster node. */
export function MissingList({ missing }: MissingListProps) {
  return (
    <Panel title="Missing" meta={String(missing.length)} padded={false}>
      {missing.length === 0 ? (
        <p className="px-5 py-4 text-sm text-ink-3">No students missing.</p>
      ) : (
        <ul className="divide-y divide-line">
          {missing.map((m) => (
            <li key={`${m.class_name}-${m.student_ref}`} className="h-8 px-5 flex items-center gap-3 text-sm">
              <i aria-hidden className="size-1.5 rounded-full bg-warn shrink-0" />
              <span className="font-mono text-xs text-ink flex-1 truncate">{m.student_ref}</span>
              <span className="text-ink-2 w-8 shrink-0">{m.class_name}</span>
              <span className="text-ink-3 truncate max-w-[45%]" title={m.node_label}>{m.node_label}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
