import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useMeshStore } from '@/store/mesh'
import type { MeshLogEntry } from '@/lib/types'
import { isXenonPress } from './xenonPress'

const TOAST_MS = 6000
const TITLE = 'Xenon A: "I\'m here" pressed.'
const BODY = 'Real hardware, BLE hop to Xenon B, delivered to Main Hall.'

/** Shared across every mounted toast so /demo, which mounts two, shows one toast per press. */
const announced = new Set<number>()

/** Fires for hops that arrive while mounted; hydrated history is not a press happening now. */
function useLivePress(): MeshLogEntry | null {
  const lastHop = useMeshStore((s) => s.lastHop)
  const [press, setPress] = useState<MeshLogEntry | null>(null)
  const armed = useRef(false)
  useEffect(() => {
    if (!armed.current) { armed.current = true; return }
    if (!isXenonPress(lastHop) || announced.has(lastHop.id)) return
    announced.add(lastHop.id)
    setPress(lastHop)
  }, [lastHop])
  return press
}

/** Large top-centre toast, six seconds, bone pulse. Unmistakable: this is the one real radio in the room. */
export function XenonToast() {
  const press = useLivePress()
  const [open, setOpen] = useState<MeshLogEntry | null>(null)
  const reduced = useReducedMotion() ?? false

  useEffect(() => {
    if (!press) return
    setOpen(press)
    const t = window.setTimeout(() => setOpen((cur) => (cur?.id === press.id ? null : cur)), TOAST_MS)
    return () => window.clearTimeout(t)
  }, [press])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key={open.id}
          role="status"
          aria-live="assertive"
          initial={reduced ? false : { opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.32, ease: [0.2, 0, 0, 1] }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-5 rounded-lg bg-overlay pl-6 pr-7 py-5 max-w-[calc(100vw-32px)]"
          style={{ boxShadow: 'var(--shadow-overlay), 0 0 0 1px var(--color-accent-line)' }}
          data-testid="xenon-toast"
        >
          <span className="relative shrink-0 size-4">
            <i aria-hidden className="absolute inset-0 rounded-full bg-accent" />
            {!reduced && <i aria-hidden className="absolute inset-0 rounded-full bg-accent animate-[xenon-pulse_1.2s_ease-out_infinite]" />}
          </span>
          <span className="flex flex-col gap-0.5">
            <span className="text-lg text-ink font-medium leading-tight">{TITLE}</span>
            <span className="text-sm text-ink-2">{BODY}</span>
          </span>
          <style>{'@keyframes xenon-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(3.2);opacity:0}}'}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
