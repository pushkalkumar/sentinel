import clsx from 'clsx'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { WRAP } from './layout'

export const CONSOLE_PATH = '/login?next=/admin'

const LINK = 'h-9 px-3 inline-flex items-center rounded-md text-sm text-ink-2 hover:text-ink transition-colors duration-[120ms] ease-[var(--ease-exit)]'

/** Sticky nav. No rule under it: the blur alone separates it from content that scrolls beneath. */
export function LandingBar() {
  const navigate = useNavigate()
  return (
    <header className="h-16 sticky top-0 z-30 bg-canvas/85 backdrop-blur-md">
      <div className={clsx(WRAP, 'h-full flex items-center gap-6')}>
        <Link to="/" className="display-h1 text-[17px] font-medium tracking-tight text-ink">Sentinel</Link>
        <nav className="ml-auto hidden sm:flex items-center gap-1" aria-label="Sections">
          <a href="#how" className={LINK}>How it works</a>
          <Link to="/hardware" className={LINK}>Hardware</Link>
          <a href="#business" className={LINK}>Business</a>
        </nav>
        <Button variant="secondary" className="sm:ml-3 ml-auto h-9 px-3.5 text-sm" onClick={() => navigate(CONSOLE_PATH)}>Open console</Button>
      </div>
    </header>
  )
}
