import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import type { ExplainCheck } from '@/lib/types'

export interface CheckRowsProps {
  checks: ExplainCheck[]
}

const STAGGER_S = 0.04

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** One mono row per condition the engine tested, pass/fail mark, 40 ms stagger (DESIGN §6.8 style). */
export function CheckRows({ checks }: CheckRowsProps) {
  const reduced = useReducedMotion() ?? false
  if (checks.length === 0) return <p className="text-sm text-ink-3">The engine has not evaluated this node yet.</p>
  return (
    <ul className="font-mono text-xs flex flex-col divide-y divide-line">
      {checks.map((c, i) => (
        <motion.li
          key={c.name}
          initial={reduced ? false : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: reduced ? 0 : i * STAGGER_S, ease: [0.2, 0, 0, 1] }}
          className={clsx('grid grid-cols-[96px_1fr_16px] items-center gap-3 h-8', c.pass ? 'text-ink' : 'text-ink-3')}
        >
          <span className="truncate" title={c.expr}>{c.name}</span>
          <span className="tabular-nums truncate">
            {fmt(c.lhs)} {c.op} {fmt(c.rhs)}
          </span>
          {c.pass
            ? <Check size={16} strokeWidth={1.5} className="text-ok" aria-label="passes" />
            : <X size={16} strokeWidth={1.5} className="text-ink-4" aria-label="fails" />}
        </motion.li>
      ))}
    </ul>
  )
}
