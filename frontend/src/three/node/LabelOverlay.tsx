import { useHardwareStore } from '@/store/hardware'
import type { LabelHandles } from './labels'
import { LABEL_W, LABEL_H } from './labels'
import { PART_REGISTRY, type Part } from './parts'

/** Leader stroke: ink at 30%, one step above line-strong so it survives the vignette. */
const LEADER = 'rgba(237, 232, 224, 0.3)'

const usd = (p: Part) => (p.cost1k > 0 ? `$${p.cost1k.toFixed(2)} at 1k` : p.costNote ?? '')

/**
 * Thin leader lines to small labels beside the model (DESIGN_V2 §5). Rendered once; the in-canvas projector
 * moves the nodes imperatively so nothing re-renders per frame.
 */
export function LabelOverlay({ handles, interactive }: { handles: LabelHandles; interactive: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none select-none" aria-hidden={!interactive}>
      <svg className="absolute inset-0 w-full h-full overflow-visible">
        {PART_REGISTRY.map((p) => (
          <g key={p.id} style={{ color: LEADER }}>
            <line
              ref={(el) => { (handles.refs[p.id] ??= { label: null, line: null, dot: null }).line = el }}
              x1={0} y1={0} x2={0} y2={0} stroke="currentColor" strokeWidth={1} shapeRendering="geometricPrecision" opacity={0}
            />
            <circle
              ref={(el) => { (handles.refs[p.id] ??= { label: null, line: null, dot: null }).dot = el }}
              r={2.5} fill="var(--color-canvas)" stroke="currentColor" strokeWidth={1} opacity={0}
            />
          </g>
        ))}
      </svg>
      {PART_REGISTRY.map((p) => (
        <div
          key={p.id}
          ref={(el) => { (handles.refs[p.id] ??= { label: null, line: null, dot: null }).label = el }}
          role={interactive ? 'button' : undefined}
          tabIndex={-1}
          onPointerEnter={() => useHardwareStore.getState().hover(p.id)}
          onPointerLeave={() => useHardwareStore.getState().hover(null)}
          onClick={() => useHardwareStore.getState().select(p.id)}
          style={{ width: LABEL_W, height: LABEL_H, opacity: 0, willChange: 'transform, opacity' }}
          className="absolute left-0 top-0 flex flex-col justify-center gap-0.5 px-2 cursor-pointer rounded-sm"
        >
          <span className="text-[13px] leading-4 text-ink truncate">{p.name}</span>
          <span className="font-mono text-2xs leading-3.5 text-ink-3 tabular-nums truncate">{usd(p)}</span>
        </div>
      ))}
    </div>
  )
}
