import clsx from 'clsx'
import { WRAP } from './layout'

interface Column {
  id: string
  title: string
  price: string
  priceNote: string
  body: string
}

/** A figure sets in the stat face; words stay body sized, so the row keeps one numeric rhythm. */
const isFigure = (price: string) => price.startsWith('$')

// Numbers from spec §4.4.
const COLUMNS: Column[] = [
  {
    id: 'schools', title: 'Schools', price: '$12', priceNote: 'per node per year, hardware at cost',
    body: 'A 6-building district with 40 nodes is about $1,700 in hardware and $480 a year. It is used every month for the drill the state already requires, and every smoky morning for the recess call.',
  },
  {
    id: 'warehouses', title: 'Warehouses', price: '$25', priceNote: 'per node per year, plus responder integration',
    body: 'A 200,000 sq ft facility needs about 60 nodes: about $2,500 in hardware and $1,500 a year. One prevented pallet fire pays for the building.',
  },
  {
    id: 'agencies', title: 'Agencies', price: 'Per seat', priceNote: 'responder console, under contract',
    body: 'Data from every tenant in the jurisdiction is shared with responders free during a declared emergency. Only a responder can close an incident.',
  },
]

export function Pricing() {
  return (
    <section id="business" className={clsx(WRAP, 'pt-section-sm md:pt-section scroll-mt-16')} aria-labelledby="business-title">
      <h2 id="business-title" className="display-h1 text-xl md:text-2xl text-ink">Who pays and why</h2>
      <div className="mt-12 md:mt-16 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-10">
        {COLUMNS.map((c) => (
          <article key={c.id} className="min-w-0">
            <h3 className="text-base font-medium text-ink">{c.title}</h3>
            <p className={isFigure(c.price) ? 'stat-number text-2xl md:text-3xl text-ink mt-4' : 'text-lg text-ink mt-4'}>{c.price}</p>
            <p className="text-sm text-ink-3 mt-2">{c.priceNote}</p>
            <p className="text-base text-ink-2 mt-6 max-w-[40ch]">{c.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
