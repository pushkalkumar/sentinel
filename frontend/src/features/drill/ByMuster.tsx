import type { DrillClass, NodeId } from '@/lib/types'
import { Panel } from '@/components/ui/Panel'
import { useSiteStore } from '@/store/site'

export interface ByMusterProps {
  classes: DrillClass[]
}

interface MusterRow { nodeId: NodeId; label: string; classes: number; submitted: number }

function groupByMuster(classes: DrillClass[], labelFor: (id: NodeId) => string): MusterRow[] {
  const rows = new Map<NodeId, MusterRow>()
  for (const c of classes) {
    const id = c.rollcall?.node_id ?? c.muster_node_id
    const row = rows.get(id) ?? { nodeId: id, label: c.rollcall?.node_label ?? labelFor(id), classes: 0, submitted: 0 }
    rows.set(id, { ...row, classes: row.classes + 1, submitted: row.submitted + (c.rollcall ? 1 : 0) })
  }
  return [...rows.values()].sort((a, b) => b.classes - a.classes || a.label.localeCompare(b.label))
}

/** DESIGN §8.3: classes per muster point, with how many have reported in. */
export function ByMuster({ classes }: ByMusterProps) {
  const nodes = useSiteStore((s) => s.nodes)
  const rows = groupByMuster(classes, (id) => nodes[id]?.label ?? id)
  return (
    <Panel title="By muster point" padded={false}>
      {rows.length === 0 ? (
        <p className="px-panel pt-2 pb-5 text-sm text-ink-3">No classes assigned.</p>
      ) : (
        <ul className="px-panel pb-3">
          {rows.map((r) => (
            <li key={r.nodeId} className="h-9 flex items-center gap-3 text-sm border-b border-line last:border-b-0">
              <span className="text-ink flex-1 truncate" title={r.nodeId}>{r.label}</span>
              <span className="font-mono text-xs tabular-nums">
                <span className={r.submitted === r.classes ? 'text-ink' : 'text-ink-2'}>{r.submitted}</span>
                <span className="text-ink-4"> / {r.classes}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
