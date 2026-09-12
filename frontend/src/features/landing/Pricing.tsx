interface Column {
  id: string
  title: string
  price: string
  priceNote: string
  body: string
  line: string
}

// Numbers from spec §4.4. The schools column is the distribution story, so it gets twice the width.
const COLUMNS: Column[] = [
  {
    id: 'schools', title: 'Schools', price: '$12', priceNote: 'per node per year, hardware at cost',
    body: 'A 6-building district with 40 nodes: about $1,700 in hardware and $480 a year. Cheaper than one commercial weather station. Used every month for the drill the state already requires, and every smoky morning for the recess call.',
    line: 'Disaster hardware fails because it sits unused. This box earns its wall every month.',
  },
  {
    id: 'warehouses', title: 'Warehouses', price: '$25', priceNote: 'per node per year, plus responder integration',
    body: 'A 200,000 sq ft facility needs about 60 nodes: about $2,500 in hardware and $1,500 a year.',
    line: 'One prevented pallet fire pays for the building.',
  },
  {
    id: 'agencies', title: 'Agencies', price: 'Per seat', priceNote: 'responder console, under contract',
    body: 'Data from every tenant in the jurisdiction is shared with responders free during a declared emergency.',
    line: 'Only a responder can close an incident.',
  },
]

export function Pricing() {
  return (
    <section id="business" className="py-16 md:py-24 border-t border-line scroll-mt-14" aria-labelledby="business-title">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h2 id="business-title" className="display-h1 text-2xl text-ink">Who pays and why</h2>
        <p className="text-sm text-ink-3">Schools · Warehouses · Agencies</p>
      </div>
      <div className="mt-10 md:mt-14 grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] md:divide-x divide-line border-y border-line">
        {COLUMNS.map((c, i) => (
          <article key={c.id} className={i === 0 ? 'py-8 md:py-10 md:pr-10' : 'py-8 md:py-10 md:px-10 border-t md:border-t-0 border-line'}>
            <h3 className="label-signage">{c.title}</h3>
            <div className="mt-4 flex items-baseline gap-3 flex-wrap">
              <span className="stat-number text-xl md:text-2xl text-ink">{c.price}</span>
              <span className="text-sm text-ink-3">{c.priceNote}</span>
            </div>
            <p className="mt-4 text-base text-ink-2 max-w-[60ch]">{c.body}</p>
            <p className="mt-6 text-base text-ink border-l border-line-strong pl-4 max-w-[48ch]">{c.line}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
