import clsx from 'clsx'
import { useNavigate } from 'react-router'
import { motion } from 'motion/react'
import { Button } from '@/components/ui/Button'
import { StatStrip } from '@/components/ui/StatStrip'
import { Grain } from '@/components/shell/Grain'
import { SafetyFooter } from '@/components/SafetyFooter'
import { CONSOLE_PATH, LandingBar } from '@/features/landing/LandingBar'
import { WRAP } from '@/features/landing/layout'
import { HeroCard } from '@/features/landing/HeroCard'
import { Steps } from '@/features/landing/Steps'
import { SkyVsBuilding } from '@/features/landing/SkyVsBuilding'
import { Pricing } from '@/features/landing/Pricing'

const HEADLINE = ['The smoke alarm that', 'keeps talking when', 'the internet dies.']

const STATS = [
  { value: '$31', label: 'per node at 1,000 units' },
  { value: '8', label: 'hops, 1 to 2 km each' },
  { value: '0', label: 'internet required' },
  { value: '3', label: 'days on one 18650, no sun' },
]

/** Landing (DESIGN_V2 §4): one idea per section, grouped by whitespace, no section rules. */
export default function Landing() {
  const navigate = useNavigate()
  return (
    <div className="min-h-dvh bg-canvas text-ink relative overflow-x-clip">
      <Grain />
      <div className="relative z-[2]">
        <LandingBar />

        <section aria-labelledby="hero-title" className={clsx(WRAP, 'pt-14 md:pt-20 lg:pt-24')}>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12 lg:items-end">
            <h1 id="hero-title" className="display-hero text-ink lg:col-span-7" style={{ fontSize: 'clamp(40px, 4.3vw, 62px)' }}>
              {HEADLINE.map((line, i) => (
                <motion.span
                  key={line}
                  className="block md:whitespace-nowrap"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: [0.2, 0, 0, 1], delay: 0.05 + i * 0.07 }}
                >
                  {line}
                </motion.span>
              ))}
            </h1>
            <div className="lg:col-span-5 lg:pb-2 max-w-[42ch]">
              <p className="prose-landing">
                A $31 box that measures smoke, heat and gas, relays over long-range radio, and lets any phone nearby report danger with a verified location.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-2">
                <Button variant="primary" className="px-5" onClick={() => navigate(CONSOLE_PATH)}>Open the console</Button>
                <Button variant="ghost" className="px-4" onClick={() => navigate('/hardware')}>See the hardware</Button>
              </div>
            </div>
          </div>
          <HeroCard className="mt-14 md:mt-20" />
        </section>

        <section aria-label="Key figures" className={clsx(WRAP, 'pt-section-sm md:pt-section')}>
          <StatStrip items={STATS} className="max-w-[1040px]" />
        </section>

        <Steps />
        <SkyVsBuilding />
        <Pricing />
        <SafetyFooter />
      </div>
    </div>
  )
}
