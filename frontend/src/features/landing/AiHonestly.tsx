import clsx from 'clsx'
import { Link } from 'react-router'
import { WRAP } from './layout'

interface Column { title: string; body: string }

// Figures from docs/AI_FOR_GOOD.md and GET /api/ml/model-card.
const COLUMNS: Column[] = [
  {
    title: 'Rules decide.',
    body: 'Four if-statements a fire marshal can read open and close every alert. Each verdict comes with the thresholds that produced it.',
  },
  {
    title: 'A model advises.',
    body: 'A small logistic regression over seven features gives a second opinion: fire, sky, clear or suspect. 98% held-out accuracy on the simulated day, none yet on a real one. It says so on every output.',
  },
  {
    title: 'Gemini triages, humans resolve.',
    body: 'Free-text reports in any language come back as a structured summary with a fallback to keyword rules. Nothing in the alert path calls a language model, and only a responder can close an incident.',
  },
]

/** One calm section: what the AI is, what it is not, who decides. */
export function AiHonestly() {
  return (
    <section id="ai" className={clsx(WRAP, 'pt-section-sm md:pt-section scroll-mt-16')} aria-labelledby="ai-title">
      <h2 id="ai-title" className="display-h1 text-xl md:text-2xl text-ink">AI, honestly</h2>
      <div className="mt-12 md:mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-10">
        {COLUMNS.map((c) => (
          <article key={c.title} className="min-w-0 max-w-[40ch]">
            <h3 className="text-base font-medium text-ink">{c.title}</h3>
            <p className="mt-3 text-base text-ink-2">{c.body}</p>
          </article>
        ))}
      </div>
      <p className="mt-10 text-base text-ink-2">
        <Link to="/demo" className="text-accent underline-offset-4 hover:underline">Watch it run on the demo campus</Link>
      </p>
    </section>
  )
}
