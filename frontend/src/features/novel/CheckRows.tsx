import { motion, useReducedMotion } from 'motion/react'
import clsx from 'clsx'
import { Check, Minus } from 'lucide-react'
import type { ExplainCheck } from '@/lib/types'

export interface CheckRowsProps {
  checks: ExplainCheck[]
}

const STAGGER_S = 0.04

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/** A plain list: mark, condition name, then the numbers it was tested against. 40 ms stagger. */
export function CheckRows({ checks }: CheckRowsProps) {
  const reduced = useReducedMotion() ?? false
  if (checks.length === 0) return <p className="text-sm text-ink-3">The engine has not evaluated this node yet.</p>
  return (
    <ul className="flex flex-col">
      {checks.map((c, i) => (
        <motion.li
          key={c.name}
          initial={reduced ? false : { opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: reduced ? 0 : i * STAGGER_S, ease: [0.2, 0, 0, 1] }}
          className={clsx('grid grid-cols-[16px_1fr_auto] items-center gap-3 h-8 text-sm', c.pass ? 'text-ink' : 'text-ink-3')}
        >
          {c.pass
            ? <Check size={16} strokeWidth={2} className="text-ok" aria-label="passes" />
            : <Minus size={16} strokeWidth={1.5} className="text-ink-4" aria-label="fails" />}
          <span className="font-mono text-xs truncate" title={c.expr}>{c.name}</span>
          <span className="font-mono text-xs tabular-nums whitespace-nowrap">
            {fmt(c.lhs)} <span className="text-ink-4">{c.op}</span> {fmt(c.rhs)}
          </span>
        </motion.li>
      ))}
    </ul>
  )
}
