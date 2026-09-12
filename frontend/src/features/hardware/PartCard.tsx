import { AnimatePresence, motion } from 'motion/react'
import { activePartId, useHardwareStore } from '@/store/hardware'
import { PART_BY_ID } from '@/three/node/parts'

const usd = (v: number) => `$${v.toFixed(2)}`

/** Right-rail part card (HARDWARE_3D §4.4): DOM, driven by hover then selection then the MCU. */
export function PartCard() {
  const id = useHardwareStore(activePartId)
  const reduced = useHardwareStore((s) => s.reducedMotion)
  const part = PART_BY_ID[id]
  const dur = reduced ? 0 : 0.18
  return (
    <div className="relative min-h-[176px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={part.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: dur, ease: [0.2, 0, 0, 1] }}
          className="space-y-2"
        >
          <div className="flex items-baseline gap-3">
            {part.index > 0 && <span className="font-mono text-2xs tabular-nums text-signal">{String(part.index).padStart(2, '0')}</span>}
            <h3 className="display-h2 text-lg text-ink">{part.name}</h3>
          </div>
          <p className="font-mono text-xs text-ink-2 tabular-nums">{part.spec}</p>
          <p className="text-sm text-ink-2 leading-[18px]">{part.role}</p>
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {part.bus && <span className="font-mono text-2xs text-ink-2 px-1.5 h-[22px] inline-flex items-center rounded-sm hairline">{part.bus}</span>}
            <span className="font-mono text-2xs tabular-nums text-ink ml-auto">
              {part.cost1k > 0 ? `${usd(part.cost1k)} at 1k` : part.costNote}
            </span>
          </div>
          {part.cost1k > 0 && part.costNote && <p className="font-mono text-2xs text-ink-3">{part.costNote}</p>}
        </motion.article>
      </AnimatePresence>
    </div>
  )
}
