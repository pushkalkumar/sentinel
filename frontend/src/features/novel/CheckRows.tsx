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

/** Engine field names read as words here; mono is for the numbers only (DESIGN_V2 §3). */
const WORDS: Record<string, string> = {
  pm_rise: 'PM2.5 rise in 5 min',
  temp_rise: 'Temperature rise in 2 min',
  temp_vs_neighbours: 'Temperature above the neighbour median',
  gas_delta: 'Gas above baseline',
  ratio: 'Times the neighbour median',
  pm25: 'PM2.5 now',
  regional: 'Neighbour median',
}

/** A plain list: mark, what was compared, then the numbers it was tested against. 40 ms stagger. */
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
          className={clsx('grid grid-cols-[16px_1fr_auto] items-baseline gap-3 py-1.5 text-sm', c.pass ? 'text-ink' : 'text-ink-3')}
        >
          {c.pass
            ? <Check size={16} strokeWidth={2} className="text-ok translate-y-0.5" aria-label="passes" />
            : <Minus size={16} strokeWidth={1.5} className="text-ink-4 translate-y-0.5" aria-label="fails" />}
          <span className="min-w-0 text-pretty" title={c.expr}>{WORDS[c.name] ?? c.name}</span>
          <span className="font-mono text-xs tabular-nums whitespace-nowrap">
            {fmt(c.lhs)} <span className="text-ink-4">{c.op}</span> {fmt(c.rhs)}
          </span>
        </motion.li>
      ))}
    </ul>
  )
}
