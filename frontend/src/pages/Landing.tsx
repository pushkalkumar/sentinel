import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Cpu, MonitorDot } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatStrip } from '@/components/ui/StatStrip'
import { Grain } from '@/components/shell/Grain'
import { SafetyFooter } from '@/components/SafetyFooter'
import { CONSOLE_PATH, LandingBar } from '@/features/landing/LandingBar'
import { HeroCard } from '@/features/landing/HeroCard'
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

export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-canvas text-ink relative overflow-x-clip">
      <Grain />
      <div className="relative z-[2]">
        <LandingBar />
        <main className="max-w-[1600px] mx-auto px-6">
          <section className="pt-14 pb-16 md:pt-20 md:pb-24">
            <div className="min-w-0">
              <p className="label-signage text-ink-3">Sentinel Node · Seattle · 2026</p>
              <h1 className="display-hero text-ink mt-5" style={{ fontSize: 'clamp(44px, 6.2vw, 80px)' }}>
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
              <p className="mt-6 text-md text-ink-2 max-w-[60ch]">
                A $31 box that measures smoke, heat and gas, relays over long-range radio, and lets any phone nearby report danger with a verified location. Schools use it every month for drills. That is why it works on the worst day.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button variant="primary" icon={MonitorDot} onClick={() => navigate(CONSOLE_PATH)}>Open the console</Button>
                <Button variant="secondary" icon={Cpu} onClick={() => navigate('/hardware')}>See the hardware</Button>
              </div>
            </div>
            <HeroCard className="mt-12 md:mt-16 max-w-[1120px]" />
          </section>

          <StatStrip items={STATS} />

          <Steps />
          <PullQuote />
          <Pricing />
        </main>
        <SafetyFooter className="mt-16 md:mt-24" />
      </div>
    </div>
  )
}
