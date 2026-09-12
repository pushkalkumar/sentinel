import clsx from 'clsx'
import { Link } from 'react-router'
import { WRAP } from './layout'

export const CONSOLE_PATH = '/login?next=/admin'

const LINK = 'h-9 px-3 inline-flex items-center rounded-md text-sm text-ink-2 hover:text-ink transition-colors duration-[120ms] ease-[var(--ease-exit)] focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-accent)]'

/** Sticky nav. No rule under it: the blur alone separates it from content that scrolls beneath. */
export function LandingBar() {
  return (
    <header className="h-16 sticky top-0 z-30 bg-canvas/85 backdrop-blur-md">
      <div className={clsx(WRAP, 'h-full flex items-center gap-6')}>
        <Link to="/" className="display-h1 text-[17px] font-medium tracking-tight text-ink">Sentinel</Link>
        {/* The hero carries the only primary call to action; up here the console is one more link. */}
        <nav className="ml-auto flex items-center gap-1" aria-label="Sections">
          <a href="#how" className={clsx(LINK, 'hidden sm:inline-flex')}>How it works</a>
          <Link to="/hardware" className={clsx(LINK, 'hidden sm:inline-flex')}>Hardware</Link>
          <a href="#business" className={clsx(LINK, 'hidden sm:inline-flex')}>Business</a>
          <Link to={CONSOLE_PATH} className={clsx(LINK, 'text-ink')}>Console</Link>
        </nav>
      </div>
    </header>
  )
}
