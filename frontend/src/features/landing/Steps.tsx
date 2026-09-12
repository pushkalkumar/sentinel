import clsx from 'clsx'
import type { ReactNode } from 'react'

interface Step {
  n: string
  title: string
  body: string
  visual: ReactNode
  /** Text column width out of 12; the visual takes the rest. Weighted, not mirrored. */
  textCols: 7 | 8
  visualFirst: boolean
}

const STROKE = { fill: 'none', stroke: 'var(--color-ink-3)', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
const SIGNAL = 'var(--color-signal)'

function PhoneJoin() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto" aria-hidden>
      <rect x={28} y={28} width={56} height={104} rx={8} {...STROKE} />
      <rect x={36} y={40} width={40} height={72} rx={2} fill="var(--color-raised)" />
      <text x={56} y={80} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} fill="var(--color-ink-2)">SENTINEL-gym</text>
      <path d="M130 96 a32 32 0 0 1 0 -32" stroke={SIGNAL} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.5} />
      <path d="M142 106 a48 48 0 0 1 0 -52" stroke={SIGNAL} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.8} />
      <path d="M154 118 a64 64 0 0 1 0 -76" stroke={SIGNAL} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <rect x={210} y={52} width={80} height={56} rx={4} {...STROKE} />
      <circle cx={250} cy={80} r={5} fill={SIGNAL} />
      <text x={250} y={126} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-2)">node · no internet</text>
    </svg>
  )
}

function Hop() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto" aria-hidden>
      <g stroke="var(--color-line-strong)" strokeDasharray="2 4" strokeWidth={1} fill="none">
        <line x1={40} y1={110} x2={130} y2={60} />
        <line x1={130} y1={60} x2={220} y2={100} />
        <line x1={220} y1={100} x2={284} y2={48} />
      </g>
      <circle cx={40} cy={110} r={6} fill="var(--color-alarm)" stroke="rgba(255,255,255,0.2)" />
      <circle cx={130} cy={60} r={6} fill="var(--color-band-usg)" stroke="rgba(255,255,255,0.2)" />
      <circle cx={220} cy={100} r={6} fill="var(--color-band-usg)" stroke="rgba(255,255,255,0.2)" />
      <rect x={278} y={42} width={12} height={12} rx={2} fill="var(--color-band-moderate)" stroke="rgba(255,255,255,0.2)" />
      <line x1={150} y1={69} x2={172} y2={79} stroke={SIGNAL} strokeWidth={2} strokeLinecap="round" />
      <text x={40} y={136} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-2)">gym</text>
      <text x={284} y={30} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-2)">hub</text>
      <text x={160} y={140} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-3)">915 MHz · 1 to 2 km per hop</text>
    </svg>
  )
}

function Gateway() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto" aria-hidden>
      <rect x={36} y={66} width={14} height={14} rx={2} fill="var(--color-band-moderate)" stroke="rgba(255,255,255,0.2)" />
      <text x={43} y={100} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-2)">gateway</text>
      <line x1={58} y1={73} x2={120} y2={73} stroke="var(--color-line-strong)" strokeDasharray="2 4" />
      <rect x={124} y={52} width={72} height={42} rx={4} {...STROKE} />
      <text x={160} y={77} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-2)">edge server</text>
      <line x1={200} y1={73} x2={250} y2={73} stroke="var(--color-line-strong)" strokeDasharray="2 4" />
      <path d="M254 84 h40 a10 10 0 0 0 0 -20 a14 14 0 0 0 -26 -4 a10 10 0 0 0 -14 10 a7 7 0 0 0 0 14 z" {...STROKE} />
      <text x={262} y={112} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-3)">cloud, if it is up</text>
    </svg>
  )
}

function Responder() {
  return (
    <svg viewBox="0 0 320 160" className="w-full h-auto" aria-hidden>
      <rect x={28} y={28} width={180} height={104} rx={4} {...STROKE} />
      <g stroke="var(--color-line-faint)" strokeWidth={1}>
        <line x1={28} y1={62} x2={208} y2={62} /><line x1={28} y1={96} x2={208} y2={96} />
        <line x1={88} y1={28} x2={88} y2={132} /><line x1={148} y1={28} x2={148} y2={132} />
      </g>
      <circle cx={120} cy={80} r={6} fill="var(--color-alarm)" />
      <circle cx={120} cy={80} r={12} fill="none" stroke="var(--color-alarm)" opacity={0.4} />
      <text x={136} y={84} fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink)">SN-7K3F</text>
      <rect x={224} y={64} width={70} height={18} rx={9} fill="rgba(90,212,110,0.14)" />
      <circle cx={235} cy={73} r={3} fill="var(--color-ok)" />
      <text x={243} y={77} fontFamily="var(--font-sans)" fontSize={10} fontWeight={500} fill="var(--color-ok)">Verified</text>
      <text x={259} y={104} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--color-ink-3)">trust 78 / 100</text>
    </svg>
  )
}

const STEPS: Step[] = [
  {
    n: '1', title: "A phone joins the box's own WiFi.",
    body: 'No internet, no app. The sign-in screen pops up like hotel WiFi, and the report form is served from the node itself.',
    visual: <PhoneJoin />, textCols: 7, visualFirst: false,
  },
  {
    n: '2', title: 'The report hops box to box over 915 MHz radio.',
    body: 'Each hop covers 1 to 2 km. Drops are expected; every node deduplicates and retries until a gateway acknowledges.',
    visual: <Hop />, textCols: 8, visualFirst: true,
  },
  {
    n: '3', title: "A gateway or the school's own edge server catches it.",
    body: 'The edge server works on its own. When the internet is back it syncs up. Nothing waits on the cloud.',
    visual: <Gateway />, textCols: 7, visualFirst: false,
  },
  {
    n: '4', title: 'A responder sees it on a map, scored for trust, and is the only one who can close it.',
    body: 'Only a responder can close an incident. Only a phone standing next to the box can open a verified one.',
    visual: <Responder />, textCols: 8, visualFirst: true,
  },
]

export function Steps() {
  return (
    <section id="how" className="py-16 md:py-24 scroll-mt-14" aria-labelledby="how-title">
      <h2 id="how-title" className="display-h1 text-2xl text-ink">How a report gets out</h2>
      <ol className="mt-10 md:mt-14 divide-y divide-line border-y border-line">
        {STEPS.map((s) => (
          <li key={s.n} className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 py-8 md:py-10 items-center">
            <div className={clsx('flex gap-6 min-w-0', s.textCols === 7 ? 'md:col-span-7' : 'md:col-span-8', s.visualFirst && 'md:order-2')}>
              <span className="display-hero text-2xl text-ink-4 leading-none tabular-nums w-10 shrink-0" aria-hidden>{s.n}</span>
              <div className="min-w-0 max-w-[60ch]">
                <h3 className="display-h2 text-lg text-ink">{s.title}</h3>
                <p className="mt-2 text-base text-ink-2">{s.body}</p>
              </div>
            </div>
            <div className={clsx('hairline rounded-md bg-surface p-4 max-w-[360px] w-full md:max-w-none', s.textCols === 7 ? 'md:col-span-5' : 'md:col-span-4', s.visualFirst && 'md:order-1')}>
              {s.visual}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
