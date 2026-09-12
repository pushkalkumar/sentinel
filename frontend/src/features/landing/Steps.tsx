import clsx from 'clsx'
import { WRAP } from './layout'

interface Step {
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    title: "A phone joins the box's own WiFi.",
    body: 'No internet, no app. The sign-in screen pops up like hotel WiFi and the report form is served from the node itself.',
  },
  {
    title: 'The report hops box to box over 915 MHz radio.',
    body: 'A hop covers 1 to 2 km outdoors and 300 to 600 m through buildings. Drops are expected; every node deduplicates and retries until a gateway acknowledges.',
  },
  {
    title: "A gateway or the school's own edge server catches it.",
    body: 'The edge server works on its own and syncs up when the internet is back. Nothing waits on the cloud.',
  },
  {
    title: 'A responder sees it on a map and is the only one who can close it.',
    body: 'Only a phone standing next to the box can open a verified incident. Only a responder can close one.',
  },
]

const LINE = { fill: 'none', stroke: 'var(--color-ink-3)', strokeWidth: 1.25, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const LINK = { stroke: 'var(--color-line-strong)', strokeWidth: 1, fill: 'none' }
const LABEL = { fontFamily: 'var(--font-sans)', fontSize: 11, fill: 'var(--color-ink-3)', textAnchor: 'middle' as const }

/** The whole path in one drawing: phone, three boxes, edge server, responder screen. */
function Journey() {
  return (
    <svg viewBox="0 0 640 220" className="w-full h-auto" role="img" aria-label="A phone reports to a node, the report hops across three nodes to a gateway, an edge server catches it, and a responder sees it on a map.">
      {/* phone */}
      <rect x={20} y={80} width={32} height={62} rx={6} {...LINE} />
      <rect x={25} y={88} width={22} height={44} rx={1.5} fill="var(--color-raised)" />
      <path d="M64 101 a11 11 0 0 1 0 20" stroke="var(--color-signal)" strokeWidth={1.25} fill="none" strokeLinecap="round" opacity={0.55} />
      <path d="M72 93 a19 19 0 0 1 0 36" stroke="var(--color-signal)" strokeWidth={1.25} fill="none" strokeLinecap="round" />
      <text x={36} y={166} {...LABEL}>phone</text>

      {/* mesh: gym, science, hub */}
      <line x1={120} y1={118} x2={210} y2={96} {...LINK} />
      <line x1={210} y1={96} x2={300} y2={116} {...LINK} />
      <line x1={312} y1={116} x2={350} y2={112} {...LINK} />
      <line x1={246} y1={104} x2={268} y2={109} stroke="var(--color-signal)" strokeWidth={2} strokeLinecap="round" />
      <circle cx={120} cy={118} r={6} fill="var(--color-alarm)" stroke="rgba(255,255,255,0.2)" />
      <circle cx={210} cy={96} r={6} fill="var(--color-ink-2)" stroke="rgba(255,255,255,0.2)" />
      <rect x={294} y={110} width={12} height={12} rx={2} fill="var(--color-ink-2)" stroke="rgba(255,255,255,0.2)" />
      <text x={120} y={150} {...LABEL}>gym</text>
      <text x={210} y={80} {...LABEL}>science</text>
      <text x={300} y={150} {...LABEL}>hub, gateway</text>

      {/* edge server */}
      <rect x={352} y={92} width={64} height={40} rx={4} {...LINE} />
      <line x1={362} y1={106} x2={406} y2={106} stroke="var(--color-line-strong)" strokeWidth={1} />
      <line x1={362} y1={118} x2={406} y2={118} stroke="var(--color-line-strong)" strokeWidth={1} />
      <text x={384} y={166} {...LABEL}>edge server</text>
      <line x1={418} y1={112} x2={454} y2={112} {...LINK} />

      {/* responder screen */}
      <rect x={456} y={72} width={150} height={84} rx={4} {...LINE} />
      <g stroke="var(--color-line-faint)" strokeWidth={1}>
        <line x1={456} y1={100} x2={606} y2={100} />
        <line x1={456} y1={128} x2={606} y2={128} />
        <line x1={506} y1={72} x2={506} y2={156} />
        <line x1={556} y1={72} x2={556} y2={156} />
      </g>
      <circle cx={531} cy={114} r={5} fill="var(--color-alarm)" />
      <circle cx={531} cy={114} r={11} fill="none" stroke="var(--color-alarm)" opacity={0.35} />
      <text x={544} y={118} fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink)">SN-7K3F</text>
      <text x={531} y={180} {...LABEL}>responder</text>
    </svg>
  )
}

export function Steps() {
  return (
    <section id="how" className={clsx(WRAP, 'pt-section-sm md:pt-section scroll-mt-16')} aria-labelledby="how-title">
      <h2 id="how-title" className="display-h1 text-xl md:text-2xl text-ink">How a report gets out</h2>
      <div className="mt-12 md:mt-16 grid grid-cols-1 gap-14 lg:grid-cols-12 lg:gap-16 lg:items-start">
        <ol className="lg:col-span-5 space-y-8 max-w-[44ch]">
          {STEPS.map((s) => (
            <li key={s.title} className="min-w-0">
              <h3 className="display-h2 text-lg text-ink">{s.title}</h3>
              <p className="mt-1.5 text-base text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="lg:col-span-7 min-w-0 hidden md:block">
          <Journey />
        </div>
      </div>
    </section>
  )
}
