import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'

export const CONSOLE_PATH = '/login?next=/admin'

const LINK = 'h-9 px-3 inline-flex items-center rounded-sm text-base text-ink-2 hover:text-ink hover:bg-[rgba(255,255,255,0.04)] transition-[background-color,color] duration-[120ms] ease-[var(--ease-exit)]'

export function LandingBar() {
  const navigate = useNavigate()
  return (
    <header className="h-14 sticky top-0 z-30 bg-canvas/95 backdrop-blur border-b border-line">
      <div className="max-w-[1600px] mx-auto h-full px-6 flex items-center gap-6">
        <Link to="/" className="display-h1 text-[17px] font-semibold tracking-tight text-ink">Sentinel</Link>
        <nav className="ml-auto hidden sm:flex items-center gap-1" aria-label="Sections">
          <a href="#how" className={LINK}>How it works</a>
          <Link to="/hardware" className={LINK}>Hardware</Link>
          <a href="#business" className={LINK}>Business</a>
        </nav>
        <Button variant="secondary" className="sm:ml-2 ml-auto" onClick={() => navigate(CONSOLE_PATH)}>Open console</Button>
      </div>
    </header>
  )
}
