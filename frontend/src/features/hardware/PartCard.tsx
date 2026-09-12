import { AnimatePresence, motion } from 'motion/react'
import { activePartId, useHardwareStore } from '@/store/hardware'
import { PART_BY_ID } from '@/three/node/parts'

const usd = (v: number) => `$${v.toFixed(2)}`

/** Rail part card: hover wins, then selection, then the MCU. Sans for prose, mono only for the price and bus. */
export function PartCard() {
  const id = useHardwareStore(activePartId)
  const reduced = useHardwareStore((s) => s.reducedMotion)
  const part = PART_BY_ID[id]
  const dur = reduced ? 0 : 0.18
  return (
    <div className="relative min-h-[188px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.article
          key={part.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: dur, ease: [0.2, 0, 0, 1] }}
        >
          <h3 className="display-h2 text-lg text-ink">{part.name}</h3>
          <p className="text-sm text-ink-3 mt-1">{part.spec}</p>
          <p className="text-sm text-ink-2 mt-4 leading-5">{part.role}</p>
          <div className="flex items-baseline gap-3 mt-4 font-mono text-xs tabular-nums">
            <span className="text-ink">{part.cost1k > 0 ? `${usd(part.cost1k)} at 1k` : part.costNote}</span>
            {part.bus && <span className="text-ink-3 truncate">{part.bus}</span>}
          </div>
        </motion.article>
      </AnimatePresence>
    </div>
  )
}
