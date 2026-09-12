import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Cpu, MonitorDot } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatStrip } from '@/components/ui/StatStrip'
import { Grain } from '@/components/shell/Grain'
import { SafetyFooter } from '@/components/SafetyFooter'
import { CONSOLE_PATH, LandingBar } from '@/features/landing/LandingBar'
import { HeroCard } from '@/features/landing/HeroCard'
import { Honesty } from '@/features/landing/Honesty'
import { Steps } from '@/features/landing/Steps'
import { PullQuote } from '@/features/landing/PullQuote'
import { Pricing } from '@/features/landing/Pricing'

const HEADLINE = ['The smoke alarm that', 'keeps talking when', 'the internet dies.']

const STATS = [
  { value: '$31', label: 'per node at 1,000 units' },
  { value: '8', label: 'hops, 1 to 2 km each' },
  { value: '0', label: 'internet required' },
  { value: '3', label: 'days on one 18650, no sun' },
]

/** Dotted texture, hero only. Fades out toward the bottom so it never reaches the stat strip. */
const HERO_DOTS: CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(255,255,255,0.085) 1px, transparent 1.2px)',
  backgroundSize: '28px 28px',
  backgroundPosition: '14px 14px',
  maskImage: 'radial-gradient(120% 90% at 70% 20%, #000 30%, transparent 85%)',
  WebkitMaskImage: 'radial-gradient(120% 90% at 70% 20%, #000 30%, transparent 85%)',
}

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-canvas text-ink relative overflow-x-clip">
      <Grain />
      <div className="relative z-[2]">
        <LandingBar />
        <section className="relative border-b border-line" aria-labelledby="hero-title">
          <div aria-hidden className="absolute inset-0 pointer-events-none" style={HERO_DOTS} />
          <div className="relative max-w-[1600px] mx-auto px-6 pt-14 pb-14 md:pt-16 md:pb-20 grid grid-cols-1 gap-12 min-[1100px]:grid-cols-[540px_minmax(0,1fr)] min-[1100px]:gap-14 min-[1100px]:items-center min-[1100px]:pt-20 min-[1100px]:pb-20">
            <div className="min-w-0 min-[1100px]:py-4">
              <p className="label-signage text-ink-3">Sentinel Node · Seattle · 2026</p>
              <h1 id="hero-title" className="display-hero text-ink mt-5" style={{ fontSize: 'clamp(44px, 4.7vw, 68px)' }}>
                {HEADLINE.map((line, i) => (
                  <motion.span
                    key={line}
                    className="block whitespace-nowrap"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.48, ease: [0.2, 0, 0, 1], delay: i * 0.06 }}
                  >
                    {line}
                  </motion.span>
                ))}
              </h1>
              <p className="mt-6 text-md text-ink-2 max-w-[52ch]">
                A $31 box that measures smoke, heat and gas, relays over long-range radio, and lets any phone nearby report danger with a verified location. Schools use it every month for drills. That is why it works on the worst day.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="primary" icon={MonitorDot} onClick={() => navigate(CONSOLE_PATH)}>Open the console</Button>
                <Button variant="secondary" icon={Cpu} onClick={() => navigate('/hardware')}>See the hardware</Button>
              </div>
              <p className="mt-8 font-mono text-2xs text-ink-3 hidden min-[1100px]:block">
                Scripted 24 s loop on the right: calm, smoke, gym fire, report hop, resolved. No backend needed.
              </p>
            </div>
            <HeroCard className="min-w-0 w-full max-w-[1120px] min-[1100px]:max-w-none min-[1100px]:justify-self-end" />
          </div>
        </section>

        <main className="max-w-[1600px] mx-auto px-6">
          <StatStrip items={STATS} className="mt-10 md:mt-14" />
          <Honesty className="mt-6 md:mt-8" />
          <Steps />
          <PullQuote />
          <Pricing />
        </main>
        <SafetyFooter className="mt-16 md:mt-24" />
      </div>
    </div>
  )
}
